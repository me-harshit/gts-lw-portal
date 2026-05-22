import express from 'express';
import { triggerDashboardSync, getPendingTranslationCount, triggerTranslation } from '../controllers/dashboardController.js'; 
import { getDashboardSummary, getProducerHistory, getQcDetails } from '../controllers/dashboardStatsController.js';
import { finishSync } from '../utils/syncLock.js';

const router = express.Router();

// --- THE MASTER KEY: HIDDEN UNLOCK ROUTE ---
router.get('/unlock', (req, res) => {
    finishSync('Lock forcefully cleared by Admin.');
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