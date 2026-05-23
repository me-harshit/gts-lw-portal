import { createContext, useState, useContext, useEffect, useCallback } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client'; 

const SyncContext = createContext();
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export function SyncProvider({ children }) {
    const [syncState, setSyncState] = useState('idle'); 
    const [syncType, setSyncType] = useState(null); 
    const [syncMessage, setSyncMessage] = useState('');
    const [progress, setProgress] = useState(0);
    const [lastSyncTimes, setLastSyncTimes] = useState({ task: null, qc: null });
    const [translationData, setTranslationData] = useState({ isRunning: false, processed: 0, total: 0, speed: 0, message: '' });

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

    useEffect(() => {
        fetchLastSyncTimes();
    }, [fetchLastSyncTimes]);

    useEffect(() => {
        const socket = io(API_URL, {
            withCredentials: true,
            transports: ['websocket']
        });

        socket.on('connect', () => {
            console.log("🟢 SOCKET CONNECTED SUCCESSFULLY! URL:", API_URL, "ID:", socket.id);
        });

        socket.on('connect_error', (err) => {
            console.error("🔴 SOCKET CONNECTION FAILED URL:", API_URL, "Error:", err.message);
        });

        socket.on('translation_update', (data) => {
            setTranslationData(data);
        });

        socket.on('sync_update', (state) => {
            if (state.isSyncing) {
                setSyncState('syncing');
                setSyncType(state.type);
                setSyncMessage(state.message);
                setProgress(state.progress);
            }
        });

        socket.on('sync_finished', (state) => {
            setSyncState('success');
            setSyncMessage(state.message);
            setProgress(state.progress);
            fetchLastSyncTimes(); 

            setTimeout(() => resetSync(), 5000);
        });

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

    const handleSyncTrigger = async (apiCall) => {
        try {
            await apiCall();
        } catch (error) {
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

    // --- UPDATED LOGIC HERE ---
    const stopTranslationEngine = async () => {
        try {
            await axios.post(`${API_URL}/api/dashboard/translate/stop`);
        } catch (error) {
            if (error.response?.status === 400) {
                console.log("Engine already commanded to stop or is not running.");
            } else {
                console.error("Failed to stop engine", error);
            }
        }
    };

    return (
        <SyncContext.Provider value={{
            syncState, syncType, syncMessage, progress,
            lastSyncTimes,
            translationData,
            startTaskSync, startQcSync, startTranslation,
            stopTranslationEngine
        }}>
            {children}
        </SyncContext.Provider>
    );
}

export const useSync = () => useContext(SyncContext);