import axios from 'axios';
import unzipper from 'unzipper';
import csv from 'csv-parser';
import AllRecord from '../models/AllRecords.js';
import AppConfig from '../models/AppConfig.js';
import https from 'https';
import translate from 'google-translate-api-x';
import { globalSyncState, ioInstance as io } from '../utils/syncLock.js';

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
    
    globalSyncState.isSyncing = true;
    globalSyncState.type = 'QC';
    globalSyncState.message = 'Initializing QC Sync...';
    globalSyncState.progress = 0;
    io.emit('sync_update', globalSyncState);

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

                globalSyncState.message = `${prefix}Creating Export on Lightwheel...`;
                io.emit('sync_update', globalSyncState);
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

                globalSyncState.message = `${prefix}Waiting for ZIP compilation...`;
                io.emit('sync_update', globalSyncState);
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
                        globalSyncState.message = `${prefix}Compiling ZIP... (Attempt ${i + 1})`;
                        io.emit('sync_update', globalSyncState);
                    } catch (pollError) {
                        if (pollError.response && pollError.response.status === 401) {
                            throw new Error('Lightwheel Token Expired! Please refresh in Admin Settings.');
                        }
                    }
                }

                if (!downloadUrl) throw new Error(`${proj.name} Export Timeout: ZIP never finished.`);

                globalSyncState.message = `${prefix}Downloading ZIP...`;
                io.emit('sync_update', globalSyncState);
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

                globalSyncState.message = `${prefix}Processing Data...`;
                io.emit('sync_update', globalSyncState);

                let batch = [];
                const parserStream = zipRes.data
                    .pipe(unzipper.ParseOne(/\.csv$/i))
                    .pipe(csv());

                const formatLightwheelDate = (dateStr) => {
                    if (!dateStr) return null;
                    return new Date(dateStr.trim().replace(' ', 'T') + 'Z');
                };

                for await (const row of parserStream) {
                    const formattedRow = { ...row };
                    if (formattedRow.start_produce_time) formattedRow.start_produce_time = formatLightwheelDate(formattedRow.start_produce_time);
                    if (formattedRow.inspect_time) formattedRow.inspect_time = formatLightwheelDate(formattedRow.inspect_time);

                    batch.push({
                        updateOne: {
                            filter: { data_name: row.data_name },
                            update: { $set: { ...formattedRow, project_category: proj.category } },
                            upsert: true
                        }
                    });

                    if (batch.length >= 3000) {
                        await AllRecord.bulkWrite(batch, { ordered: false });
                        totalProcessed += batch.length;
                        
                        // Emit live progress updates!
                        globalSyncState.progress = totalProcessed;
                        io.emit('sync_update', globalSyncState);
                        batch = [];
                    }
                }

                if (batch.length > 0) {
                    await AllRecord.bulkWrite(batch, { ordered: false });
                    totalProcessed += batch.length;
                    globalSyncState.progress = totalProcessed;
                    io.emit('sync_update', globalSyncState);
                }
            }

            await AppConfig.findOneAndUpdate(
                { configId: 'global_settings' },
                { lastQcSync: new Date() }
            );

            globalSyncState.isSyncing = false;
            globalSyncState.message = 'QC Database Synced Successfully!';
            io.emit('sync_finished', globalSyncState);

        } catch (error) {
            globalSyncState.isSyncing = false;
            io.emit('sync_error', { message: error.message });
        }
    })();
};

export const getPendingTranslationCount = async (req, res) => {
    try {
        const count = await AllRecord.countDocuments({
            inspect_result: 'INSPECT_FAILED',
            $or: [
                { inspect_issue_description_en: { $exists: false } },
                { inspect_issue_description_en: null }
            ]
        });
        res.json({ pendingCount: count });
    } catch (error) {
        res.status(500).json({ error: 'Failed to count pending translations' });
    }
};

export const triggerTranslation = async (req, res) => {
    if (globalSyncState.isSyncing) {
        return res.status(409).json({ error: 'A sync operation is already in progress globally.' });
    }

    globalSyncState.isSyncing = true;
    globalSyncState.type = 'TRANSLATE';
    globalSyncState.message = 'Initializing Translation Engine...';
    globalSyncState.progress = 0;
    io.emit('sync_update', globalSyncState);

    res.status(202).json({ message: "Translation Queue Started" });

    (async () => {
        try {
            const recordsToTranslate = await AllRecord.find({
                inspect_result: 'INSPECT_FAILED',
                $or: [
                    { inspect_issue_description_en: { $exists: false } },
                    { inspect_issue_description_en: null }
                ]
            }).select('_id data_name inspect_issue_description');

            if (recordsToTranslate.length === 0) {
                globalSyncState.isSyncing = false;
                globalSyncState.message = 'No records require translation.';
                io.emit('sync_finished', globalSyncState);
                return;
            }

            globalSyncState.message = `Translating ${recordsToTranslate.length} records...`;
            io.emit('sync_update', globalSyncState);

            let processed = 0;
            let consecutiveFailures = 0;

            for (const record of recordsToTranslate) {
                let updateData = {};
                let success = false;
                let attempts = 0;

                while (attempts < 3 && !success) {
                    try {
                        attempts++;
                        const waitTime = 500 + (attempts * 1000);
                        await new Promise(resolve => setTimeout(resolve, waitTime)); 

                        if (record.data_name) {
                            const nameRes = await translate(record.data_name, { to: 'en' });
                            updateData.data_name_en = nameRes.text;
                        }

                        if (record.inspect_issue_description) {
                            const descRes = await translate(record.inspect_issue_description, { to: 'en' });
                            updateData.inspect_issue_description_en = descRes.text;
                        }

                        if (Object.keys(updateData).length > 0) {
                            await AllRecord.updateOne({ _id: record._id }, { $set: updateData });
                        }

                        success = true;
                        consecutiveFailures = 0; 

                    } catch (err) {
                        if (attempts >= 3) {
                            consecutiveFailures++;
                        }
                    }
                }

                processed++;
                globalSyncState.progress = processed;
                // Emit progress every 5 records to avoid flooding the socket
                if (processed % 5 === 0) {
                    io.emit('sync_update', globalSyncState);
                }

                if (consecutiveFailures >= 5) {
                    throw new Error("Google API Rate Limited. Try again in 30 minutes.");
                }
            }

            globalSyncState.isSyncing = false;
            globalSyncState.message = 'Translation Complete!';
            globalSyncState.progress = processed;
            io.emit('sync_finished', globalSyncState);

        } catch (error) {
            globalSyncState.isSyncing = false;
            io.emit('sync_error', { message: error.message });
        }
    })();
};