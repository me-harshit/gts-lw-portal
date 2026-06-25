import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables from your .env file
dotenv.config();

// Ensure this matches the variable name in your .env file
const MONGODB_URI = process.env.MONGO_URI || process.env.DATABASE_URL;

if (!MONGODB_URI) {
    console.error("❌ Error: No MongoDB connection string found in .env file.");
    process.exit(1);
}

async function runDiagnostic() {
    try {
        console.log('⏳ Connecting to database...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected successfully.\n');

        // Access the raw collection directly (usually lowercase and pluralized)
        // If your collection is named differently, change 'allrecords' below
        const collection = mongoose.connection.db.collection('allrecords');

        console.log('🔍 Scanning database for project categories...\n');
        
        const results = await collection.aggregate([
            {
                $group: {
                    _id: "$project_category",
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { count: -1 } // Sort from highest to lowest
            }
        ]).toArray();

        console.log('=============================================');
        console.log('             CATEGORY SUMMARY                ');
        console.log('=============================================');
        
        let total = 0;
        results.forEach(res => {
            // Handle null or empty strings gracefully so you know exactly what is broken
            let categoryName = res._id;
            if (res._id === null) categoryName = '⚠️ NULL / MISSING';
            else if (res._id === '') categoryName = '⚠️ EMPTY STRING';
            else if (res._id === undefined) categoryName = '⚠️ UNDEFINED';

            console.log(`➜ ${categoryName.padEnd(30, ' ')} : ${res.count.toLocaleString()} videos`);
            total += res.count;
        });
        
        console.log('---------------------------------------------');
        console.log(`  TOTAL RECORDS FOUND          : ${total.toLocaleString()}`);
        console.log('=============================================');

    } catch (error) {
        console.error('❌ Script Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from database.');
        process.exit(0);
    }
}

runDiagnostic();