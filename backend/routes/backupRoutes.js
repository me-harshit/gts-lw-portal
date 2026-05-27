import express from 'express';
import { createBackup, listBackups } from '../controllers/backupController.js';

const router = express.Router();

router.post('/create', createBackup);
router.get('/list', listBackups);

export default router;