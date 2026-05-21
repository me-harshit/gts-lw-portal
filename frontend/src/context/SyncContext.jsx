import { createContext, useState, useContext, useEffect, useCallback } from 'react';
import axios from 'axios';

const SyncContext = createContext();
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export function SyncProvider({ children }) {
    const [syncState, setSyncState] = useState('idle'); // 'idle', 'syncing', 'error', 'success'
    const [syncType, setSyncType] = useState(null); // 'TASK', 'QC', or 'TRANSLATE'
    const [syncMessage, setSyncMessage] = useState('');
    const [progress, setProgress] = useState(0);
    const [jobId, setJobId] = useState(null);
    
    // NEW: Global state for last sync times
    const [lastSyncTimes, setLastSyncTimes] = useState({ task: null, qc: null });

    // NEW: Function to fetch timestamps from the DB config
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

    // Fetch on initial app load
    useEffect(() => {
        fetchLastSyncTimes();
    }, [fetchLastSyncTimes]);

    const startTaskSync = async (projectsToSync) => {
        try {
            setSyncState('syncing');
            setSyncType('TASK');
            setSyncMessage('Downloading & Translating Tasks...');
            setProgress(0);

            await axios.post(`${API_URL}/api/tasks/sync`, { projects: projectsToSync });
            
            setSyncState('success');
            setSyncMessage('Task Directory Synced!');
            fetchLastSyncTimes(); // Refresh the timestamp immediately!
            setTimeout(() => resetSync(), 5000);
        } catch (error) {
            setSyncState('error');
            setSyncMessage(error.response?.data?.error || 'Task sync failed.');
            setTimeout(() => resetSync(), 7000);
        }
    };

    const startQcSync = async (projectsToSync) => {
        try {
            setSyncState('syncing');
            setSyncType('QC');
            setSyncMessage('Waking up Lightwheel...');
            setProgress(0);

            const res = await axios.post(`${API_URL}/api/dashboard/sync`, { projects: projectsToSync });
            setJobId(res.data.jobId);
        } catch (error) {
            setSyncState('error');
            setSyncMessage(error.response?.data?.error || 'QC sync failed to start.');
            setTimeout(() => resetSync(), 7000);
        }
    };

    const startTranslation = async () => {
        try {
            setSyncState('syncing');
            setSyncType('TRANSLATE'); 
            setSyncMessage('Starting Translation Engine...');
            setProgress(0);

            const res = await axios.post(`${API_URL}/api/dashboard/translate/start`);
            setJobId(res.data.jobId);
        } catch (error) {
            setSyncState('error');
            setSyncMessage(error.response?.data?.error || 'Translation engine failed to start.');
            setTimeout(() => resetSync(), 7000);
        }
    };

    useEffect(() => {
        let interval;
        if (jobId && syncState === 'syncing' && (syncType === 'QC' || syncType === 'TRANSLATE')) {
            interval = setInterval(async () => {
                try {
                    const res = await axios.get(`${API_URL}/api/dashboard/status/${jobId}`);
                    const job = res.data;
                    
                    setSyncMessage(job.status);
                    if (job.progress) setProgress(job.progress);

                    if (job.status === 'Completed') {
                        setSyncState('success');
                        setSyncMessage(syncType === 'TRANSLATE' ? 'Translation Complete!' : 'QC Database Synced!');
                        fetchLastSyncTimes(); // Refresh the timestamp immediately!
                        
                        clearInterval(interval);
                        setJobId(null);
                        setTimeout(() => resetSync(), 5000);
                    } else if (job.status === 'Failed') {
                        setSyncState('error');
                        setSyncMessage(`Error: ${job.error}`);
                        clearInterval(interval);
                        setJobId(null);
                        setTimeout(() => resetSync(), 7000);
                    }
                } catch (error) {
                    console.error("Polling Error", error);
                }
            }, 2000);
        }
        return () => clearInterval(interval);
    }, [jobId, syncState, syncType, fetchLastSyncTimes]);

    const resetSync = () => {
        setSyncState('idle');
        setSyncMessage('');
        setProgress(0);
        setSyncType(null);
    };

    return (
        <SyncContext.Provider value={{ 
            syncState, syncType, syncMessage, progress, 
            lastSyncTimes, // Export the timestamps
            startTaskSync, startQcSync, startTranslation 
        }}>
            {children}
        </SyncContext.Provider>
    );
}

export const useSync = () => useContext(SyncContext);