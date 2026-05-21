import axios from 'axios';
import https from 'https';
import Task from '../models/Task.js';
import AppConfig from '../models/AppConfig.js'; // 1. Import our new Config model

const httpsAgent = new https.Agent({ 
    keepAlive: true,
    rejectUnauthorized: false
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

export const getTasks = async (req, res) => {
    try {
        const tasks = await Task.find().sort({ taskId: 1 });
        res.json(tasks);
    } catch (error) {
        console.error("Database Fetch Error:", error);
        res.status(500).json({ error: 'Failed to fetch tasks from database' });
    }
};

export const syncTasks = async (req, res) => {
    const { projects } = req.body; 

    try {
        // 3. Fetch settings from DB instead of .env
        const config = await AppConfig.findOne({ configId: 'global_settings' });
        
        if (!config || !config.lightwheelToken) {
            return res.status(400).json({ error: 'Missing Lightwheel API Token. Please update Admin Settings.' });
        }

        let batch = [];

        for (let i = 0; i < projects.length; i++) {
            const proj = projects[i];
            console.log(`[Sync] Fetching project: ${proj.category} (${proj.id})...`);
            
            let response = null;
            let attempts = 0;

            while (attempts < 3 && !response) {
                try {
                    attempts++;
                    response = await axios.post(
                        config.lightwheelTaskApi, // Using DB configured API URL
                        { page: 1, pageSize: 500, projectId: proj.id },
                        { httpsAgent, timeout: 60000, headers: getHeaders(config) }
                    );
                } catch (err) {
                    // 4. INTERCEPT 401 UNAUTHORIZED INSTANTLY
                    if (err.response && err.response.status === 401) {
                        console.error('🚨 Lightwheel Token Expired during Task Sync!');
                        return res.status(401).json({ error: 'Lightwheel API Token Expired. Please refresh it in Admin Settings.' });
                    }

                    console.warn(`[Sync] Attempt ${attempts} failed for ${proj.category}: ${err.message}`);
                    if (attempts >= 3) throw err; 
                    await new Promise(resolve => setTimeout(resolve, 4000));
                }
            }

            const lightwheelTasks = response.data?.data;
            if (!lightwheelTasks || !Array.isArray(lightwheelTasks)) continue;

            lightwheelTasks.forEach(task => {
                const englishData = task.platformTask?.i18n?.English || {};
                batch.push({
                    updateOne: {
                        filter: { uuid: task.uuid },
                        update: {
                            $set: {
                                uuid: task.uuid, 
                                taskId: task.platformTask?.taskId?.toString() || 'UNKNOWN',
                                taskName: englishData.name || 'Unknown Task',
                                description: englishData.description || '',
                                category: proj.category,
                                pulledNum: task.pulledNum || 0,
                                totalNum: task.totalNum || 0,
                                status: task.platformTask?.status ? task.platformTask.status.replace('PLATFORM_TASK_STATUS_', '') : 'UNKNOWN',
                                initialData: englishData.metadata?.initial || 'No initial data provided.',
                                goalData: englishData.metadata?.goal || 'No goal data provided.'
                            }
                        },
                        upsert: true
                    }
                });
            });

            if (i < projects.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }

        if (batch.length > 0) {
            let dbAttempts = 0;
            let dbSuccess = false;
            while (dbAttempts < 3 && !dbSuccess) {
                try {
                    dbAttempts++;
                    await Task.bulkWrite(batch, { ordered: false });
                    dbSuccess = true;
                } catch (dbErr) {
                    if (dbAttempts >= 3) throw new Error(`MongoDB failed after 3 attempts. Last error: ${dbErr.message}`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        }

        // 5. Update the "Last Synced" timestamp in the DB
        await AppConfig.findOneAndUpdate(
            { configId: 'global_settings' }, 
            { lastTaskSync: new Date() }
        );

        res.json({ message: 'Tasks successfully synchronized with Lightwheel!' });

    } catch (error) {
        if (error.code === 'ECONNABORTED') {
            console.error('🚨 Connection to Lightwheel timed out.');
        } else {
            console.error('🚨 Sync Error:', error.message);
        }
        res.status(500).json({ error: 'Failed to sync tasks', details: error.message });
    }
};