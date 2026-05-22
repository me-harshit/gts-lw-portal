import express from 'express';
import { triggerDashboardSync, getPendingTranslationCount, triggerTranslation } from '../controllers/dashboardController.js'; 
import { getDashboardSummary, getProducerHistory, getQcDetails } from '../controllers/dashboardStatsController.js';

const router = express.Router();

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