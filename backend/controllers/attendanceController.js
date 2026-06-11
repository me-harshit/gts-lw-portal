import AllRecord from '../models/AllRecords.js';
import TeamMap from '../models/TeamMap.js';

export const getAttendance = async (req, res) => {
    try {
        const { startDate, endDate, page = 1, limit = 50, teams, producer } = req.query;

        let initialMatch = {
            start_produce_time: { $exists: true, $ne: null }
        };

        let producerCondition = { $ne: "" };

        if (teams && teams !== 'ALL') {
            if (teams === '___NONE___') {
                producerCondition.$in = [];
            } else {
                const teamArray = teams.split(',');
                const mappings = await TeamMap.find({ teamName: { $in: teamArray } }).lean();
                producerCondition.$in = mappings.map(m => m.username);
            }
        }

        if (producer) {
            producerCondition.$regex = new RegExp(producer, 'i');
        }

        initialMatch.producer = producerCondition;

        // STRICT IST TIME FILTERING (+05:30)
        if (startDate || endDate) {
            initialMatch.start_produce_time = {};
            if (startDate) initialMatch.start_produce_time.$gte = new Date(`${startDate}T00:00:00.000+05:30`);
            if (endDate) initialMatch.start_produce_time.$lte = new Date(`${endDate}T23:59:59.999+05:30`);
        }

        const pipeline = [
            { $match: initialMatch },
            {
                $addFields: {
                    safe_video_duration: { $convert: { input: "$video_duration", to: "double", onError: 0, onNull: 0 } },
                    working_date: { $dateToString: { format: "%Y-%m-%d", date: "$start_produce_time", timezone: "+05:30" } }
                }
            },
            // --- GROUP 1: By Producer and Date ---
            {
                $group: {
                    _id: { producer: "$producer", date: "$working_date" },
                    checkIn: { $min: "$start_produce_time" },
                    checkOut: { $max: "$start_produce_time" },
                    totalVideos: { $sum: 1 },
                    // CALCULATE BOTH RECORDED AND ACCEPTED
                    dailyRecordedSec: { $sum: "$safe_video_duration" },
                    dailyAcceptedSec: {
                        $sum: { $cond: [{ $eq: ["$inspect_result", "INSPECT_PASSED"] }, "$safe_video_duration", 0] }
                    }
                }
            },
            {
                $addFields: {
                    officeDurationSec: {
                        $divide: [{ $subtract: ["$checkOut", "$checkIn"] }, 1000]
                    }
                }
            },
            // --- GROUP 2: Rollup by Producer ---
            {
                $group: {
                    _id: "$_id.producer",
                    presentDays: { $sum: 1 },
                    totalVideos: { $sum: "$totalVideos" },
                    totalOfficeDurationSec: { $sum: "$officeDurationSec" },
                    totalRecordedSec: { $sum: "$dailyRecordedSec" },
                    totalAcceptedSec: { $sum: "$dailyAcceptedSec" },
                    dailyRecords: {
                        $push: {
                            date: "$_id.date",
                            checkIn: "$checkIn",
                            checkOut: "$checkOut",
                            totalVideos: "$totalVideos",
                            officeDurationSec: "$officeDurationSec",
                            recordedSec: "$dailyRecordedSec",
                            acceptedSec: "$dailyAcceptedSec"
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    producer: "$_id",
                    presentDays: 1,
                    totalVideos: 1,
                    totalOfficeDurationSec: 1,
                    totalRecordedSec: 1,
                    totalAcceptedSec: 1,
                    dailyRecords: {
                        $sortArray: { input: "$dailyRecords", sortBy: { date: -1 } }
                    }
                }
            },
            { $sort: { presentDays: -1, producer: 1 } }
        ];

        const skip = (Number(page) - 1) * Number(limit);
        const facetPipeline = [
            ...pipeline,
            {
                $facet: {
                    metadata: [{ $count: "total" }],
                    data: [{ $skip: skip }, { $limit: Number(limit) }]
                }
            }
        ];

        const result = await AllRecord.aggregate(facetPipeline);

        const records = result[0].data;
        const totalRecords = result[0].metadata[0] ? result[0].metadata[0].total : 0;
        const totalPages = Math.ceil(totalRecords / Number(limit));

        res.json({
            attendance: records,
            currentPage: Number(page),
            totalPages,
            totalRecords
        });

    } catch (error) {
        console.error("Attendance Aggregation Error:", error);
        res.status(500).json({ error: 'Failed to calculate attendance data.' });
    }
};