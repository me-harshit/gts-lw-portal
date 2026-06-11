import AllRecord from '../models/AllRecords.js';
import TeamMap from '../models/TeamMap.js';

export const getDashboardSummary = async (req, res) => {
    try {
        const { category, teams, startDate, endDate } = req.query;
        let baseMatch = { start_produce_time: { $exists: true, $ne: null } };

        if (category && category !== 'ALL') baseMatch.project_category = new RegExp(category, 'i');

        if (teams && teams !== 'ALL') {
            if (teams === '___NONE___') {
                baseMatch.producer = { $in: [] };
            } else {
                const teamArray = teams.split(',');
                const mappings = await TeamMap.find({ teamName: { $in: teamArray } }).lean();
                baseMatch.producer = { $in: mappings.map(m => m.username) };
            }
        }

        // 1. TOP STATS CARDS: Listens to UI Date Filters (Strict Beijing Time +08:00)
        let statsMatch = { ...baseMatch };
        if (startDate && endDate) {
            statsMatch.start_produce_time = {
                $gte: new Date(`${startDate}T00:00:00.000+08:00`),
                $lte: new Date(`${endDate}T23:59:59.999+08:00`)
            };
        }

        // 2. DAILY TREND TABLE: Permanently locked to Last 10 Days in Beijing Time
        const bjgNow = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Shanghai"}));
        const bjg10DaysAgo = new Date(bjgNow);
        bjg10DaysAgo.setDate(bjg10DaysAgo.getDate() - 9); 
        const startOf10DaysStr = `${bjg10DaysAgo.getFullYear()}-${String(bjg10DaysAgo.getMonth() + 1).padStart(2, '0')}-${String(bjg10DaysAgo.getDate()).padStart(2, '0')}T00:00:00.000+08:00`;
        
        const trendMatch = { ...baseMatch, start_produce_time: { $gte: new Date(startOf10DaysStr) } };

        // Aggregate Top Stats Cards
        const statsPromise = AllRecord.aggregate([
            { $match: statsMatch },
            { $addFields: { safe_video_duration: { $convert: { input: "$video_duration", to: "double", onError: 0, onNull: 0 } } } },
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

        // Aggregate Daily Trend Table
        const trendPromise = AllRecord.aggregate([
            { $match: trendMatch },
            {
                $addFields: {
                    safe_video_duration: { $convert: { input: "$video_duration", to: "double", onError: 0, onNull: 0 } },
                    bjg_date: { $dateToString: { format: "%Y-%m-%d", date: "$start_produce_time", timezone: "+08:00" } }
                }
            },
            {
                $group: {
                    _id: "$bjg_date",
                    uniqueProducers: { $addToSet: "$producer" },
                    totalCount: { $sum: 1 },
                    totalHours: { $sum: "$safe_video_duration" },
                    acceptedCount: { $sum: { $cond: [{ $eq: ["$inspect_result", "INSPECT_PASSED"] }, 1, 0] } },
                    acceptedHours: { $sum: { $cond: [{ $eq: ["$inspect_result", "INSPECT_PASSED"] }, "$safe_video_duration", 0] } },
                    rejectedCount: { $sum: { $cond: [{ $eq: ["$inspect_result", "INSPECT_FAILED"] }, 1, 0] } },
                    rejectedHours: { $sum: { $cond: [{ $eq: ["$inspect_result", "INSPECT_FAILED"] }, "$safe_video_duration", 0] } },
                    pendingCount: { $sum: { $cond: [{ $eq: ["$inspect_result", "INSPECT_WAITING"] }, 1, 0] } },
                    pendingHours: { $sum: { $cond: [{ $eq: ["$inspect_result", "INSPECT_WAITING"] }, "$safe_video_duration", 0] } }
                }
            },
            { $sort: { _id: -1 } }
        ]);

        const [statsResult, trendResult] = await Promise.all([statsPromise, trendPromise]);

        const data = statsResult[0] || {
            totalCount: 0, totalHours: 0, acceptedCount: 0, acceptedHours: 0,
            rejectedCount: 0, rejectedHours: 0, pendingCount: 0, pendingHours: 0
        };

        const formattedTrend = trendResult.map(day => ({
            date: day._id,
            activeProducers: day.uniqueProducers ? day.uniqueProducers.length : 0,
            total: { count: day.totalCount, hours: day.totalHours / 3600 },
            accepted: { count: day.acceptedCount, hours: day.acceptedHours / 3600 },
            rejected: { count: day.rejectedCount, hours: day.rejectedHours / 3600 },
            pending: { count: day.pendingCount, hours: day.pendingHours / 3600 }
        }));

        res.json({
            total: { count: data.totalCount, hours: data.totalHours / 3600 },
            accepted: { count: data.acceptedCount, hours: data.acceptedHours / 3600 },
            rejected: { count: data.rejectedCount, hours: data.rejectedHours / 3600 },
            pending: { count: data.pendingCount, hours: data.pendingHours / 3600 },
            trend: formattedTrend
        });
    } catch (err) {
        console.error("Project Summary Error:", err);
        res.status(500).json({ error: err.message });
    }
};

export const getProducerHistory = async (req, res) => {
    try {
        const { username } = req.params;
        const { category, startDate, endDate } = req.query;

        // Base match for the specific producer
        let match = { producer: username, start_produce_time: { $exists: true, $ne: null } };

        if (category && category !== 'ALL') {
            match.project_category = new RegExp(category, 'i');
        }

        if (startDate && endDate) {
            match.start_produce_time = {
                $gte: new Date(`${startDate}T00:00:00.000Z`),
                $lte: new Date(`${endDate}T23:59:59.999Z`)
            };
        }

        // Fetch team mapping for the UI banner
        const teamMapping = await TeamMap.findOne({ username }).lean();
        const teamName = teamMapping ? teamMapping.teamName : 'Unassigned';

        // 1. Get Top-Level Stats for the Producer
        const statsPromise = AllRecord.aggregate([
            { $match: match },
            { $addFields: { safe_duration: { $convert: { input: "$video_duration", to: "double", onError: 0, onNull: 0 } } } },
            {
                $group: {
                    _id: null,
                    totalSec: { $sum: "$safe_duration" },
                    acceptedSec: { $sum: { $cond: [{ $eq: ["$inspect_result", "INSPECT_PASSED"] }, "$safe_duration", 0] } },
                    rejectedSec: { $sum: { $cond: [{ $eq: ["$inspect_result", "INSPECT_FAILED"] }, "$safe_duration", 0] } },
                    waitingSec: { $sum: { $cond: [{ $eq: ["$inspect_result", "INSPECT_WAITING"] }, "$safe_duration", 0] } }
                }
            }
        ]);

        // 2. Break down stats by Task (Combining Task ID and Task Name via Lookup)
        const tasksPromise = AllRecord.aggregate([
            { $match: match },
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
                    safe_duration: { $convert: { input: "$video_duration", to: "double", onError: 0, onNull: 0 } },
                    taskName: { $ifNull: ["$taskDetails.taskName", "$task_name", "Unknown"] },
                    taskId: { $ifNull: ["$platform_task_id", "No-ID"] }
                }
            },
            {
                $group: {
                    _id: "$taskId",
                    taskName: { $first: "$taskName" },
                    totalVideos: { $sum: 1 },
                    totalSec: { $sum: "$safe_duration" },
                    passedVideos: { $sum: { $cond: [{ $eq: ["$inspect_result", "INSPECT_PASSED"] }, 1, 0] } },
                    passedSec: { $sum: { $cond: [{ $eq: ["$inspect_result", "INSPECT_PASSED"] }, "$safe_duration", 0] } },
                    failedVideos: { $sum: { $cond: [{ $eq: ["$inspect_result", "INSPECT_FAILED"] }, 1, 0] } },
                    failedSec: { $sum: { $cond: [{ $eq: ["$inspect_result", "INSPECT_FAILED"] }, "$safe_duration", 0] } },
                    waitingVideos: { $sum: { $cond: [{ $eq: ["$inspect_result", "INSPECT_WAITING"] }, 1, 0] } },
                    waitingSec: { $sum: { $cond: [{ $eq: ["$inspect_result", "INSPECT_WAITING"] }, "$safe_duration", 0] } }
                }
            },
            { $sort: { totalSec: -1 } } // Sort tasks by most time spent
        ]);

        const [statsRes, tasks] = await Promise.all([statsPromise, tasksPromise]);

        const stats = statsRes[0] || { totalSec: 0, acceptedSec: 0, rejectedSec: 0, waitingSec: 0 };

        res.json({
            teamName,
            stats,
            tasks
        });

    } catch (error) {
        console.error("Producer Analytics Error:", error);
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
                    cleanDataName: { $ifNull: ["$data_name_en", "$data_name"] },

                    englishFeedback: { $ifNull: ["$inspect_issue_description_en", "$inspect_issue_description"] },
                    originalName: "$data_name"
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
                            producer: "$producer",

                            // <-- NEW: Push the new mapped fields into the video array so the frontend can read them
                            englishFeedback: "$englishFeedback",
                            originalName: "$originalName"
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
        const dynamicTasks = rawTasks.filter(t => t.id).map(t => ({ id: t.id, name: `${t.id} - ${t.name}` })).sort((a, b) => a.name.localeCompare(b.name));

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