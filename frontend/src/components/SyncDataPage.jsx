import { useState, useEffect } from 'react';
import axios from 'axios';
import { Database, Layers, ShieldAlert, RefreshCw, Clock, Languages, XCircle } from 'lucide-react';
import { useSync } from '../context/SyncContext';
import { PROJECTS } from '../config/constants';
import './ProjectDashboard.css';
import './SyncDataPage.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function SyncDataPage() {
    const [pendingTranslations, setPendingTranslations] = useState(0);
    const { syncState, syncType, lastSyncTimes, startTaskSync, startQcSync, startTranslation, translationData, stopTranslationEngine } = useSync();

    useEffect(() => {
        axios.get(`${API_URL}/api/dashboard/translate/pending`)
            .then(res => setPendingTranslations(res.data.pendingCount))
            .catch(err => console.error(err));
    }, [syncState, translationData.isRunning]);

    const formatTime = (isoString) => {
        if (!isoString) return 'Never synced';
        return new Date(isoString).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
    };

    const handleTaskSync = () => {
        startTaskSync([
            { id: PROJECTS.OFFICE, category: 'OFFICE', name: 'Office Tasks' },
            { id: PROJECTS.HOUSE, category: 'HOUSE', name: 'House Tasks' }
        ]);
    };

    const handleQcSync = () => {
        startQcSync([
            { id: PROJECTS.OFFICE, category: 'OFFICE', name: 'Office Tasks' },
            { id: PROJECTS.HOUSE, category: 'HOUSE', name: 'House Tasks' }
        ]);
    };

    const translationPercent = translationData.total > 0
        ? Math.round((translationData.processed / translationData.total) * 100)
        : 0;

    // Detect if the stop command is currently resolving
    const isStopping = translationData.message === "Stopping Engine...";

    return (
        <div className="dashboard-card sync-page-container">
            <div className="sync-page-header">
                <h2 className="dashboard-header" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                    <div className="sync-main-icon">
                        <Database size={24} />
                    </div>
                    Data Synchronization
                </h2>
                <p className="sync-page-desc">
                    Pull the latest data and translations from Lightwheel into the local database. These processes run safely in the background.
                </p>
            </div>

            <div className="sync-grid">
                {/* --- TASK SYNC CARD --- */}
                <div className="sync-card">
                    <div className="sync-card-header">
                        <div className="sync-icon-wrapper task">
                            <Layers size={24} />
                        </div>
                        <div>
                            <h3 className="sync-card-title">Task Directory</h3>
                            <div className="sync-last-updated">
                                <Clock size={12} />
                                Last Synced: {formatTime(lastSyncTimes.task)}
                            </div>
                        </div>
                    </div>
                    <p className="sync-card-body">
                        Updates the global dictionary of tasks. Fetches total required videos, current pulled progress, and translates task instructions.
                    </p>
                    <button
                        className="sync-action-btn"
                        onClick={handleTaskSync}
                        disabled={syncState === 'syncing'}
                    >
                        <RefreshCw size={16} className={syncState === 'syncing' && syncType === 'TASK' ? 'spinning' : ''} />
                        {syncState === 'syncing' && syncType === 'TASK' ? 'Syncing...' : 'Sync Tasks Now'}
                    </button>
                </div>

                {/* --- QC SYNC CARD --- */}
                <div className="sync-card">
                    <div className="sync-card-header">
                        <div className="sync-icon-wrapper qc">
                            <ShieldAlert size={24} />
                        </div>
                        <div>
                            <h3 className="sync-card-title">QC Records</h3>
                            <div className="sync-last-updated">
                                <Clock size={12} />
                                Last Synced: {formatTime(lastSyncTimes.qc)}
                            </div>
                        </div>
                    </div>
                    <p className="sync-card-body">
                        Triggers a massive background export on Lightwheel. Downloads thousands of QC records instantly without translating to save time.
                    </p>
                    <button
                        className="sync-action-btn"
                        onClick={handleQcSync}
                        disabled={syncState === 'syncing'}
                    >
                        <RefreshCw size={16} className={syncState === 'syncing' && syncType === 'QC' ? 'spinning' : ''} />
                        {syncState === 'syncing' && syncType === 'QC' ? 'Syncing...' : 'Sync QC Records'}
                    </button>
                </div>

                {/* --- TRANSLATION ENGINE CARD --- */}
               
            </div>
        </div>
    );
}