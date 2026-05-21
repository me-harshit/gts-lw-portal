import express from 'express';
import { getTasks, syncTasks } from '../controllers/taskController.js';

const router = express.Router();

router.get('/', getTasks);

router.post('/sync', syncTasks);

export default router;