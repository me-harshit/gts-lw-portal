import axios from 'axios';
import https from 'https';
import Task from '../models/Task.js';
import AppConfig from '../models/AppConfig.js';
import { globalSyncState, updateSyncState, finishSync, errorSync } from '../utils/syncLock.js';
import { getEnabledKeys, buildCategoryMatch, getSyncProjects } from '../utils/enabledProjects.js';

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
        // Global gate: only tasks belonging to currently-enabled projects are ever returned.
        const tasks = await Task.find({ category: { $in: await getEnabledKeys() } }).sort({ taskId: 1 });
        res.json(tasks);
    } catch (error) {
        console.error("Database Fetch Error:", error);
        res.status(500).json({ error: 'Failed to fetch tasks from database' });
    }
};

export const syncTasks = async (req, res) => {
    if (globalSyncState.isSyncing) {
        return res.status(409).json({ error: 'A sync operation is already in progress globally.' });
    }

    const bodyProjects = req.body?.projects;

    updateSyncState({
        isSyncing: true,
        type: 'TASK',
        message: 'Initializing Task Sync...',
        progress: 0
    });

    res.status(202).json({ message: 'Task Sync Queued' });

    (async () => {
        try {
            const config = await AppConfig.findOne({ configId: 'global_settings' });

            if (!config || !config.lightwheelToken) {
                throw new Error('Missing Lightwheel API Token. Please update Admin Settings.');
            }

            // Derive the project list from the registry (all enabled) unless callers pass an
            // explicit list. Disabled projects are never synced — enforced server-side.
            const projects = (Array.isArray(bodyProjects) && bodyProjects.length > 0)
                ? bodyProjects
                : await getSyncProjects();

            if (!projects || projects.length === 0) {
                throw new Error('No enabled projects to sync. Add or enable a project in Manage Projects.');
            }

            const existingTasksRaw = await Task.find({}, { uuid: 1, goalData: 1 }).lean();
            const existingGoalMap = new Map(existingTasksRaw.map(t => [t.uuid, t.goalData]));

            let batch = [];

            for (let i = 0; i < projects.length; i++) {
                const proj = projects[i];
                updateSyncState({ message: `Fetching project: ${proj.category}...` });
                
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
                    const newGoalData = englishData.metadata?.goal || 'No goal data provided.';
                    const existingGoal = existingGoalMap.get(task.uuid);
                    const isActive = (task.pulledNum || 0) > 0 && (task.pulledNum || 0) < (task.totalNum || 0);
                    const goalChanged = isActive && existingGoal !== undefined && existingGoal !== newGoalData;

                    const updateDoc = {
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
                            goalData: newGoalData
                        }
                    };

                    if (goalChanged) {
                        updateDoc.$push = { goalVersions: { value: existingGoal, changedAt: new Date() } };
                    }

                    batch.push({
                        updateOne: {
                            filter: { uuid: task.uuid },
                            update: updateDoc,
                            upsert: true
                        }
                    });
                });

                if (i < projects.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 3000));
                }
            }

            if (batch.length > 0) {
                updateSyncState({ message: `Saving ${batch.length} tasks to database...` });

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

            finishSync('Tasks successfully synchronized!');

        } catch (error) {
            errorSync(error.message);
        }
    })();
};

export const getGoalAnomalies = async (req, res) => {
    try {
        const { category } = req.query;
        // buildCategoryMatch resolves a specific enabled category, or all enabled keys, and
        // always excludes disabled projects.
        const query = {
            'goalVersions.0': { $exists: true },
            category: await buildCategoryMatch(category),
            pulledNum: { $gt: 0 },
            $expr: { $lt: ['$pulledNum', '$totalNum'] }
        };

        const tasks = await Task.find(query)
            .select('taskId taskName category goalData goalVersions updatedAt')
            .sort({ taskId: 1 })
            .lean();

        res.json({ tasks, total: tasks.length });
    } catch (error) {
        console.error('getGoalAnomalies error:', error);
        res.status(500).json({ error: 'Failed to fetch goal anomalies' });
    }
};