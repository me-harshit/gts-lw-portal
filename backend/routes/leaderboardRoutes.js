import express from 'express';
import { getAcceptanceLeaderboard, getPerformanceLeaderboard } from '../controllers/leaderboardController.js';

const router = express.Router();

router.get('/acceptance', getAcceptanceLeaderboard);
router.get('/performance', getPerformanceLeaderboard);

// We will add the Performance Leaderboard here later!
// router.get('/performance', getPerformanceLeaderboard);

export default router;