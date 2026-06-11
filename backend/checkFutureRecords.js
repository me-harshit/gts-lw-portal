// checkFutureRecords.js
const mongoose = require('mongoose');
const fs = require('fs');

// Import your AllRecord model (adjust path as needed)
const AllRecord = require('./models/AllRecord'); // change to your actual model path

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/yourdb';

async function checkFutureRecords() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        // Define start of 2026-06-12 in Beijing time, converted to UTC
        const beijingStart = new Date('2026-06-12T00:00:00+08:00');
        const utcStart = new Date(beijingStart.toISOString());

        const records = await AllRecord.find({
            start_produce_time: { $gte: utcStart }
        }).lean();

        console.log(`Found ${records.length} records with start_produce_time >= 2026-06-12 Beijing time`);

        if (records.length > 0) {
            fs.writeFileSync('future_records.json', JSON.stringify(records, null, 2));
            console.log('Saved to future_records.json');
        } else {
            console.log('No future records found. The displayed 2026-06-12 might be due to timezone shift (records from 2026-06-11 after 8 PM UTC?)');
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

checkFutureRecords();