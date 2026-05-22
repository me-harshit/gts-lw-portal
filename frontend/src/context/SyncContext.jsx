import { createContext, useState, useContext, useEffect, useCallback } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client'; // <-- Import socket.io

const SyncContext = createContext();
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export function SyncProvider({ children }) {
    const [syncState, setSyncState] = useState('idle'); // 'idle', 'syncing', 'error', 'success'
    const [syncType, setSyncType] = useState(null); // 'TASK', 'QC', or 'TRANSLATE'
    const [syncMessage, setSyncMessage] = useState('');
    const [progress, setProgress] = useState(0);
    const [lastSyncTimes, setLastSyncTimes] = useState({ task: null, qc: null });

    const fetchLastSyncTimes = useCallback(async () => {
        try {
            const res = await axios.get(`${API_URL}/api/config`);
            if (res.data) {
                setLastSyncTimes({
                    task: res.data.lastTaskSync,
                    qc: res.data.lastQcSync
                });
            }
        } catch (error) {
            console.error("Failed to fetch sync timestamps", error);
        }
    }, []);

    // 1. Fetch config on load
    useEffect(() => {
        fetchLastSyncTimes();
    }, [fetchLastSyncTimes]);

    // 2. SOCKET.IO GLOBAL LISTENER
    useEffect(() => {
        const socket = io(API_URL, { withCredentials: true });

        // --- NEW: CONNECTION RADAR ---
        socket.on('connect', () => {
            console.log("🟢 SOCKET CONNECTED SUCCESSFULLY! URL:", API_URL, "ID:", socket.id);
        });

        socket.on('connect_error', (err) => {
            console.error("🔴 SOCKET CONNECTION FAILED URL:", API_URL, "Error:", err.message);
        });
        // -----------------------------

        // Listen for ongoing progress
        socket.on('sync_update', (state) => {
            if (state.isSyncing) {
                setSyncState('syncing');
                setSyncType(state.type);
                setSyncMessage(state.message);
                setProgress(state.progress);
            }
        });

        // Listen for successful completion
        socket.on('sync_finished', (state) => {
            setSyncState('success');
            setSyncMessage(state.message);
            setProgress(state.progress);
            fetchLastSyncTimes(); // Refresh timestamps globally!

            setTimeout(() => resetSync(), 5000);
        });

        // Listen for global errors
        socket.on('sync_error', (error) => {
            setSyncState('error');
            setSyncMessage(error.message);
            setTimeout(() => resetSync(), 7000);
        });

        return () => socket.disconnect();
    }, [fetchLastSyncTimes]);

    const resetSync = () => {
        setSyncState('idle');
        setSyncMessage('');
        setProgress(0);
        setSyncType(null);
    };

    // 3. API TRIGGERS (These now just kick off the backend, Socket handles the UI)
    const handleSyncTrigger = async (apiCall) => {
        try {
            await apiCall();
        } catch (error) {
            // If the backend returns 409 Conflict, it means a sync is already running globally.
            // We ignore it because the socket is already updating our UI!
            if (error.response?.status !== 409) {
                setSyncState('error');
                setSyncMessage(error.response?.data?.error || 'Failed to start sync.');
                setTimeout(() => resetSync(), 7000);
            }
        }
    };

    const startTaskSync = (projectsToSync) => {
        handleSyncTrigger(() => axios.post(`${API_URL}/api/tasks/sync`, { projects: projectsToSync }));
    };

    const startQcSync = (projectsToSync) => {
        handleSyncTrigger(() => axios.post(`${API_URL}/api/dashboard/sync`, { projects: projectsToSync, type: 'QC' }));
    };

    const startTranslation = () => {
        handleSyncTrigger(() => axios.post(`${API_URL}/api/dashboard/translate/start`, { type: 'TRANSLATE' }));
    };

    return (
        <SyncContext.Provider value={{
            syncState, syncType, syncMessage, progress,
            lastSyncTimes,
            startTaskSync, startQcSync, startTranslation
        }}>
            {children}
        </SyncContext.Provider>
    );
}

export const useSync = () => useContext(SyncContext);