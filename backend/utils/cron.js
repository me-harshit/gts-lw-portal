import cron from 'node-cron';
import { syncTasks } from '../controllers/taskRoutes.js'; // Adjust paths based on your actual exports
import { triggerDashboardSync, triggerTranslation } from '../controllers/dashboardController.js';
import { globalSyncState } from './syncLock.js';

// Mock request/response objects to reuse existing controller logic safely
const mockReqRes = (type) => {
    return [
        { body: { projects: [
            { id: "64469240-0c5d-471e-9008-9ccbf03672a3", category: "OFFICE", name: "Office" },
            { id: "730284cd-4b8b-4975-a8bd-28df1e7aaa06", category: "HOUSE", name: "House" }
        ], type } },
        { status: () => ({ json: () => {} }), json: () => {} }
    ];
};

export const initCronJobs = () => {
    console.log("⏰ Initializing Automation Cron Loops...");

    // 1. Task Sync: Every 1 Hour ('0 * * * *')
    cron.schedule('0 * * * *', async () => {
        if (globalSyncState.isSyncing) return console.log("[Cron] Task Sync skipped: Another sync active.");
        console.log("[Cron] Triggering Automated Task Sync...");
        const [req, res] = mockReqRes('TASK');
        await syncTasks(req, res);
    });

    // 2. QC Sync: Every 2 Hours from 6 AM to 10 PM IST ('0 6-22/2 * * *')
    cron.schedule('0 6-22/2 * * *', async () => {
        if (globalSyncState.isSyncing) return console.log("[Cron] QC Sync skipped: Another sync active.");
        console.log("[Cron] Triggering Automated QC Sync...");
        
        const [req, res] = mockReqRes('QC');
        await triggerDashboardSync(req, res);

        // Chaining Mechanism: Poll the global lock state to wait until QC Sync finishes
        const checkCompletion = setInterval(async () => {
            if (!globalSyncState.isSyncing) {
                clearInterval(checkCompletion);
                
                // Trigger Translation engine only if QC Sync succeeded (not locked/failed)
                if (globalSyncState.message.includes('Successfully')) {
                    console.log("[Cron] QC Sync completed. Launching Translation Engine...");
                    const [tReq, tRes] = mockReqRes('TRANSLATE');
                    await triggerTranslation(tReq, tRes);
                }
            }
        }, 10000); // Check lock state every 10 seconds

    }, {
        scheduled: true,
        timezone: "Asia/Kolkata" // Enforces Indian Standard Time execution
    });
};