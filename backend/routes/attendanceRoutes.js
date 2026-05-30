import express from 'express';
import { getAttendance } from '../controllers/attendanceController.js';

const router = express.Router();

router.get('/', getAttendance);

export default router;