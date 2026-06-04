import AllRecord from '../models/AllRecords.js';
import TeamMap from '../models/TeamMap.js';

export const getDashboardSummary = async (req, res) => {
    const { category, startDate, endDate, teamName } = req.query;

    try {
        const filter = {};

        if (category && category !== 'ALL') {
            filter.project_category = category;
        }

        if (startDate && endDate) {
            // FIX: Changed 'matchFilter' to 'filter'
            filter.start_produce_time = {
                $gte: new Date(`${startDate}T00:00:00.000Z`),
                $lte: new Date(`${endDate}T23:59:59.999Z`)
            };
        }

        if (teamName && teamName !== 'ALL') {
            const teamMembers = await TeamMap.find({ teamName });
            const targetProducers = teamMembers.map(member => member.username);

            if (targetProducers.length === 0) {
                return res.json({
                    accepted: { count: 0, hours: 0 },
                    rejected: { count: 0, hours: 0 },
                    pending: { count: 0, hours: 0 },
                    total: { count: 0, hours: 0 }
                });
            }
            filter.producer = { $in: targetProducers };
        }

        const stats = await AllRecord.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: "$inspect_result",
                    count: { $sum: 1 },
                    totalDuration: {
                        $sum: {
                            $convert: { input: "$video_duration", to: "double", onError: 0, onNull: 0 }
                        }
                    }
                }
            }
        ]);

        const formatStat = (id) => {
            const stat = stats.find(s => s._id === id);
            return {
                count: stat?.count || 0,
                hours: stat ? parseFloat((stat.totalDuration / 3600).toFixed(2)) : 0
            };
        };

        const formatted = {
            accepted: formatStat('INSPECT_PASSED'),
            rejected: formatStat('INSPECT_FAILED'),
            pending: formatStat('INSPECT_WAITING'),
            total: {
                count: stats.reduce((acc, curr) => acc + curr.count, 0),
                hours: parseFloat((stats.reduce((acc, curr) => acc + curr.totalDuration, 0) / 3600).toFixed(2))
            }
        };

        const latestRecord = await AllRecord.findOne().sort({ start_produce_time: -1 }).select('start_produce_time');

        res.json({
            ...formatted,
            lastUpdated: latestRecord ? latestRecord.start_produce_time : null
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
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
    const { startDate, endDate, teams, viewMode = 'BY_PRODUCER', producer, reason } = req.query;

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

        // 2. Date Filters (Restored your exact logic)
        if (startDate && endDate) {
            initialMatch.start_produce_time = {
                $gte: new Date(`${startDate}T00:00:00.000Z`),
                $lte: new Date(`${endDate}T23:59:59.999Z`)
            };
        }

        // --- CHUNK A: SUMMARY STATS ---
        const statsMatch = { ...initialMatch };
        if (viewMode === 'BY_PRODUCER' && producer && producer !== 'ALL') {
            statsMatch.producer = producer;
        }

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
        
        if (viewMode === 'BY_PRODUCER' && producer && producer !== 'ALL') {
            treeMatch.producer = producer;
        } else if (viewMode === 'BY_REASON' && reason && reason !== 'ALL') {
            treeMatch.inspect_error_type_en = reason; // Restored your exact match logic
        }

        const groupByField = viewMode === 'BY_PRODUCER' ? "$reason" : "$producer";

        const treePromise = AllRecord.aggregate([
            { $match: treeMatch },
            // RESTORED: Fetch English Task Names from DB
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
                    cleanTaskName: { $ifNull: ["$taskDetails.taskName", "$task_name", "Unknown Task"] },
                    reason: { $ifNull: ["$inspect_error_type_en", "Unspecified Reason"] }, // Reason name
                    description: { $ifNull: ["$inspect_issue_description_en", "$inspect_issue_description", "No description provided."] }, // Translated sentence
                    cleanDataName: "$data_name" // Original Video ID
                }
            },
            {
                $group: {
                    _id: { topLevel: groupByField, taskName: "$cleanTaskName" },
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
            // OPTIMIZATION: Max 50 videos per task to prevent UI freezing
            {
                $project: {
                    topLevel: "$_id.topLevel",
                    taskName: "$_id.taskName",
                    taskFailCount: 1,
                    videos: { $slice: ["$videos", 50] } 
                }
            },
            {
                $group: {
                    _id: "$topLevel",
                    totalFailures: { $sum: "$taskFailCount" },
                    tasks: {
                        $push: {
                            taskName: "$taskName",
                            failCount: "$taskFailCount",
                            videos: "$videos"
                        }
                    }
                }
            },
            { $sort: { totalFailures: -1 } },
            {
                $project: {
                    title: { $ifNull: ["$_id", "Unknown"] },
                    _id: 0,
                    totalFailures: 1,
                    tasks: 1
                }
            }
        ]);

        // --- CHUNK C: DYNAMIC EXTRACTION OF REASONS ---
        const reasonsPromise = AllRecord.distinct("inspect_error_type_en", {
            ...initialMatch,
            inspect_result: 'INSPECT_FAILED'
        });

        // Execute all 3 database queries simultaneously
        const [statsResult, rejectionTree, rawReasons] = await Promise.all([statsPromise, treePromise, reasonsPromise]);

        const stats = statsResult.length > 0 ? statsResult[0] : {
            totalVideos: 0, qcDone: 0, accepted: 0, rejected: 0, waiting: 0
        };

        const dynamicReasons = rawReasons.filter(r => r).sort();

        res.json({
            stats,
            rejectionTree,
            dynamicReasons
        });

    } catch (error) {
        console.error("QC Details Error:", error);
        res.status(500).json({ error: error.message });
    }
};