import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser'; 
import { connectDB } from './config/db.js'; 
import { globalSyncState, setIO } from './utils/syncLock.js';
import { initCronJobs } from './utils/cron.js';
import authRoutes from './routes/authRoutes.js'; 
import taskRoutes from './routes/taskRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import teamRoutes from './routes/teamRoutes.js';
import leaderboardRoutes from './routes/leaderboardRoutes.js';
import configRoutes from './routes/configRoutes.js';

dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app);

const allowedOrigins = ['https://lw.gts.ai', 'http://localhost:5173'];
app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        credentials: true
    }
});

setIO(io);

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);
    socket.emit('sync_update', globalSyncState); 
});

app.use(express.json());
app.use(cookieParser()); 

app.use('/api/auth', authRoutes); 
app.use('/api/tasks', taskRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/leaderboards', leaderboardRoutes);
app.use('/api/config', configRoutes);

initCronJobs();

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});