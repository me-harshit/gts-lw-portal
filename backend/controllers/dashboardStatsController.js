import AllRecord from '../models/AllRecords.js';
import TeamMap from '../models/TeamMap.js';

export const getDashboardSummary = async (req, res) => {
    try {
        const { category, teams, startDate, endDate } = req.query;
        let match = { start_produce_time: { $exists: true, $ne: null } };

        // 1. Filter by Project Category (Office vs House)
        if (category && category !== 'ALL') {
            match.project_category = new RegExp(category, 'i');
        }

        // 2. Smart Team/Tag/Shift Filtering
        if (teams && teams !== 'ALL') {
            if (teams === '___NONE___') {
                match.producer = { $in: [] }; 
            } else {
                const teamArray = teams.split(',');
                const mappings = await TeamMap.find({ teamName: { $in: teamArray } }).lean();
                match.producer = { $in: mappings.map(m => m.username) };
            }
        }

        // 3. Date Filtering
        if (startDate && endDate) {
            match.start_produce_time = {
                $gte: new Date(`${startDate}T00:00:00.000Z`),
                $lte: new Date(`${endDate}T23:59:59.999Z`)
            };
        }

        const result = await AllRecord.aggregate([
            { $match: match },
            {
                $addFields: {
                    safe_video_duration: { $convert: { input: "$video_duration", to: "double", onError: 0, onNull: 0 } }
                }
            },
            {
                $group: {
                    _id: null,
                    totalCount: { $sum: 1 },
                    totalHours: { $sum: "$safe_video_duration" },
                    acceptedCount: { $sum: { $cond: [{ $eq: ["$inspect_result", "INSPECT_PASSED"] }, 1, 0] } },
                    acceptedHours: { $sum: { $cond: [{ $eq: ["$inspect_result", "INSPECT_PASSED"] }, "$safe_video_duration", 0] } },
                    rejectedCount: { $sum: { $cond: [{ $eq: ["$inspect_result", "INSPECT_FAILED"] }, 1, 0] } },
                    rejectedHours: { $sum: { $cond: [{ $eq: ["$inspect_result", "INSPECT_FAILED"] }, "$safe_video_duration", 0] } },
                    pendingCount: { $sum: { $cond: [{ $eq: ["$inspect_result", "INSPECT_WAITING"] }, 1, 0] } },
                    pendingHours: { $sum: { $cond: [{ $eq: ["$inspect_result", "INSPECT_WAITING"] }, "$safe_video_duration", 0] } }
                }
            }
        ]);

        const data = result[0] || {
            totalCount: 0, totalHours: 0,
            acceptedCount: 0, acceptedHours: 0,
            rejectedCount: 0, rejectedHours: 0,
            pendingCount: 0, pendingHours: 0
        };

        // Note: Returning hours by dividing seconds by 3600
        res.json({
            total: { count: data.totalCount, hours: data.totalHours / 3600 },
            accepted: { count: data.acceptedCount, hours: data.acceptedHours / 3600 },
            rejected: { count: data.rejectedCount, hours: data.rejectedHours / 3600 },
            pending: { count: data.pendingCount, hours: data.pendingHours / 3600 }
        });
    } catch (err) {
        console.error("Project Summary Error:", err);
        res.status(500).json({ error: err.message });
    }
};

export const getProducerHistory = async (req, res) => {
    const { username } = req.params;
    const { category, startDate, endDate } = req.query;

    try {
        const teamMap = await TeamMap.findOne({ username });
        const teamName = teamMap ? teamMap.teamName : 'Unassigned';

        const filter = { producer: username };
        if (category && category !== 'ALL') filter.project_category = category;

        if (startDate && endDate) {
            filter.start_produce_time = {
                $gte: new Date(`${startDate}T00:00:00.000Z`),
                $lte: new Date(`${endDate}T23:59:59.999Z`)
            };
        }

        const taskGroups = await AllRecord.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: "$platform_task_id",
                    originalTaskName: { $first: "$task_name" }, // Save original in case of missing DB match
                    totalVideos: { $sum: 1 },
                    totalSec: { $sum: { $convert: { input: "$video_duration", to: "double", onError: 0, onNull: 0 } } },
                    acceptedSec: { $sum: { $cond: [{ $eq: ["$inspect_result", "INSPECT_PASSED"] }, { $convert: { input: "$video_duration", to: "double", onError: 0, onNull: 0 } }, 0] } },
                    waitingSec: { $sum: { $cond: [{ $eq: ["$inspect_result", "INSPECT_WAITING"] }, { $convert: { input: "$video_duration", to: "double", onError: 0, onNull: 0 } }, 0] } },
                    rejectedSec: { $sum: { $cond: [{ $eq: ["$inspect_result", "INSPECT_FAILED"] }, { $convert: { input: "$video_duration", to: "double", onError: 0, onNull: 0 } }, 0] } },
                    passedVideos: { $sum: { $cond: [{ $eq: ["$inspect_result", "INSPECT_PASSED"] }, 1, 0] } },
                    failedVideos: { $sum: { $cond: [{ $eq: ["$inspect_result", "INSPECT_FAILED"] }, 1, 0] } },
                    waitingVideos: { $sum: { $cond: [{ $eq: ["$inspect_result", "INSPECT_WAITING"] }, 1, 0] } }
                }
            },
            // 1. Join with the tasks collection
            {
                $lookup: {
                    from: "tasks", // MongoDB automatically lowercases & pluralizes 'Task' to 'tasks'
                    localField: "_id", // The platform_task_id from the group stage
                    foreignField: "taskId", // The field in your new Task model
                    as: "taskDetails"
                }
            },
            // 2. Deconstruct the array returned by $lookup
            {
                $unwind: {
                    path: "$taskDetails",
                    preserveNullAndEmptyArrays: true // Keep records even if the task isn't in the DB yet
                }
            },
            // 3. Overwrite the taskName with the English DB name, fallback to original if null
            {
                $addFields: {
                    taskName: { $ifNull: ["$taskDetails.taskName", "$originalTaskName"] }
                }
            },
            // 4. Clean up the final object payload
            {
                $project: {
                    taskDetails: 0,
                    originalTaskName: 0
                }
            },
            { $sort: { totalSec: -1 } }
        ]);

        let totalSec = 0, acceptedSec = 0, rejectedSec = 0, waitingSec = 0;

        taskGroups.forEach(group => {
            totalSec += group.totalSec;
            acceptedSec += group.acceptedSec;
            waitingSec += group.waitingSec;
            rejectedSec += group.rejectedSec;
        });

        res.json({
            username,
            teamName,
            stats: { totalSec, acceptedSec, rejectedSec, waitingSec },
            tasks: taskGroups
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


export const getQcDetails = async (req, res) => {
    const { startDate, endDate, teams, viewMode = 'BY_PRODUCER', producer, reason, taskId } = req.query;

    try {
        let initialMatch = { start_produce_time: { $exists: true, $ne: null } };

        // 1. Smart Team Filter via TeamMap
        if (teams && teams !== 'ALL') {
            if (teams === '___NONE___') {
                initialMatch.producer = { $in: [] }; 
            } else {
                const teamArray = teams.split(',');
                const mappings = await TeamMap.find({ teamName: { $in: teamArray } }).lean();
                initialMatch.producer = { $in: mappings.map(m => m.username) };
            }
        }

        // 2. Date Filters
        if (startDate && endDate) {
            initialMatch.start_produce_time = {
                $gte: new Date(`${startDate}T00:00:00.000Z`),
                $lte: new Date(`${endDate}T23:59:59.999Z`)
            };
        }

        // --- CHUNK A: SUMMARY STATS ---
        const statsMatch = { ...initialMatch };
        if (viewMode === 'BY_PRODUCER' && producer && producer !== 'ALL') statsMatch.producer = producer;
        if (viewMode === 'BY_REASON' && reason && reason !== 'ALL') statsMatch.inspect_issue_description_en = reason;
        if (viewMode === 'BY_TASK' && taskId && taskId !== 'ALL') statsMatch.platform_task_id = taskId;

        const statsPromise = AllRecord.aggregate([
            { $match: statsMatch },
            {
                $group: {
                    _id: null,
                    totalVideos: { $sum: 1 },
                    accepted: { $sum: { $cond: [{ $eq: ["$inspect_result", "INSPECT_PASSED"] }, 1, 0] } },
                    rejected: { $sum: { $cond: [{ $eq: ["$inspect_result", "INSPECT_FAILED"] }, 1, 0] } },
                    waiting: { $sum: { $cond: [{ $eq: ["$inspect_result", "INSPECT_WAITING"] }, 1, 0] } }
                }
            },
            {
                $project: {
                    _id: 0,
                    totalVideos: 1,
                    accepted: 1,
                    rejected: 1,
                    waiting: 1,
                    qcDone: { $add: ["$accepted", "$rejected"] }
                }
            }
        ]);

        // --- CHUNK B: NESTED REJECTION TREE ---
        const treeMatch = { ...initialMatch, inspect_result: 'INSPECT_FAILED' };
        
        if (viewMode === 'BY_PRODUCER' && producer && producer !== 'ALL') treeMatch.producer = producer;
        else if (viewMode === 'BY_REASON' && reason && reason !== 'ALL') treeMatch.inspect_issue_description_en = reason;
        else if (viewMode === 'BY_TASK' && taskId && taskId !== 'ALL') treeMatch.platform_task_id = taskId;

        let groupByField, subGroupField;
        if (viewMode === 'BY_REASON') {
            groupByField = "$reason";
            subGroupField = "$cleanTaskName";
        } else if (viewMode === 'BY_TASK') {
            groupByField = "$cleanTaskName";
            subGroupField = "$reason"; // Show reason as sub-level for tasks
        } else { 
            groupByField = "$producer";
            subGroupField = "$cleanTaskName";
        }

        const treePromise = AllRecord.aggregate([
            { $match: treeMatch },
            {
                $lookup: {
                    from: "tasks",
                    localField: "platform_task_id",
                    foreignField: "taskId",
                    as: "taskDetails"
                }
            },
            { $unwind: { path: "$taskDetails", preserveNullAndEmptyArrays: true } },
            {
                $addFields: {
                    rawTaskName: { $ifNull: ["$taskDetails.taskName", "$task_name", "Unknown Task"] },
                    taskIdStr: { $ifNull: ["$platform_task_id", "No-ID"] },
                    reason: { $ifNull: ["$inspect_issue_description_en", "$inspect_issue_description", "Unspecified Reason"] }, 
                    description: { $ifNull: ["$inspect_issue_description", "No description provided."] }, // Fallback to original
                    cleanDataName: { $ifNull: ["$data_name_en", "$data_name"] }
                }
            },
            {
                $addFields: {
                    cleanTaskName: { $concat: ["$taskIdStr", " - ", "$rawTaskName"] }
                }
            },
            {
                $group: {
                    _id: { topLevel: groupByField, subLevel: subGroupField },
                    taskFailCount: { $sum: 1 },
                    videos: {
                        $push: {
                            dataName: "$cleanDataName", 
                            description: "$description",
                            producer: "$producer" 
                        }
                    }
                }
            },
            {
                $project: {
                    topLevel: "$_id.topLevel",
                    subLevel: "$_id.subLevel",
                    taskFailCount: 1,
                    videos: { $slice: ["$videos", 50] } 
                }
            },
            // --- NEW: Forces sub-levels (Reasons) to be sorted by highest failure count ---
            { $sort: { taskFailCount: -1 } },
            {
                $group: {
                    _id: "$topLevel",
                    totalFailures: { $sum: "$taskFailCount" },
                    tasks: {
                        $push: {
                            taskName: "$subLevel", 
                            failCount: "$taskFailCount",
                            videos: "$videos"
                        }
                    }
                }
            },
            // Sorts the Top Levels by highest failure count
            { $sort: { totalFailures: -1 } },
            { $limit: 100 },
            {
                $project: {
                    title: { $ifNull: ["$_id", "Unknown"] },
                    _id: 0,
                    totalFailures: 1,
                    tasks: 1
                }
            }
        ]);

        // --- CHUNK C: DYNAMIC EXTRACTION OF DROPDOWN OPTIONS ---
        const reasonsPromise = AllRecord.distinct("inspect_issue_description_en", {
            ...initialMatch,
            inspect_result: 'INSPECT_FAILED'
        });

        const tasksPromise = AllRecord.aggregate([
            { $match: { ...initialMatch, inspect_result: 'INSPECT_FAILED' } },
            {
                $lookup: {
                    from: "tasks",
                    localField: "platform_task_id",
                    foreignField: "taskId",
                    as: "taskDetails"
                }
            },
            { $unwind: { path: "$taskDetails", preserveNullAndEmptyArrays: true } },
            {
                $group: {
                    _id: "$platform_task_id",
                    name: { $first: { $ifNull: ["$taskDetails.taskName", "$task_name", "Unknown Task"] } }
                }
            },
            { $project: { _id: 0, id: "$_id", name: "$name" } }
        ]);

        const [statsResult, rejectionTree, rawReasons, rawTasks] = await Promise.all([statsPromise, treePromise, reasonsPromise, tasksPromise]);

        const stats = statsResult.length > 0 ? statsResult[0] : {
            totalVideos: 0, qcDone: 0, accepted: 0, rejected: 0, waiting: 0
        };

        const dynamicReasons = rawReasons.filter(r => r).sort();
        const dynamicTasks = rawTasks.filter(t => t.id).map(t => ({ id: t.id, name: `${t.id} - ${t.name}` })).sort((a,b) => a.name.localeCompare(b.name));

        res.json({
            stats,
            rejectionTree,
            dynamicReasons,
            dynamicTasks
        });

    } catch (error) {
        console.error("QC Details Error:", error);
        res.status(500).json({ error: error.message });
    }
};