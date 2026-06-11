import axios from 'axios';
import unzipper from 'unzipper';
import csv from 'csv-parser';
import AllRecord from '../models/AllRecords.js';
import AppConfig from '../models/AppConfig.js';
import https from 'https';
import translate from 'google-translate-api-x';
import { globalSyncState, updateSyncState, finishSync, errorSync, broadcastTranslationUpdate } from '../utils/syncLock.js';

const httpsAgent = new https.Agent({
    keepAlive: true,
    keepAliveMsecs: 10000,
    rejectUnauthorized: false,
    timeout: 60000
});

const getHeaders = (config) => ({
    'Authorization': `Bearer ${config.lightwheelToken}`,
    'username': config.lightwheelUsername,
    'x_current_region_key': 'overseas',
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Connection': 'keep-alive'
});

// THIRTY MINUTES IN MILLISECONDS
const THIRTY_MINUTES = 30 * 60 * 1000;

export const triggerDashboardSync = async (req, res) => {
    if (globalSyncState.isSyncing) {
        return res.status(409).json({ error: 'A sync operation is already in progress globally.' });
    }

    const { projects } = req.body;

    updateSyncState({
        isSyncing: true,
        type: 'QC',
        message: 'Initializing QC Sync...',
        progress: 0
    });

    res.status(202).json({ message: "QC Sync Queue Started" });

    (async () => {
        try {
            const config = await AppConfig.findOne({ configId: 'global_settings' });
            if (!config || !config.lightwheelToken) {
                throw new Error('Missing Lightwheel API Token. Please update Admin Settings.');
            }

            let totalProcessed = 0;

            for (let pIndex = 0; pIndex < projects.length; pIndex++) {
                const proj = projects[pIndex];
                const prefix = projects.length > 1 ? `[${proj.name}] ` : '';

                // ==========================================
                // 1. CREATE EXPORT (Max 10 Attempts)
                // ==========================================
                updateSyncState({ message: `${prefix}Creating Export on Lightwheel...` });
                let exportId = null;
                let createAttempts = 0;

                while (createAttempts < 10 && !exportId) {
                    try {
                        createAttempts++;
                        const createRes = await axios.post(
                            `${config.lightwheelQcApi}/create`,
                            { collectFilter: { projectUuids: [proj.id] } },
                            { headers: getHeaders(config), httpsAgent, timeout: 90000 }
                        );
                        exportId = createRes.data.data.id;
                    } catch (err) {
                        if (err.response && err.response.status === 401) {
                            throw new Error('Lightwheel Token Expired! Please refresh in Admin Settings.');
                        }
                        if (createAttempts >= 10) throw new Error(`Failed to create export for ${proj.name} after 10 attempts.`);

                        // IF RATE LIMITED OR SERVER ERROR, WAIT 30 MINS
                        if (err.response && (err.response.status === 429 || err.response.status >= 500)) {
                            updateSyncState({ message: `${prefix}Rate Limited on Create. Pausing 30 mins... (Attempt ${createAttempts}/10)` });
                            await new Promise(resolve => setTimeout(resolve, THIRTY_MINUTES));
                        } else {
                            await new Promise(resolve => setTimeout(resolve, 5000));
                        }
                    }
                }

                // ==========================================
                // 2. POLL FOR ZIP COMPILATION (Max 10 Attempts)
                // ==========================================
                updateSyncState({ message: `${prefix}Waiting for ZIP compilation...` });
                let downloadUrl = null;
                let listAttempts = 0;

                while (listAttempts < 10 && !downloadUrl) {
                    try {
                        listAttempts++;
                        // Wait a base time of 30 seconds between checks so we don't spam the server
                        await new Promise(resolve => setTimeout(resolve, 30000));

                        updateSyncState({ message: `${prefix}Checking ZIP Status... (Attempt ${listAttempts}/10)` });

                        const listRes = await axios.post(
                            `${config.lightwheelQcApi}/list`,
                            { page: 1, pageSize: 20 },
                            { headers: getHeaders(config), httpsAgent, timeout: 60000 }
                        );

                        const match = listRes.data.data.find(item => item.id === exportId);
                        if (match && match.downloadUrl) {
                            downloadUrl = match.downloadUrl;
                        }
                    } catch (pollError) {
                        if (pollError.response && pollError.response.status === 401) {
                            throw new Error('Lightwheel Token Expired! Please refresh in Admin Settings.');
                        }
                        if (listAttempts >= 10) throw new Error(`${proj.name} Export Timeout: ZIP never finished after 10 checks.`);

                        // IF RATE LIMITED, WAIT 30 MINS
                        if (pollError.response && (pollError.response.status === 429 || pollError.response.status >= 500)) {
                            updateSyncState({ message: `${prefix}Rate Limited on Check. Pausing 30 mins... (Attempt ${listAttempts}/10)` });
                            await new Promise(resolve => setTimeout(resolve, THIRTY_MINUTES));
                        }
                    }
                }

                if (!downloadUrl) throw new Error(`${proj.name} Export Timeout: Missing Download URL.`);

                // ==========================================
                // 3. DOWNLOAD ZIP (Max 10 Attempts)
                // ==========================================
                updateSyncState({ message: `${prefix}Downloading ZIP...` });
                const downloadHeaders = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': '*/*',
                    'Accept-Encoding': 'identity'
                };

                let zipRes = null;
                let downloadAttempts = 0;

                while (downloadAttempts < 10 && !zipRes) {
                    try {
                        downloadAttempts++;
                        zipRes = await axios.get(downloadUrl, {
                            responseType: 'stream',
                            headers: downloadHeaders,
                            timeout: 300000 // 5 minute timeout for massive zips
                        });
                    } catch (err) {
                        if (downloadAttempts >= 10) throw new Error(`Failed to download ${proj.name} after 10 attempts.`);

                        // IF RATE LIMITED, WAIT 30 MINS
                        if (err.response && (err.response.status === 429 || err.response.status >= 500)) {
                            updateSyncState({ message: `${prefix}Rate Limited on Download. Pausing 30 mins... (Attempt ${downloadAttempts}/10)` });
                            await new Promise(resolve => setTimeout(resolve, THIRTY_MINUTES));
                        } else {
                            await new Promise(resolve => setTimeout(resolve, 5000));
                        }
                    }
                }

                updateSyncState({ message: `${prefix}Processing Data & Checking Anomalies...` });

                let batch = [];
                const parserStream = zipRes.data
                    .pipe(unzipper.ParseOne(/\.csv$/i))
                    .pipe(csv());

                const formatLightwheelDate = (dateStr) => {
                    if (!dateStr) return null;
                    return new Date(dateStr.trim().replace(' ', 'T') + '+08:00');
                };

                // --- HELPER TO PROCESS BATCHES WITH ANOMALY DETECTION ---
                const processBatch = async (rows) => {
                    if (rows.length === 0) return;

                    const dataNames = rows.map(r => r.data_name);
                    const existingRecords = await AllRecord.find({ data_name: { $in: dataNames } }).lean();
                    const existingMap = new Map(existingRecords.map(r => [r.data_name, r]));
                    const bulkOps = [];

                    for (const row of rows) {
                        const localRecord = existingMap.get(row.data_name);
                        let updateDoc = { ...row, project_category: proj.category };
                        let pushHistory = null;

                        const vDuration = parseFloat(row.video_duration) || 0;

                        if (localRecord) {
                            if (localRecord.inspect_result !== row.inspect_result) {
                                pushHistory = { status: row.inspect_result || 'PENDING', changedAt: new Date() };

                                if (localRecord.inspect_result === 'INSPECT_PASSED' && row.inspect_result !== 'INSPECT_PASSED') {
                                    console.warn(`🚨 [Anomaly] Downgrade Detected: ${row.data_name}`);
                                    updateDoc.is_downgraded = true;
                                }
                            }

                            if (localRecord.inspect_result !== 'INSPECT_PASSED' && row.inspect_result === 'INSPECT_PASSED') {
                                updateDoc.locked_duration = vDuration;
                                updateDoc.is_downgraded = false;
                            }
                        } else {
                            if (row.inspect_result === 'INSPECT_PASSED') {
                                updateDoc.locked_duration = vDuration;
                            }
                            pushHistory = { status: row.inspect_result || 'PENDING', changedAt: new Date() };
                        }

                        const updateQuery = { $set: updateDoc };
                        if (pushHistory) {
                            updateQuery.$push = { status_history: pushHistory };
                        }

                        bulkOps.push({
                            updateOne: {
                                filter: { data_name: row.data_name },
                                update: updateQuery,
                                upsert: true
                            }
                        });
                    }

                    await AllRecord.bulkWrite(bulkOps, { ordered: false });
                    totalProcessed += rows.length;
                    updateSyncState({ progress: totalProcessed });
                };

                // --- STREAM PROCESSING LOOP ---
                for await (const row of parserStream) {
                    const formattedRow = { ...row };
                    if (formattedRow.start_produce_time) formattedRow.start_produce_time = formatLightwheelDate(formattedRow.start_produce_time);
                    if (formattedRow.inspect_time) formattedRow.inspect_time = formatLightwheelDate(formattedRow.inspect_time);

                    batch.push(formattedRow);

                    if (batch.length >= 1000) {
                        await processBatch(batch);
                        batch = [];
                    }
                }

                if (batch.length > 0) {
                    await processBatch(batch);
                }
            }

            // Update Final Timestamp
            await AppConfig.findOneAndUpdate(
                { configId: 'global_settings' },
                { lastQcSync: new Date() },
                { upsert: true }
            );

            finishSync('QC Database Synced Successfully!');

        } catch (error) {
            console.error("QC Sync Error:", error);
            errorSync(error.message);
        }
    })();
};

// ============================================================================
// TRANSLATION ENGINE LOGIC
// ============================================================================

let isTranslationRunning = false;
let cancelTranslationFlag = false;

export const translationState = {
    isRunning: false,
    processed: 0,
    total: 0,
    speed: 0,
    message: ''
};

const getTranslationQuery = () => ({
    inspect_result: 'INSPECT_FAILED',
    inspect_issue_description: { $exists: true, $ne: '', $type: 'string' },
    $or: [
        { inspect_issue_description_en: { $exists: false } },
        { inspect_issue_description_en: null },
        { inspect_issue_description_en: '' },
        { $expr: { $eq: ["$inspect_issue_description", "$inspect_issue_description_en"] } }
    ]
});

export const getPendingTranslationCount = async (req, res) => {
    try {
        const count = await AllRecord.countDocuments(getTranslationQuery());
        res.json({ pendingCount: count, translationState });
    } catch (error) {
        console.error("❌ Translation Count Error:", error);
        res.status(500).json({ error: 'Failed to count pending translations' });
    }
};

export const triggerTranslation = async (req, res) => {
    if (translationState.isRunning) {
        return res.status(409).json({ error: 'Translation engine is already running.' });
    }

    translationState.isRunning = true;
    cancelTranslationFlag = false;
    translationState.processed = 0;
    translationState.total = 0;
    translationState.speed = 0;
    translationState.message = 'Initializing Batch Engine...';
    broadcastTranslationUpdate(translationState);

    res.status(202).json({ message: "Translation Engine started in Fast Batch Mode." });

    (async () => {
        try {
            const recordsToTranslate = await AllRecord.find(getTranslationQuery())
                .select('_id data_name inspect_issue_description');

            const totalRecords = recordsToTranslate.length;

            if (totalRecords === 0) {
                translationState.isRunning = false;
                translationState.message = 'No records require translation.';
                broadcastTranslationUpdate(translationState);
                return;
            }

            translationState.total = totalRecords;
            translationState.message = 'Translating (Fast Mode)...';
            broadcastTranslationUpdate(translationState);

            console.log(`\n🚀 [Translation Engine] Starting FAST BATCH of ${totalRecords} records...`);

            const startTime = Date.now();
            let processedCount = 0;
            let errorCount = 0;
            let consecutiveChunkFailures = 0;

            const CHUNK_SIZE = 3;

            for (let i = 0; i < totalRecords; i += CHUNK_SIZE) {
                if (cancelTranslationFlag) {
                    console.log("🛑 [Translation Engine] Halted by User Command.");
                    translationState.message = 'Halted by User.';
                    break;
                }

                const chunk = recordsToTranslate.slice(i, i + CHUNK_SIZE);
                let chunkFailed = true;

                await Promise.all(chunk.map(async (record) => {
                    let updateData = {};
                    let success = false;
                    let attempts = 0;

                    while (attempts < 2 && !success) {
                        try {
                            attempts++;

                            if (record.data_name) {
                                const nameRes = await translate(record.data_name, { to: 'en' });
                                if (nameRes.text !== record.data_name) updateData.data_name_en = nameRes.text;
                            }

                            if (record.inspect_issue_description) {
                                const descRes = await translate(record.inspect_issue_description, { to: 'en' });

                                if (descRes.text === record.inspect_issue_description) {
                                    updateData.inspect_issue_description_en = 'Skipped - Google returned unchanged text';
                                } else {
                                    updateData.inspect_issue_description_en = descRes.text;
                                }
                            }

                            if (!updateData.inspect_issue_description_en) {
                                updateData.inspect_issue_description_en = 'No valid description provided.';
                            }

                            if (Object.keys(updateData).length > 0) {
                                await AllRecord.updateOne({ _id: record._id }, { $set: updateData });
                            }

                            success = true;
                            chunkFailed = false;

                        } catch (err) {
                            if (attempts >= 2) {
                                errorCount++;
                                console.log(`⚠️ ID ${record._id.toString().substring(0, 6)}... Failed: ${err.message}`);

                                await AllRecord.updateOne(
                                    { _id: record._id },
                                    { $set: { inspect_issue_description_en: 'Skipped - API Error' } }
                                );
                            }
                        }
                    }
                }));

                if (chunkFailed) {
                    consecutiveChunkFailures++;
                } else {
                    consecutiveChunkFailures = 0;
                }

                processedCount += chunk.length;
                translationState.processed = processedCount;

                const elapsedSeconds = (Date.now() - startTime) / 1000;
                translationState.speed = (processedCount / elapsedSeconds).toFixed(2);
                broadcastTranslationUpdate(translationState);

                console.log(`⏱️ Progress: ${processedCount}/${totalRecords} | Speed: ${translationState.speed} req/sec | Errors: ${errorCount}`);

                if (consecutiveChunkFailures >= 3) {
                    console.error("🛑 [Translation Engine] Google API Rate Limited (Multiple chunk failures). Pausing engine to prevent IP Ban.");
                    translationState.message = 'Paused: Google Rate Limit.';
                    break;
                }

                await new Promise(resolve => setTimeout(resolve, 2500));
            }

            translationState.isRunning = false;
            if (!cancelTranslationFlag && consecutiveChunkFailures < 3) {
                translationState.message = `Finished with ${errorCount} errors.`;
                console.log(`✅ [Translation Engine] FINISHED FAST BATCH.`);
            }
            broadcastTranslationUpdate(translationState);

        } catch (error) {
            translationState.isRunning = false;
            translationState.message = 'Fatal System Error.';
            broadcastTranslationUpdate(translationState);
            console.error("🛑 [Translation Engine] Fatal System Error:", error);
        }
    })();
};

export const stopTranslation = (req, res) => {
    if (!translationState.isRunning) {
        return res.status(400).json({ message: "Engine is not currently running." });
    }

    cancelTranslationFlag = true;
    translationState.message = "Stopping Engine...";
    broadcastTranslationUpdate(translationState);

    res.json({ message: "Stop command sent. Engine will halt after the current chunk." });
};

export const getAnomalies = async (req, res) => {
    try {
        const { startDate, endDate, page = 1, limit = 50, type = 'DOWNGRADED' } = req.query;
        let baseQuery = {};

        if (type === 'ZERO_DURATION') {
            baseQuery = {
                $or: [
                    { video_duration: 0 },
                    { video_duration: "0" },
                    { video_duration: null },
                    { video_duration: { $exists: false } }
                ]
            };
        } else {
            baseQuery = { is_downgraded: true };
        }

        let query = { ...baseQuery };

        // Apply Date Filters strictly in Beijing Time (+08:00)
        if (startDate || endDate) {
            const dateQuery = {};
            if (startDate) dateQuery.$gte = new Date(`${startDate}T00:00:00.000+08:00`);
            if (endDate) dateQuery.$lte = new Date(`${endDate}T23:59:59.999+08:00`);

            if (type === 'ZERO_DURATION') {
                // Matches the exact fallback logic used in the UI
                query = {
                    $and: [
                        baseQuery,
                        {
                            $or: [
                                { start_produce_time: dateQuery },
                                { start_produce_time: null, createdAt: dateQuery },
                                { start_produce_time: { $exists: false }, createdAt: dateQuery }
                            ]
                        }
                    ]
                };
            } else {
                query.updatedAt = dateQuery;
            }
        }

        const skip = (Number(page) - 1) * Number(limit);
        const totalRecords = await AllRecord.countDocuments(query);
        const totalPages = Math.ceil(totalRecords / Number(limit));

        let totalLostSeconds = 0;
        if (type === 'DOWNGRADED') {
            const aggregation = await AllRecord.aggregate([
                { $match: query },
                { $group: { _id: null, totalLostSeconds: { $sum: "$locked_duration" } } }
            ]);
            totalLostSeconds = aggregation.length > 0 ? aggregation[0].totalLostSeconds : 0;
        }

        const sortField = type === 'ZERO_DURATION' ? { start_produce_time: -1 } : { updatedAt: -1 };

        const anomalies = await AllRecord.find(query)
            .select('data_name data_name_en producer project_category locked_duration inspect_result inspect_issue_description inspect_issue_description_en status_history updatedAt createdAt start_produce_time video_duration task_name task_name_en')
            .sort(sortField)
            .skip(skip)
            .limit(Number(limit));

        res.json({
            anomalies,
            totalPages,
            currentPage: Number(page),
            totalRecords,
            totalLostSeconds
        });

    } catch (error) {
        console.error("Failed to fetch anomalies:", error);
        res.status(500).json({ error: 'Failed to fetch QC anomalies.' });
    }
};