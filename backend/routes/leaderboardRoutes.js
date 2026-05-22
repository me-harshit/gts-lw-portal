import express from 'express';
import { getAcceptanceLeaderboard, getPerformanceLeaderboard, getQcLeaderboard } from '../controllers/leaderboardController.js';

const router = express.Router();

router.get('/acceptance', getAcceptanceLeaderboard);
router.get('/performance', getPerformanceLeaderboard);
router.get('/qc', getQcLeaderboard);

export default router;