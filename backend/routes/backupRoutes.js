import express from 'express';
import { createBackup, listBackups, exportAllRecordsCsv } from '../controllers/backupController.js';

const router = express.Router();

router.post('/create', createBackup);
router.get('/list', listBackups);
router.get('/csv', exportAllRecordsCsv); 

export default router;