import fs from 'fs';
import path from 'path';
import AllRecord from '../models/AllRecords.js'; // Adjust path if your model is named differently

// Define the local path for backups (e.g., backend/backups/)
const BACKUP_DIR = path.resolve(process.cwd(), 'backups');

// Ensure the backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

export const createBackup = async (req, res) => {
    try {
        console.log("💾 [Backup Engine] Starting local database snapshot...");

        // Fetch all records as plain JavaScript objects to save RAM
        const allData = await AllRecord.find({}).lean();

        if (!allData || allData.length === 0) {
            return res.status(404).json({ message: "No data found to backup." });
        }

        // Format: backup-YYYY-MM-DD_HH-MM.json
        const date = new Date();
        const timestamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}_${String(date.getHours()).padStart(2, '0')}-${String(date.getMinutes()).padStart(2, '0')}`;
        const fileName = `backup-${timestamp}.json`;
        const filePath = path.join(BACKUP_DIR, fileName);

        // Write to local file system
        fs.writeFileSync(filePath, JSON.stringify(allData, null, 2));

        // Calculate file size in MB
        const stats = fs.statSync(filePath);
        const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

        console.log(`✅ [Backup Engine] Success: ${fileName} (${fileSizeMB} MB)`);

        res.status(200).json({
            message: "Backup created successfully",
            fileName,
            size: `${fileSizeMB} MB`,
            recordCount: allData.length
        });

    } catch (error) {
        console.error("🛑 [Backup Engine] Failed to create backup:", error);
        res.status(500).json({ error: "Failed to generate backup file." });
    }
};

export const listBackups = (req, res) => {
    try {
        const files = fs.readdirSync(BACKUP_DIR)
            .filter(file => file.endsWith('.json'))
            .map(file => {
                const filePath = path.join(BACKUP_DIR, file);
                const stats = fs.statSync(filePath);
                return {
                    fileName: file,
                    sizeMB: (stats.size / (1024 * 1024)).toFixed(2),
                    createdAt: stats.birthtime // When the file was created
                };
            })
            // Sort newest first
            .sort((a, b) => b.createdAt - a.createdAt);

        res.status(200).json({ backups: files });
    } catch (error) {
        console.error("🛑 [Backup Engine] Failed to list backups:", error);
        res.status(500).json({ error: "Failed to read backup directory." });
    }
};

export const exportAllRecordsCsv = async (req, res) => {
    try {
        console.log("📊 [Export Engine] Starting fast CSV stream...");

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=GTS_Records_${new Date().toISOString().split('T')[0]}.csv`);

        const firstRecord = await AllRecord.findOne().lean();
        if (!firstRecord) {
            return res.status(404).send("No records found in database.");
        }

        const headers = Object.keys(firstRecord).filter(key => key !== '_id' && key !== '__v');

        // 👇 --- THIS IS THE MAGIC FIX --- 👇
        // Adds the UTF-8 Byte Order Mark (BOM) so Excel reads Chinese characters perfectly
        res.write('\uFEFF');
        // 👆 ---------------------------- 👆

        res.write(headers.join(',') + '\n');

        const cursor = AllRecord.find({}).lean().cursor({ batchSize: 500 });

        cursor.on('data', (doc) => {
            const rowData = headers.map(header => {
                let cellData = doc[header];
                if (cellData === null || cellData === undefined) return '""';

                cellData = cellData.toString().replace(/"/g, '""');
                return `"${cellData}"`;
            });

            res.write(rowData.join(',') + '\n');
        });

        cursor.on('end', () => {
            console.log("✅ [Export Engine] Fast CSV stream complete.");
            res.end();
        });

        cursor.on('error', (err) => {
            console.error("Cursor error:", err);
            res.end();
        });

    } catch (error) {
        console.error("🛑 [Export Engine] CSV Export Error:", error);
        if (!res.headersSent) {
            res.status(500).json({ error: "Failed to generate CSV export." });
        } else {
            res.end();
        }
    }
};