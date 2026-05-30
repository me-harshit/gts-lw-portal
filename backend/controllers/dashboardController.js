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

                updateSyncState({ message: `${prefix}Creating Export on Lightwheel...` });
                let exportId = null;
                let createAttempts = 0;

                while (createAttempts < 3 && !exportId) {
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
                        if (createAttempts >= 3) throw new Error(`Failed to create export for ${proj.name}.`);
                        await new Promise(resolve => setTimeout(resolve, 3000));
                    }
                }

                updateSyncState({ message: `${prefix}Waiting for ZIP compilation...` });
                let downloadUrl = null;

                for (let i = 0; i < 40; i++) {
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    try {
                        const listRes = await axios.post(
                            `${config.lightwheelQcApi}/list`,
                            { page: 1, pageSize: 20 },
                            { headers: getHeaders(config), httpsAgent, timeout: 60000 }
                        );
                        const match = listRes.data.data.find(item => item.id === exportId);
                        if (match && match.downloadUrl) {
                            downloadUrl = match.downloadUrl;
                            break;
                        }
                        updateSyncState({ message: `${prefix}Compiling ZIP... (Attempt ${i + 1})` });
                    } catch (pollError) {
                        if (pollError.response && pollError.response.status === 401) {
                            throw new Error('Lightwheel Token Expired! Please refresh in Admin Settings.');
                        }
                    }
                }

                if (!downloadUrl) throw new Error(`${proj.name} Export Timeout: ZIP never finished.`);

                updateSyncState({ message: `${prefix}Downloading ZIP...` });
                const downloadHeaders = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': '*/*',
                    'Accept-Encoding': 'identity'
                };

                let zipRes = null;
                let downloadAttempts = 0;

                while (downloadAttempts < 3 && !zipRes) {
                    try {
                        downloadAttempts++;
                        zipRes = await axios.get(downloadUrl, {
                            responseType: 'stream',
                            headers: downloadHeaders,
                            timeout: 300000
                        });
                    } catch (err) {
                        if (downloadAttempts >= 3) throw new Error(`Failed to download ${proj.name}.`);
                        await new Promise(resolve => setTimeout(resolve, 5000));
                    }
                }

                updateSyncState({ message: `${prefix}Processing Data & Checking Anomalies...` });

                let batch = [];
                const parserStream = zipRes.data
                    .pipe(unzipper.ParseOne(/\.csv$/i))
                    .pipe(csv());

                const formatLightwheelDate = (dateStr) => {
                    if (!dateStr) return null;
                    return new Date(dateStr.trim().replace(' ', 'T') + 'Z');
                };

                // --- HELPER TO PROCESS BATCHES WITH ANOMALY DETECTION ---
                const processBatch = async (rows) => {
                    if (rows.length === 0) return;
                    
                    // 1. Fetch all existing records for this batch at once (MASSIVE SPEED BOOST)
                    const dataNames = rows.map(r => r.data_name);
                    const existingRecords = await AllRecord.find({ data_name: { $in: dataNames } }).lean();
                    
                    // Convert to a quick lookup map
                    const existingMap = new Map(existingRecords.map(r => [r.data_name, r]));
                    const bulkOps = [];

                    for (const row of rows) {
                        const localRecord = existingMap.get(row.data_name);
                        let updateDoc = { ...row, project_category: proj.category };
                        let pushHistory = null;
                        
                        // Parse duration safely
                        const vDuration = parseFloat(row.video_duration) || 0;

                        if (localRecord) {
                            // --- STATUS CHANGE DETECTED ---
                            if (localRecord.inspect_result !== row.inspect_result) {
                                pushHistory = { status: row.inspect_result || 'PENDING', changedAt: new Date() };

                                // 🚨 THE ANOMALY TRAP: PASSED -> FAILED/PENDING
                                if (localRecord.inspect_result === 'INSPECT_PASSED' && row.inspect_result !== 'INSPECT_PASSED') {
                                    console.warn(`🚨 [Anomaly] Downgrade Detected: ${row.data_name}`);
                                    updateDoc.is_downgraded = true; 
                                }
                            }

                            // --- NEWLY PASSED DETECTED ---
                            if (localRecord.inspect_result !== 'INSPECT_PASSED' && row.inspect_result === 'INSPECT_PASSED') {
                                updateDoc.locked_duration = vDuration;
                                updateDoc.is_downgraded = false; // Clear flag if it passes again
                            }
                        } else {
                            // --- BRAND NEW RECORD ---
                            if (row.inspect_result === 'INSPECT_PASSED') {
                                updateDoc.locked_duration = vDuration;
                            }
                            pushHistory = { status: row.inspect_result || 'PENDING', changedAt: new Date() };
                        }

                        // Prepare the MongoDB query
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

                    // 2. Execute the smart bulk write
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

                    // Process in chunks of 1000 to balance memory and query limits
                    if (batch.length >= 1000) {
                        await processBatch(batch);
                        batch = [];
                    }
                }

                // Flush the remaining records
                if (batch.length > 0) {
                    await processBatch(batch);
                }
            }

            await AppConfig.findOneAndUpdate(
                { configId: 'global_settings' },
                { lastQcSync: new Date() }
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
let cancelTranslationFlag = false; // <-- NEW KILL SWITCH FLAG

export const translationState = {
    isRunning: false,
    processed: 0,
    total: 0,
    speed: 0,
    message: ''
};

// The Smart Query: Catches empty EN fields OR EN fields that accidentally contain CN text
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
        console.error("❌ Translation Count Error:", error); // <-- This will catch any DB query errors
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

            // Reduced from 5 to 3 to avoid instant IP bans from Google
            const CHUNK_SIZE = 3;

            for (let i = 0; i < totalRecords; i += CHUNK_SIZE) {
                // Check User Kill Switch
                if (cancelTranslationFlag) {
                    console.log("🛑 [Translation Engine] Halted by User Command.");
                    translationState.message = 'Halted by User.';
                    break;
                }

                const chunk = recordsToTranslate.slice(i, i + CHUNK_SIZE);
                let chunkFailed = true; // Assume failure until one succeeds

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

                                // THE INFINITE LOOP FIX: If Google returns the exact same Chinese text, mark it as failed so it clears the queue!
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
                            chunkFailed = false; // At least one record succeeded!

                        } catch (err) {
                            if (attempts >= 2) {
                                errorCount++;
                                // Print the exact error so you can see if Google is banning you
                                console.log(`⚠️ ID ${record._id.toString().substring(0, 6)}... Failed: ${err.message}`);

                                await AllRecord.updateOne(
                                    { _id: record._id },
                                    { $set: { inspect_issue_description_en: 'Skipped - API Error' } }
                                );
                            }
                        }
                    }
                }));

                // Auto-Kill Switch if Google blocks your VPS IP
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

                // Wait 2.5 seconds between chunks
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

// --- NEW FUNCTION TO FLIP THE KILL SWITCH ---
export const stopTranslation = (req, res) => {
    if (!translationState.isRunning) {
        return res.status(400).json({ message: "Engine is not currently running." });
    }

    cancelTranslationFlag = true;
    translationState.message = "Stopping Engine...";
    broadcastTranslationUpdate(translationState);

    res.json({ message: "Stop command sent. Engine will halt after the current chunk." });
};

// --- ANOMALY TRACKER FETCH (WITH DATES, PAGINATION & GRAND TOTAL) ---
export const getAnomalies = async (req, res) => {
    try {
        const { startDate, endDate, page = 1, limit = 50 } = req.query;
        let query = { is_downgraded: true };

        if (startDate && endDate) {
            const start = new Date(`${startDate}T00:00:00.000Z`);
            const end = new Date(`${endDate}T23:59:59.999Z`);
            query.updatedAt = { $gte: start, $lte: end };
        }

        // Pagination Math
        const skip = (Number(page) - 1) * Number(limit);
        const totalRecords = await AllRecord.countDocuments(query);
        const totalPages = Math.ceil(totalRecords / Number(limit));

        // --- NEW: Calculate the Grand Total Hours across ALL filtered records ---
        const aggregation = await AllRecord.aggregate([
            { $match: query },
            { $group: { _id: null, totalLostSeconds: { $sum: "$locked_duration" } } }
        ]);
        const totalLostSeconds = aggregation.length > 0 ? aggregation[0].totalLostSeconds : 0;

        const anomalies = await AllRecord.find(query)
            .select('data_name producer project_category locked_duration inspect_result status_history updatedAt')
            .sort({ updatedAt: -1 })
            .skip(skip)
            .limit(Number(limit));
            
        res.json({ 
            anomalies, 
            totalPages, 
            currentPage: Number(page), 
            totalRecords,
            totalLostSeconds // <-- Pass the true grand total to the frontend
        });

    } catch (error) {
        console.error("Failed to fetch anomalies:", error);
        res.status(500).json({ error: 'Failed to fetch QC anomalies.' });
    }
};