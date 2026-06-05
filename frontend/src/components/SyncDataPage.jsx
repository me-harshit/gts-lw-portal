import { useState, useEffect } from 'react';
import axios from 'axios';
import { Database, Layers, ShieldAlert, RefreshCw, Clock, Languages, XCircle, HardDrive, Archive, Download } from 'lucide-react';
import { useSync } from '../context/SyncContext';
import { PROJECTS } from '../config/constants';
import './ProjectDashboard.css';
import './SyncDataPage.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function SyncDataPage() {
    const [pendingTranslations, setPendingTranslations] = useState(0);
    const [backups, setBackups] = useState([]);
    const [isBackingUp, setIsBackingUp] = useState(false);
    const [isDownloadingCSV, setIsDownloadingCSV] = useState(false);

    const { syncState, syncType, lastSyncTimes, startTaskSync, startQcSync, startTranslation, translationData, stopTranslationEngine } = useSync();

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [transRes, backupRes] = await Promise.all([
                    axios.get(`${API_URL}/api/dashboard/translate/pending`),
                    axios.get(`${API_URL}/api/backups/list`).catch(() => ({ data: { backups: [] } }))
                ]);
                setPendingTranslations(transRes.data.pendingCount);
                setBackups(backupRes.data.backups);
            } catch (err) {
                console.error("Failed to fetch sync page data:", err);
            }
        };
        fetchData();
    }, [syncState, translationData.isRunning]);

    const handleCreateBackup = async () => {
        setIsBackingUp(true);
        try {
            await axios.post(`${API_URL}/api/backups/create`);
            const backupRes = await axios.get(`${API_URL}/api/backups/list`);
            setBackups(backupRes.data.backups);
        } catch (error) {
            console.error("Failed to create backup", error);
            alert("Failed to create backup.");
        } finally {
            setIsBackingUp(false);
        }
    };

    // --- NEW: CSV DOWNLOAD LOGIC ---
    // Learning Note: To download a file from an API, we request it as a 'blob' (binary large object).
    // We then create a temporary hidden <a> tag in the DOM, attach the blob's URL to it, click it programmatically, and remove it.
    const handleDownloadCSV = () => {
        setIsDownloadingCSV(true);
        
        try {
            // Because it's a GET request that returns an attachment stream, 
            // we can trigger it instantly by simulating a native browser navigation.
            // This uses ZERO browser memory, no matter how big the CSV gets.
            window.location.href = `${API_URL}/api/backups/csv`;
            
            // Just resetting the button visually after a short delay 
            // since the browser handles the actual download in the background.
            setTimeout(() => {
                setIsDownloadingCSV(false);
            }, 2000);
            
        } catch (error) {
            console.error("Failed to trigger CSV download", error);
            setIsDownloadingCSV(false);
        }
    };

    const formatTime = (isoString) => {
        if (!isoString) return 'Never synced';
        return new Date(isoString).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
    };

    const handleTaskSync = () => startTaskSync([{ id: PROJECTS.OFFICE, category: 'OFFICE', name: 'Office Tasks' }, { id: PROJECTS.HOUSE, category: 'HOUSE', name: 'House Tasks' }]);
    const handleQcSync = () => startQcSync([{ id: PROJECTS.OFFICE, category: 'OFFICE', name: 'Office Tasks' }, { id: PROJECTS.HOUSE, category: 'HOUSE', name: 'House Tasks' }]);

    const translationPercent = translationData.total > 0 ? Math.round((translationData.processed / translationData.total) * 100) : 0;
    const isStopping = translationData.message === "Stopping Engine...";

    return (
        <div className="dashboard-card sync-page-container">
            <div className="sync-page-header">
                <h2 className="dashboard-header" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                    <div className="sync-main-icon"><Database size={24} /></div>
                    Data Synchronization
                </h2>
                <p className="sync-page-desc">
                    Pull the latest data and translations from Lightwheel into the local database. These processes run safely in the background.
                </p>
            </div>

            <div className="sync-grid">
                <div className="sync-card">
                    <div className="sync-card-header">
                        <div className="sync-icon-wrapper task"><Layers size={24} /></div>
                        <div>
                            <h3 className="sync-card-title">Task Directory</h3>
                            <div className="sync-last-updated"><Clock size={12} /> Last Synced: {formatTime(lastSyncTimes.task)}</div>
                        </div>
                    </div>
                    <p className="sync-card-body">Updates the global dictionary of tasks. Fetches total required videos, current pulled progress, and translates task instructions.</p>
                    <button className="sync-action-btn" onClick={handleTaskSync} disabled={syncState === 'syncing'}>
                        <RefreshCw size={16} className={syncState === 'syncing' && syncType === 'TASK' ? 'spinning' : ''} />
                        {syncState === 'syncing' && syncType === 'TASK' ? 'Syncing...' : 'Sync Tasks Now'}
                    </button>
                </div>

                <div className="sync-card">
                    <div className="sync-card-header">
                        <div className="sync-icon-wrapper qc"><ShieldAlert size={24} /></div>
                        <div>
                            <h3 className="sync-card-title">QC Records</h3>
                            <div className="sync-last-updated"><Clock size={12} /> Last Synced: {formatTime(lastSyncTimes.qc)}</div>
                        </div>
                    </div>
                    <p className="sync-card-body">Triggers a massive background export on Lightwheel. Downloads thousands of QC records instantly without translating to save time.</p>
                    <button className="sync-action-btn" onClick={handleQcSync} disabled={syncState === 'syncing'}>
                        <RefreshCw size={16} className={syncState === 'syncing' && syncType === 'QC' ? 'spinning' : ''} />
                        {syncState === 'syncing' && syncType === 'QC' ? 'Syncing...' : 'Sync QC Records'}
                    </button>
                </div>

                <div className="sync-card">
                    <div className="sync-card-header">
                        <div className="sync-icon-wrapper translate"><Languages size={24} /></div>
                        <div>
                            <h3 className="sync-card-title">Translation Engine</h3>
                            <div className="sync-last-updated" style={{ color: pendingTranslations > 0 ? '#f59e0b' : '#10b981', fontWeight: '600' }}>
                                Pending: {translationData.isRunning ? 'Running...' : pendingTranslations.toLocaleString()}
                            </div>
                        </div>
                    </div>
                    <p className="sync-card-body">Scans the local database for failed QC records that haven't been translated yet. Processes quietly in the background.</p>
                    <button className="sync-action-btn" onClick={startTranslation} disabled={translationData.isRunning || pendingTranslations === 0}>
                        <RefreshCw size={16} className={translationData.isRunning ? 'spinning' : ''} />
                        {translationData.isRunning ? 'Engine Running...' : pendingTranslations === 0 ? 'Fully Translated' : 'Translate Pending Records'}
                    </button>

                    {translationData.isRunning && (
                        <div className="translation-progress-box">
                            <div className="progress-header">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span>{translationData.message}</span>
                                    {!isStopping ? (
                                        <button onClick={stopTranslationEngine} title="Force Stop Engine" className="stop-engine-btn"><XCircle size={16} /></button>
                                    ) : (
                                        <RefreshCw size={14} className="spinning" style={{ color: '#ef4444', opacity: 0.8 }} />
                                    )}
                                </div>
                                <span>{translationData.speed} req/sec</span>
                            </div>
                            <div className="progress-track">
                                <div className="progress-fill" style={{ width: `${translationPercent}%` }}></div>
                            </div>
                            <div className="progress-stats">
                                {translationData.processed.toLocaleString()} / {translationData.total.toLocaleString()} ({translationPercent}%)
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="sync-divider"></div>

            <div className="bottom-dashboards single-column">
                <div className="bottom-card backups-card">
                    <div className="bottom-card-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div className="icon-badge success"><HardDrive size={20} /></div>
                            <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '18px' }}>Local Data Vault</h3>
                        </div>
                        
                        {/* BUTTON CONTAINER FOR CSV AND BACKUP */}
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <button 
                                className="create-backup-btn" 
                                onClick={handleDownloadCSV} 
                                disabled={isDownloadingCSV || syncState === 'syncing'}
                                style={{ backgroundColor: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}
                            >
                                {isDownloadingCSV ? <RefreshCw size={14} className="spinning" /> : <Download size={14} />}
                                {isDownloadingCSV ? 'Generating...' : 'Download CSV'}
                            </button>

                            <button className="create-backup-btn" onClick={handleCreateBackup} disabled={isBackingUp || syncState === 'syncing'}>
                                {isBackingUp ? <RefreshCw size={14} className="spinning" /> : <Archive size={14} />}
                                {isBackingUp ? 'Creating Vault...' : 'Create Backup'}
                            </button>
                        </div>
                    </div>
                    <p className="bottom-card-desc">Hard backups stored directly on your server disk as JSON snapshots. These cannot be altered by third-party APIs.</p>

                    <div className="table-wrapper">
                        <table className="sync-table">
                            <thead>
                                <tr>
                                    <th>Snapshot Date</th>
                                    <th>File Size</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {backups.length > 0 ? (
                                    backups.map((bk, i) => (
                                        <tr key={i}>
                                            <td style={{ fontWeight: '500', color: 'var(--text-main)' }}>{new Date(bk.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                                            <td style={{ color: 'var(--text-muted)' }}>{bk.sizeMB} MB</td>
                                            <td><span className="status-badge passed">Secured</span></td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="3" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>No backups found on disk.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}