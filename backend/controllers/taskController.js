import axios from 'axios';
import https from 'https';
import Task from '../models/Task.js';
import AppConfig from '../models/AppConfig.js';
import { globalSyncState, ioInstance as io } from '../utils/syncLock.js';

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
    // 1. Check the Global Lock
    if (globalSyncState.isSyncing) {
        return res.status(409).json({ error: 'A sync operation is already in progress globally.' });
    }

    const { projects } = req.body; 

    // 2. Engage the Lock
    globalSyncState.isSyncing = true;
    globalSyncState.type = 'TASK';
    globalSyncState.message = 'Initializing Task Sync...';
    globalSyncState.progress = 0;
    io.emit('sync_update', globalSyncState);

    // 3. Respond instantly so the browser doesn't hang
    res.status(202).json({ message: 'Task Sync Queued' });

    // 4. Run the heavy logic in the background
    (async () => {
        try {
            const config = await AppConfig.findOne({ configId: 'global_settings' });
            
            if (!config || !config.lightwheelToken) {
                throw new Error('Missing Lightwheel API Token. Please update Admin Settings.');
            }

            let batch = [];

            for (let i = 0; i < projects.length; i++) {
                const proj = projects[i];
                globalSyncState.message = `Fetching project: ${proj.category}...`;
                io.emit('sync_update', globalSyncState);
                
                let response = null;
                let attempts = 0;

                while (attempts < 3 && !response) {
                    try {
                        attempts++;
                        response = await axios.post(
                            config.lightwheelTaskApi, 
                            { page: 1, pageSize: 500, projectId: proj.id },
                            { httpsAgent, timeout: 60000, headers: getHeaders(config) }
                        );
                    } catch (err) {
                        if (err.response && err.response.status === 401) {
                            throw new Error('Lightwheel API Token Expired. Please refresh it in Admin Settings.');
                        }
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
                globalSyncState.message = `Saving ${batch.length} tasks to database...`;
                io.emit('sync_update', globalSyncState);

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

            await AppConfig.findOneAndUpdate(
                { configId: 'global_settings' }, 
                { lastTaskSync: new Date() }
            );

            // 5. Release Lock and Broadcast Success
            globalSyncState.isSyncing = false;
            globalSyncState.message = 'Tasks successfully synchronized!';
            io.emit('sync_finished', globalSyncState);

        } catch (error) {
            // 6. Release Lock and Broadcast Error
            globalSyncState.isSyncing = false;
            io.emit('sync_error', { message: error.message });
            console.error('🚨 Sync Error:', error.message);
        }
    })();
};