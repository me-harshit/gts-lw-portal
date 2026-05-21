import AllRecord from '../models/AllRecords.js';
import TeamMap from '../models/TeamMap.js';

export const getAcceptanceLeaderboard = async (req, res) => {
    const { startDate, endDate, teamName, projectCategory } = req.query;

    try {
        let targetProducers = null;
        if (teamName && teamName !== 'ALL') {
            const teamMembers = await TeamMap.find({ teamName });
            targetProducers = teamMembers.map(member => member.username);
            
            if (targetProducers.length === 0) {
                return res.json([]);
            }
        }

        const matchFilter = {};
        
        if (targetProducers) {
            matchFilter.producer = { $in: targetProducers };
        }

        if (startDate && endDate) {
            matchFilter.start_produce_time = {
                $gte: new Date(`${startDate}T00:00:00.000Z`),
                $lte: new Date(`${endDate}T23:59:59.999Z`)
            };
        }

        if (projectCategory && projectCategory !== 'ALL') {
            matchFilter.project_category = projectCategory;
        }

        const leaderboardData = await AllRecord.aggregate([
            { $match: matchFilter },
            {
                $group: {
                    _id: "$producer",
                    acceptedSec: { $sum: { $cond: [{ $eq: ["$inspect_result", "INSPECT_PASSED"] }, { $toDouble: "$video_duration" }, 0] } },
                    waitingSec: { $sum: { $cond: [{ $eq: ["$inspect_result", "INSPECT_WAITING"] }, { $toDouble: "$video_duration" }, 0] } },
                    rejectedSec: { $sum: { $cond: [{ $eq: ["$inspect_result", "INSPECT_FAILED"] }, { $toDouble: "$video_duration" }, 0] } }
                }
            },
            {
                $project: {
                    producer: "$_id",
                    _id: 0,
                    acceptedSec: 1,
                    waitingSec: 1,
                    rejectedSec: 1,
                    totalSec: { $add: ["$acceptedSec", "$waitingSec", "$rejectedSec"] }
                }
            },
            { $sort: { acceptedSec: -1 } }
        ]);

        const latestRecord = await AllRecord.findOne().sort({ start_produce_time: -1 }).select('start_produce_time');
        const lastUpdated = latestRecord ? latestRecord.start_produce_time : null;

        res.json({
            data: leaderboardData,
            lastUpdated: lastUpdated
        });

    } catch (error) {
        console.error("Leaderboard Error:", error);
        res.status(500).json({ error: error.message });
    }
};

export const getPerformanceLeaderboard = async (req, res) => {
    const { startDate, endDate, teamName, projectCategory } = req.query;

    try {
        let targetProducers = null;
        if (teamName && teamName !== 'ALL') {
            const teamMembers = await TeamMap.find({ teamName });
            targetProducers = teamMembers.map(member => member.username);
            
            if (targetProducers.length === 0) return res.json([]);
        }

        const matchFilter = {};
        if (targetProducers) matchFilter.producer = { $in: targetProducers };

        let manualDays = null; 
        
        // IST BOUNDARY FIX
        if (startDate && endDate) {
            matchFilter.start_produce_time = {
                $gte: new Date(`${startDate}T00:00:00.000Z`),
                $lte: new Date(`${endDate}T23:59:59.999Z`)
            };
            
            const start = new Date(startDate);
            const end = new Date(endDate);
            manualDays = Math.max(1, Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1);
        }

        if (projectCategory && projectCategory !== 'ALL') {
            matchFilter.project_category = projectCategory;
        }

        const leaderboardData = await AllRecord.aggregate([
            { $match: matchFilter },
            {
                $group: {
                    _id: "$producer",
                    totalSec: { $sum: { $toDouble: "$video_duration" } },
                    uniqueDays: {
                        $addToSet: {
                            $dateToString: { 
                                format: "%Y-%m-%d", 
                                date: "$start_produce_time",
                            }
                        }
                    }
                }
            },
            {
                $project: {
                    producer: "$_id",
                    _id: 0,
                    totalSec: 1,
                    activeDays: { $max: [1, { $size: "$uniqueDays" }] }
                }
            },
            {
                $project: {
                    producer: 1,
                    totalSec: 1,
                    dailyAverageSec: { 
                        $divide: [ "$totalSec", manualDays ? manualDays : "$activeDays" ] 
                    }
                }
            },
            { $sort: { totalSec: -1 } }
        ]);

        const latestRecord = await AllRecord.findOne().sort({ start_produce_time: -1 }).select('start_produce_time');
        const lastUpdated = latestRecord ? latestRecord.start_produce_time : null;

        res.json({
            data: leaderboardData,
            lastUpdated: lastUpdated
        });

    } catch (error) {
        console.error("Performance Leaderboard Error:", error);
        res.status(500).json({ error: error.message });
    }
};