import express from 'express';
import { getTasks, syncTasks, getGoalAnomalies } from '../controllers/taskController.js';

const router = express.Router();

router.get('/', getTasks);
router.get('/goal-anomalies', getGoalAnomalies);
router.post('/sync', syncTasks);

export default router;