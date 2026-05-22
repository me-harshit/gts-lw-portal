import express from 'express';
import { triggerDashboardSync, getPendingTranslationCount, triggerTranslation } from '../controllers/dashboardController.js'; 
import { getDashboardSummary, getProducerHistory, getQcDetails } from '../controllers/dashboardStatsController.js';

const router = express.Router();

router.get('/unlock', (req, res) => {
    globalSyncState.isSyncing = false;
    globalSyncState.type = null;
    globalSyncState.message = '';
    globalSyncState.progress = 0;
    
    io.emit('sync_finished', { message: 'Lock forcefully cleared by Admin.' });
    
    res.send('<h1>✅ System Unlocked!</h1><p>The memory lock has been wiped. You can now trigger a manual sync.</p>');
});

// --- SYNC ROUTES ---
router.post('/sync', triggerDashboardSync);
router.get('/translate/pending', getPendingTranslationCount);
router.post('/translate/start', triggerTranslation);

// --- STATS ROUTES ---
router.get('/stats/summary', getDashboardSummary); 
router.get('/stats/producer/:username', getProducerHistory);

// --- QC DETAILS ---
router.get('/stats/qc-details', getQcDetails);

export default router;