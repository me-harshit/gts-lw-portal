import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGO_URI || process.env.DATABASE_URL;

if (!MONGODB_URI) {
    console.error("❌ Error: No MongoDB connection string found in .env file.");
    process.exit(1);
}

async function runDiagnostic() {
    try {
        console.log('⏳ Connecting to database...');
        await mongoose.connect(MONGODB_URI);
        const db = mongoose.connection.db;
        console.log('✅ Connected successfully.\n');

        // 1. CHECK TASKS COLLECTION
        console.log('=============================================');
        console.log(' 📋 TASKS (Live API Data)');
        console.log('=============================================');
        const tasks = await db.collection('tasks').find({ 
            category: { $nin: ["HOUSE", "OFFICE"] } 
        }).toArray();
        
        console.log(`Found ${tasks.length} tasks that are NOT House/Office:`);
        tasks.forEach(t => {
            console.log(` ➜ ID: ${t.taskId} | Category: ${t.category} | Progress: ${t.pulledNum}/${t.totalNum} | Name: ${t.taskName}`);
        });

        // 2. CHECK ALLRECORDS COLLECTION (The CSV Data)
        console.log('\n=============================================');
        console.log(' 🎥 VIDEOS / ALLRECORDS (CSV Export Data)');
        console.log('=============================================');
        const videos = await db.collection('allrecords').find({ 
            project_category: { $nin: ["HOUSE", "OFFICE"] } 
        }).toArray();

        console.log(`Found ${videos.length} videos that are NOT House/Office.`);
        if (videos.length > 0) {
            // Group them to see what categories they are accidentally saved under
            const agg = await db.collection('allrecords').aggregate([
                { $match: { project_category: { $nin: ["HOUSE", "OFFICE"] } } },
                { $group: { _id: "$project_category", count: { $sum: 1 } } }
            ]).toArray();
            
            agg.forEach(a => {
                const catName = a._id === null ? "NULL/MISSING" : a._id;
                console.log(` ➜ ${catName}: ${a.count} videos`);
            });
        } else {
            console.log(" ⚠️ No Gym videos exist in the database yet. Lightwheel's CSV export has not included them.");
        }

        console.log('\n=============================================');

    } catch (error) {
        console.error('❌ Script Error:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

runDiagnostic();