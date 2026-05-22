import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser'; // <-- Added
import { connectDB } from './config/db.js'; 

import authRoutes from './routes/authRoutes.js'; // <-- Added
import taskRoutes from './routes/taskRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import teamRoutes from './routes/teamRoutes.js';
import leaderboardRoutes from './routes/leaderboardRoutes.js';
import configRoutes from './routes/configRoutes.js';

dotenv.config();
connectDB();

const app = express();

const allowedOrigins = ['https://lw.gts.ai', 'http://localhost:5173'];
app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true // <-- Mandatory for cookies
}));

app.use(express.json());
app.use(cookieParser()); // <-- Mandatory for reading cookies

app.use('/api/auth', authRoutes); // <-- Added Auth Routes
app.use('/api/tasks', taskRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/leaderboards', leaderboardRoutes);
app.use('/api/config', configRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});