import fs from 'fs';
import csv from 'csv-parser';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import QcRecord from './models/AllRecords.js';
import AppConfig from './models/AppConfig.js';

dotenv.config();

// Connect to Database
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/gts')
    .then(() => console.log('Connected to DB'))
    .catch(err => console.error('DB Connection Error:', err));

// Learning Note: This helper normalizes both date formats into standard Date objects
const parseDate = (dateStr) => {
    if (!dateStr) return null;

    // Handle House Task format: DD-MM-YYYY HH:mm
    if (dateStr.match(/^\d{2}-\d{2}-\d{4}/)) {
        const [datePart, timePart] = dateStr.split(' ');
        const [day, month, year] = datePart.split('-');
        return new Date(`${year}-${month}-${day}T${timePart}:00Z`);
    }

    // Handle Office Task format: YYYY-MM-DD HH:mm:ss
    return new Date(dateStr);
};

const processCSV = (filePath) => {
    return new Promise((resolve, reject) => {
        const records = [];
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row) => {
                records.push({
                    updateOne: {
                        filter: { data_name: row.data_name }, // Unique identifier
                        update: {
                            $set: {
                                project_category: row.project,
                                producer: row.producer,
                                team: row.team,
                                start_produce_time: parseDate(row.start_produce_time),
                                inspect_time: parseDate(row.inspect_time),
                                fps: parseFloat(row.fps) || 0,
                                video_duration: parseFloat(row.video_duration) || 0,
                                inspect_result: row.inspect_result,
                                inspect_error_type_cn: row.inspect_error_type_cn,
                                inspect_error_type_en: row.inspect_error_type_en,
                                inspect_issue_description: row.inspect_issue_description,
                                task_name: row.task_name,
                                platform_task_id: row.platform_task_id
                            }
                        },
                        upsert: true // Learning Note: Upsert prevents duplicate entries by updating if exists, creating if not.
                    }
                });
            })
            .on('end', async () => {
                try {
                    if (records.length > 0) {
                        // Learning Note: bulkWrite is significantly faster than saving in a loop
                        const result = await QcRecord.bulkWrite(records);
                        console.log(`Processed ${filePath}: Upserted ${result.upsertedCount}, Modified ${result.modifiedCount}`);
                    }
                    resolve();
                } catch (error) {
                    console.error(`Error writing ${filePath} to DB:`, error);
                    reject(error);
                }
            });
    });
};

const runSync = async () => {
    // Note: Escaped backslashes are required for Windows paths in JS
    const housePath = 'C:\\Users\\harsh\\Downloads\\House Task.csv';
    const officePath = 'C:\\Users\\harsh\\Downloads\\Office Task.csv';

    try {
        if (fs.existsSync(housePath)) await processCSV(housePath);
        else console.log('House Task CSV not found.');

        if (fs.existsSync(officePath)) await processCSV(officePath);
        else console.log('Office Task CSV not found.');

        await AppConfig.findOneAndUpdate(
            { configId: 'global_settings' },
            { lastQcSync: new Date() },
            { upsert: true }
        );
        console.log('Local sync complete!');
        process.exit(0);
    } catch (error) {
        console.error('Sync failed:', error);
        process.exit(1);
    }
};

runSync();