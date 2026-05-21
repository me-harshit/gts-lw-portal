import axios from 'axios';
import unzipper from 'unzipper';
import csv from 'csv-parser';
import AllRecord from '../models/AllRecords.js';
import AppConfig from '../models/AppConfig.js';
import https from 'https';
import translate from 'google-translate-api-x';

const httpsAgent = new https.Agent({
    keepAlive: true,
    keepAliveMsecs: 10000,
    rejectUnauthorized: false,
    timeout: 60000
});

export const activeJobs = {};

// --- DYNAMIC HEADERS HELPER ---
// We pass the config object in here so it ALWAYS uses the fresh database token
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
    const { projects } = req.body;
    const jobId = `job_${Date.now()}`;

    // 1. Fetch config from DB
    const config = await AppConfig.findOne({ configId: 'global_settings' });
    if (!config || !config.lightwheelToken) {
        return res.status(400).json({ error: 'Missing Lightwheel API Token. Please update Admin Settings.' });
    }

    activeJobs[jobId] = { status: 'Initializing...', progress: 0 };
    res.status(202).json({ message: "QC Sync Queue Started", jobId });

    try {
        let totalProcessed = 0;

        for (let pIndex = 0; pIndex < projects.length; pIndex++) {
            const proj = projects[pIndex];
            const prefix = projects.length > 1 ? `[${proj.name}] ` : '';

            // --- A. Create Export ---
            activeJobs[jobId].status = `${prefix}Creating Export on Lightwheel...`;
            let exportId = null;
            let createAttempts = 0;

            while (createAttempts < 3 && !exportId) {
                try {
                    createAttempts++;
                    const createRes = await axios.post(
                        `${config.lightwheelQcApi}/create`,
                        { collectFilter: { projectUuids: [proj.id] } },
                        { headers: getHeaders(config), httpsAgent, timeout: 90000 } // Pass config here
                    );
                    exportId = createRes.data.data.id;
                } catch (err) {
                    if (err.response && err.response.status === 401) {
                        activeJobs[jobId].status = 'Failed';
                        activeJobs[jobId].error = 'Lightwheel Token Expired! Please refresh in Admin Settings.';
                        console.error("🚨 Lightwheel 401 Unauthorized - Token Expired");
                        return;
                    }

                    console.warn(`[QC Sync] ${proj.name} Create attempt ${createAttempts} failed: ${err.message}`);
                    if (createAttempts >= 3) {
                        throw new Error(`Failed to create export for ${proj.name}. (${err.message})`);
                    }
                    await new Promise(resolve => setTimeout(resolve, 3000));
                }
            }

            // --- B. Poll for Download URL ---
            activeJobs[jobId].status = `${prefix}Waiting for ZIP compilation...`;
            let downloadUrl = null;

            for (let i = 0; i < 40; i++) {
                await new Promise(resolve => setTimeout(resolve, 5000));

                try {
                    const listRes = await axios.post(
                        `${config.lightwheelQcApi}/list`,
                        { page: 1, pageSize: 20 },
                        { headers: getHeaders(config), httpsAgent, timeout: 60000 } // Pass config here
                    );

                    const match = listRes.data.data.find(item => item.id === exportId);

                    if (match && match.downloadUrl) {
                        downloadUrl = match.downloadUrl;
                        break;
                    }

                    activeJobs[jobId].status = `${prefix}Compiling ZIP... (Attempt ${i + 1})`;
                } catch (pollError) {
                    if (pollError.response && pollError.response.status === 401) {
                        activeJobs[jobId].status = 'Failed';
                        activeJobs[jobId].error = 'Lightwheel Token Expired! Please refresh in Admin Settings.';
                        return;
                    }
                    console.warn(`[QC Sync] Polling attempt ${i + 1} timed out. Retrying...`);
                }
            }

            if (!downloadUrl) throw new Error(`${proj.name} Export Timeout: ZIP never finished.`);

            // --- C. Download ZIP ---
            activeJobs[jobId].status = `${prefix}Downloading ZIP...`;
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
                    if (downloadAttempts > 1) {
                        activeJobs[jobId].status = `${prefix}Downloading ZIP... (Attempt ${downloadAttempts})`;
                    }
                    zipRes = await axios.get(downloadUrl, {
                        responseType: 'stream',
                        headers: downloadHeaders,
                        timeout: 300000
                    });
                } catch (err) {
                    if (downloadAttempts >= 3) throw new Error(`Failed to download ${proj.name}. (${err.message})`);
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
            }

            // --- D. Stream Data into MongoDB ---
            activeJobs[jobId].status = `${prefix}Processing Data...`;

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
                    activeJobs[jobId].progress = totalProcessed;
                    batch = [];
                }
            }

            if (batch.length > 0) {
                await AllRecord.bulkWrite(batch, { ordered: false });
                totalProcessed += batch.length;
                activeJobs[jobId].progress = totalProcessed;
            }

            if (pIndex < projects.length - 1) {
                activeJobs[jobId].status = `${proj.name} done. Preparing next project...`;
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }

        // 5. UPDATE LAST SYNCED TIMESTAMP
        await AppConfig.findOneAndUpdate(
            { configId: 'global_settings' },
            { lastQcSync: new Date() }
        );

        activeJobs[jobId].status = 'Completed';

    } catch (error) {
        let errorMessage = "An unknown error occurred.";
        if (error.response && error.response.data) {
            errorMessage = `Lightwheel API Error: ${JSON.stringify(error.response.data)}`;
        } else if (error.message) {
            errorMessage = error.message;
        }

        console.error("\n🚨 --- QC SYNC CRASH REPORT --- 🚨\n", errorMessage, "\n----------------------------------");
        activeJobs[jobId].status = 'Failed';
        activeJobs[jobId].error = errorMessage;
    }
};

export const getJobStatus = (req, res) => {
    const { jobId } = req.params;
    const job = activeJobs[jobId];

    if (!job) {
        return res.status(404).json({ error: "Job not found" });
    }

    res.json(job);
};

// --- NEW: Check Pending Translations ---
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

// --- NEW: Trigger Background Translation (Armored Version) ---
export const triggerTranslation = async (req, res) => {
    const jobId = `trans_${Date.now()}`;
    activeJobs[jobId] = { status: 'Initializing Translation Engine...', progress: 0, total: 0 };
    res.status(202).json({ message: "Translation Queue Started", jobId });

    try {
        const recordsToTranslate = await AllRecord.find({
            inspect_result: 'INSPECT_FAILED',
            $or: [
                { inspect_issue_description_en: { $exists: false } },
                { inspect_issue_description_en: null }
            ]
        }).select('_id data_name inspect_issue_description');

        activeJobs[jobId].total = recordsToTranslate.length;

        if (recordsToTranslate.length === 0) {
            activeJobs[jobId].status = 'Completed';
            return;
        }

        activeJobs[jobId].status = `Translating ${recordsToTranslate.length} records...`;

        let processed = 0;
        let consecutiveFailures = 0; // The Circuit Breaker counter

        for (const record of recordsToTranslate) {
            let updateData = {};
            let success = false;
            let attempts = 0;

            // RETRY LOOP: Try up to 3 times per record
            while (attempts < 3 && !success) {
                try {
                    attempts++;
                    
                    // EXPONENTIAL BACKOFF: Wait 500ms on attempt 1, 1500ms on attempt 2, etc.
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
                    consecutiveFailures = 0; // Reset the breaker on a successful translation

                } catch (err) {
                    if (attempts >= 3) {
                        console.warn(`[Translate] Failed on row ID: ${record._id}. Giving up on this row.`);
                        consecutiveFailures++;
                    }
                }
            }

            processed++;
            activeJobs[jobId].progress = processed;

            // CIRCUIT BREAKER: If 5 rows fail completely in a row, Google has rate-limited us.
            // Halt the entire job to protect the server's IP address.
            if (consecutiveFailures >= 5) {
                throw new Error("Google API Rate Limited. Engine paused to protect IP address. Try again in 30 minutes.");
            }
        }

        activeJobs[jobId].status = 'Completed';

    } catch (error) {
        console.error("Translation Engine Halted:", error.message);
        activeJobs[jobId].status = 'Failed';
        activeJobs[jobId].error = error.message;
    }
};