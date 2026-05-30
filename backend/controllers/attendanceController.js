import AllRecord from '../models/AllRecords.js';

export const getAttendance = async (req, res) => {
    try {
        const { startDate, endDate, page = 1, limit = 50, team, producer } = req.query;

        let initialMatch = {
            producer: { $exists: true, $ne: "" },
            start_produce_time: { $exists: true, $ne: null }
        };

        if (team && team !== 'ALL') initialMatch.project_category = team;
        if (producer) initialMatch.producer = new RegExp(producer, 'i');

        const pipeline = [
            { $match: initialMatch },

            // TIMEZONE MATH
            {
                $addFields: {
                    actual_ist_time: { $subtract: ["$start_produce_time", 2.5 * 60 * 60 * 1000] },
                    logical_day_time: {
                        $subtract: [
                            { $subtract: ["$start_produce_time", 2.5 * 60 * 60 * 1000] },
                            6 * 60 * 60 * 1000
                        ]
                    },
                    // Safely parse video_duration to a double (handles strings, nulls, and missing fields securely)
                    safe_video_duration: {
                        $convert: { input: "$video_duration", to: "double", onError: 0, onNull: 0 }
                    }
                }
            },
            {
                $addFields: {
                    working_date: {
                        $dateToString: { format: "%Y-%m-%d", date: "$logical_day_time" }
                    }
                }
            }
        ];

        if (startDate && endDate) {
            pipeline.push({
                $match: {
                    working_date: { $gte: startDate, $lte: endDate }
                }
            });
        }

        // --- GROUP 1: By Producer and Date ---
        pipeline.push({
            $group: {
                _id: { producer: "$producer", date: "$working_date" },
                checkIn: { $min: "$actual_ist_time" },
                checkOut: { $max: "$actual_ist_time" },
                totalVideos: { $sum: 1 },
                dailyRecordedSec: { $sum: "$safe_video_duration" } // NEW: Total video time for the day
            }
        });

        pipeline.push({
            $addFields: {
                officeDurationSec: {
                    $divide: [{ $subtract: ["$checkOut", "$checkIn"] }, 1000]
                }
            }
        });

        // --- GROUP 2: Rollup by Producer ---
        pipeline.push({
            $group: {
                _id: "$_id.producer",
                presentDays: { $sum: 1 },
                totalVideos: { $sum: "$totalVideos" },
                totalOfficeDurationSec: { $sum: "$officeDurationSec" },
                totalRecordedSec: { $sum: "$dailyRecordedSec" }, // NEW: Grand total recorded time
                dailyRecords: {
                    $push: {
                        date: "$_id.date",
                        checkIn: "$checkIn",
                        checkOut: "$checkOut",
                        totalVideos: "$totalVideos",
                        officeDurationSec: "$officeDurationSec",
                        recordedSec: "$dailyRecordedSec" // NEW: Pass daily recorded time to overlay
                    }
                }
            }
        });

        pipeline.push({
            $project: {
                _id: 0,
                producer: "$_id",
                presentDays: 1,
                totalVideos: 1,
                totalOfficeDurationSec: 1,
                totalRecordedSec: 1,
                dailyRecords: {
                    $sortArray: { input: "$dailyRecords", sortBy: { date: -1 } }
                }
            }
        });

        pipeline.push({ $sort: { producer: 1 } });

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