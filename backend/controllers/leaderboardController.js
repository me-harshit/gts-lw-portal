import AllRecord from '../models/AllRecords.js';
import TeamMap from '../models/TeamMap.js';

export const getAcceptanceLeaderboard = async (req, res) => {
    try {
        const { startDate, endDate, teams } = req.query;

        let initialMatch = {
            producer: { $exists: true, $ne: "" },
            inspect_result: { $exists: true }
        };

        // --- NEW SMART FILTERING ---
        // Convert the requested custom Teams into a list of exact Producer usernames
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

        const pipeline = [{ $match: initialMatch }];

        // TIMEZONE MATH & DATE FILTERING
        if (startDate && endDate) {
            pipeline.push({
                $addFields: {
                    logical_day_time: {
                        $subtract: [
                            { $subtract: ["$start_produce_time", 2.5 * 60 * 60 * 1000] },
                            6 * 60 * 60 * 1000
                        ]
                    }
                }
            });
            pipeline.push({
                $addFields: {
                    working_date: { $dateToString: { format: "%Y-%m-%d", date: "$logical_day_time" } }
                }
            });
            pipeline.push({
                $match: { working_date: { $gte: startDate, $lte: endDate } }
            });
        }

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
        const { startDate, endDate, teams } = req.query;

        let initialMatch = {
            producer: { $exists: true, $ne: "" },
            start_produce_time: { $exists: true, $ne: null }
        };

        // --- NEW SMART FILTERING ---
        // Convert the requested custom Teams into a list of exact Producer usernames
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

        const pipeline = [ { $match: initialMatch } ];

        // TIMEZONE MATH
        pipeline.push({
            $addFields: {
                logical_day_time: {
                    $subtract: [
                        { $subtract: ["$start_produce_time", 2.5 * 60 * 60 * 1000] },
                        6 * 60 * 60 * 1000
                    ]
                },
                safe_video_duration: { $convert: { input: "$video_duration", to: "double", onError: 0, onNull: 0 } }
            }
        });
        
        pipeline.push({
            $addFields: {
                working_date: { $dateToString: { format: "%Y-%m-%d", date: "$logical_day_time" } }
            }
        });

        // DATE FILTER
        if (startDate && endDate) {
            pipeline.push({
                $match: { working_date: { $gte: startDate, $lte: endDate } }
            });
        }

        // GROUP 1: By Producer & Date to get daily duration
        pipeline.push({
            $group: {
                _id: { producer: "$producer", date: "$working_date" },
                dailySec: { $sum: "$safe_video_duration" }
            }
        });

        // GROUP 2: Rollup by Producer for total and average
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
            start_produce_time: { $exists: true, $ne: null }
        };

        // --- 1. SMART TEAM FILTERING ---
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

        const pipeline = [ { $match: initialMatch } ];

        // --- 2. TIMEZONE MATH & DATES ---
        pipeline.push({
            $addFields: {
                logical_day_time: {
                    $subtract: [
                        { $subtract: ["$start_produce_time", 2.5 * 60 * 60 * 1000] },
                        6 * 60 * 60 * 1000
                    ]
                },
                // Safely parse duration
                safe_video_duration: { $convert: { input: "$video_duration", to: "double", onError: 0, onNull: 0 } }
            }
        });

        pipeline.push({
            $addFields: {
                working_date: { $dateToString: { format: "%Y-%m-%d", date: "$logical_day_time" } }
            }
        });

        if (startDate && endDate) {
            pipeline.push({
                $match: { working_date: { $gte: startDate, $lte: endDate } }
            });
        }

        // --- 3. AGGREGATE BY PRODUCER ---
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

        // --- 4. ENRICH DATA & CALCULATE DURATION-BASED RATES ---
        const enrichedData = leaderboard.map(producer => {
            const checkedVideos = producer.passedVideos + producer.failedVideos;
            const checkedDuration = producer.passedDuration + producer.failedDuration;

            const waitingVideos = producer.totalVideos - checkedVideos;
            const waitingDuration = Math.max(0, producer.totalDuration - checkedDuration); // Math.max prevents floating-point negative errors

            // IMPORTANT: Rates are now accurately based on Video Duration, not Video Count
            const passRate = checkedDuration > 0 ? ((producer.passedDuration / checkedDuration) * 100).toFixed(2) : '0.00';
            const failRate = checkedDuration > 0 ? ((producer.failedDuration / checkedDuration) * 100).toFixed(2) : '0.00';
            const waitRate = producer.totalDuration > 0 ? ((waitingDuration / producer.totalDuration) * 100).toFixed(2) : '0.00';

            return {
                // Return 'producer' as the username for frontend consistency
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

        // 5. Sort by Pass Rate first, then total volume as a tie-breaker
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