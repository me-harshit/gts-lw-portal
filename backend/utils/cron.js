import cron from 'node-cron';
import { syncTasks } from '../controllers/taskController.js';
import { triggerDashboardSync, triggerTranslation } from '../controllers/dashboardController.js';
import { globalSyncState } from './syncLock.js';

// Mock request/response objects to reuse existing controller logic safely.
// No project list is passed: the sync controllers derive it from the Project registry
// (Task sync = all enabled projects; QC sync = enabled projects flagged syncQc).
const mockReqRes = (type) => {
    return [
        { body: { type } },
        { status: () => ({ json: () => {} }), json: () => {} }
    ];
};

export const initCronJobs = () => {
    // --- THE PRO FIX: ENVIRONMENT VARIABLE TOGGLE ---
    if (process.env.RUN_CRON !== 'true') {
        console.log("🟡 [Cron] Automation is DISABLED on this instance (RUN_CRON is not 'true').");
        return; // Exit early, skip scheduling completely
    }

    console.log("🟢 [Cron] Automation Cron Loops are ENABLED.");

    // 1. Task Sync: Every 1 Hour ('0 * * * *')
    cron.schedule('0 * * * *', async () => {
        if (globalSyncState.isSyncing) return console.log("[Cron] Task Sync skipped: Another sync active.");
        console.log("[Cron] Triggering Automated Task Sync...");
        const [req, res] = mockReqRes('TASK');
        await syncTasks(req, res);
    });

    // 2. QC Sync: Once a day at 8 AM IST ('0 8 * * *')
    cron.schedule('0 8 * * *', async () => {
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