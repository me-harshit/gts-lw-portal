import AllRecord from '../models/AllRecords.js';
import TeamMap from '../models/TeamMap.js';
import { getEnabledKeys } from '../utils/enabledProjects.js';

export const getAcceptanceLeaderboard = async (req, res) => {
    try {
        const { startDate, endDate, teams } = req.query;

        let initialMatch = {
            producer: { $exists: true, $ne: "" },
            inspect_result: { $exists: true },
            project_category: { $in: await getEnabledKeys() } // exclude disabled projects
        };

        // --- SMART TEAM FILTERING ---
        if (teams && teams !== 'ALL') {
            if (teams === '___NONE___') {
                initialMatch.producer = { $in: [] };
            } else {
                const teamArray = teams.split(',');
                const mappings = await TeamMap.find({ teamName: { $in: teamArray } }).lean();
                const allowedProducers = mappings.map(m => m.username);
                initialMatch.producer = { $in: allowedProducers };
            }
        }

        // --- STRICT BEIJING TIME FILTERING (+08:00) ---
        if (startDate || endDate) {
            const dateQuery = {};
            if (startDate) dateQuery.$gte = new Date(`${startDate}T00:00:00.000+08:00`);
            if (endDate) dateQuery.$lte = new Date(`${endDate}T23:59:59.999+08:00`);
            initialMatch.start_produce_time = dateQuery;
        }

        const pipeline = [{ $match: initialMatch }];

        pipeline.push({
            $addFields: {
                safe_video_duration: { $convert: { input: "$video_duration", to: "double", onError: 0, onNull: 0 } }
            }
        });

        // AGGREGATE BY PRODUCER
        pipeline.push({
            $group: {
                _id: "$producer",
                acceptedSec: { $sum: { $cond: [{ $eq: ["$inspect_result", "INSPECT_PASSED"] }, "$safe_video_duration", 0] } },
                rejectedSec: { $sum: { $cond: [{ $eq: ["$inspect_result", "INSPECT_FAILED"] }, "$safe_video_duration", 0] } },
                waitingSec: { $sum: { $cond: [{ $eq: ["$inspect_result", "INSPECT_WAITING"] }, "$safe_video_duration", 0] } }
            }
        });

        pipeline.push({
            $project: {
                _id: 0,
                producer: "$_id",
                acceptedSec: 1,
                rejectedSec: 1,
                waitingSec: 1
            }
        });

        // Sort by highest accepted time
        pipeline.push({ $sort: { acceptedSec: -1 } });

        const result = await AllRecord.aggregate(pipeline);
        res.json(result);

    } catch (error) {
        console.error("Leaderboard Error:", error);
        res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
};

export const getPerformanceLeaderboard = async (req, res) => {
    try {
        // Extract category from query
        const { startDate, endDate, teams, category } = req.query;

        let initialMatch = {
            producer: { $exists: true, $ne: "" },
            start_produce_time: { $exists: true, $ne: null }
        };

        // --- NEW PROJECT CATEGORY FILTER ---
        if (category && category !== 'ALL') {
            initialMatch.project_category = new RegExp(category, 'i');
        }

        // Smart Team Filtering
        if (teams && teams !== 'ALL') {
            if (teams === '___NONE___') {
                initialMatch.producer = { $in: [] };
            } else {
                const teamArray = teams.split(',');
                const mappings = await TeamMap.find({ teamName: { $in: teamArray } }).lean();
                initialMatch.producer = { $in: mappings.map(m => m.username) };
            }
        }

        // Strict Beijing Date Filtering
        if (startDate || endDate) {
            initialMatch.start_produce_time = {};
            if (startDate) initialMatch.start_produce_time.$gte = new Date(`${startDate}T00:00:00.000+08:00`);
            if (endDate) initialMatch.start_produce_time.$lte = new Date(`${endDate}T23:59:59.999+08:00`);
        }

        const pipeline = [{ $match: initialMatch }];

        pipeline.push({
            $addFields: {
                safe_video_duration: { $convert: { input: "$video_duration", to: "double", onError: 0, onNull: 0 } },
                working_date: { $dateToString: { format: "%Y-%m-%d", date: "$start_produce_time", timezone: "+08:00" } }
            }
        });

        // Group 1: Daily duration per producer
        pipeline.push({
            $group: {
                _id: { producer: "$producer", date: "$working_date" },
                dailySec: { $sum: "$safe_video_duration" }
            }
        });

        // Group 2: Total duration and active days
        pipeline.push({
            $group: {
                _id: "$_id.producer",
                totalSec: { $sum: "$dailySec" },
                daysWorked: { $sum: 1 }
            }
        });

        pipeline.push({
            $project: {
                _id: 0,
                producer: "$_id",
                totalSec: 1,
                dailyAverageSec: { $divide: ["$totalSec", "$daysWorked"] }
            }
        });

        pipeline.push({ $sort: { dailyAverageSec: -1 } });

        const result = await AllRecord.aggregate(pipeline);
        res.json(result);

    } catch (error) {
        console.error("Performance Leaderboard Error:", error);
        res.status(500).json({ error: "Failed to fetch performance leaderboard" });
    }
};


export const getQcLeaderboard = async (req, res) => {
    try {
        const { startDate, endDate, teams } = req.query;

        let initialMatch = {
            producer: { $exists: true, $ne: "" },
            start_produce_time: { $exists: true, $ne: null },
            project_category: { $in: await getEnabledKeys() } // exclude disabled projects
        };

        if (teams && teams !== 'ALL') {
            if (teams === '___NONE___') {
                initialMatch.producer = { $in: [] };
            } else {
                const teamArray = teams.split(',');
                const mappings = await TeamMap.find({ teamName: { $in: teamArray } }).lean();
                initialMatch.producer = { $in: mappings.map(m => m.username) };
            }
        }

        // Apply strict date boundaries immediately
        if (startDate || endDate) {
            initialMatch.start_produce_time = {};
            if (startDate) initialMatch.start_produce_time.$gte = new Date(`${startDate}T00:00:00.000+08:00`);
            if (endDate) initialMatch.start_produce_time.$lte = new Date(`${endDate}T23:59:59.999+08:00`);
        }

        const pipeline = [{ $match: initialMatch }];

        // LEARNING POINT: We deleted working_date entirely. 
        // If you aren't grouping by day, don't waste CPU calculating it.
        pipeline.push({
            $addFields: {
                safe_video_duration: { $convert: { input: "$video_duration", to: "double", onError: 0, onNull: 0 } }
            }
        });

        pipeline.push({
            $group: {
                _id: "$producer",
                totalVideos: { $sum: 1 },
                totalDuration: { $sum: "$safe_video_duration" },
                passedVideos: { $sum: { $cond: [{ $eq: ["$inspect_result", "INSPECT_PASSED"] }, 1, 0] } },
                passedDuration: { $sum: { $cond: [{ $eq: ["$inspect_result", "INSPECT_PASSED"] }, "$safe_video_duration", 0] } },
                failedVideos: { $sum: { $cond: [{ $eq: ["$inspect_result", "INSPECT_FAILED"] }, 1, 0] } },
                failedDuration: { $sum: { $cond: [{ $eq: ["$inspect_result", "INSPECT_FAILED"] }, "$safe_video_duration", 0] } }
            }
        });

        const leaderboard = await AllRecord.aggregate(pipeline);

        const enrichedData = leaderboard.map(producer => {
            const checkedVideos = producer.passedVideos + producer.failedVideos;
            const checkedDuration = producer.passedDuration + producer.failedDuration;

            const waitingVideos = producer.totalVideos - checkedVideos;
            const waitingDuration = Math.max(0, producer.totalDuration - checkedDuration);

            const passRate = checkedDuration > 0 ? ((producer.passedDuration / checkedDuration) * 100).toFixed(2) : '0.00';
            const failRate = checkedDuration > 0 ? ((producer.failedDuration / checkedDuration) * 100).toFixed(2) : '0.00';
            const waitRate = producer.totalDuration > 0 ? ((waitingDuration / producer.totalDuration) * 100).toFixed(2) : '0.00';

            return {
                username: producer._id || 'Unknown',
                totalVideos: producer.totalVideos,
                totalDuration: producer.totalDuration,
                checkedVideos,
                checkedDuration,
                passedVideos: producer.passedVideos,
                passedDuration: producer.passedDuration,
                failedVideos: producer.failedVideos,
                failedDuration: producer.failedDuration,
                waitingVideos,
                waitingDuration,
                passRate,
                failRate,
                waitRate
            };
        });

        enrichedData.sort((a, b) => {
            const rateDiff = parseFloat(b.passRate) - parseFloat(a.passRate);
            if (rateDiff !== 0) return rateDiff;
            return b.totalDuration - a.totalDuration;
        });

        res.json(enrichedData);

    } catch (error) {
        console.error("QC Leaderboard Error:", error);
        res.status(500).json({ error: 'Failed to fetch QC Leaderboard data.' });
    }
};