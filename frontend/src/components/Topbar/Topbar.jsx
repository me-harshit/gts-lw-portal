import { Moon, Sun, Bell, Box, Loader2, CheckCircle, AlertCircle, Layers, ShieldAlert, LogOut } from 'lucide-react';
import { useSync } from '../../context/SyncContext'; 
import axios from 'axios';
import { API_URL } from '../../config/constants';
import './Topbar.css';

export default function Topbar({ isDarkMode, toggleTheme }) {
    const { syncState, syncMessage, progress, syncType, lastSyncTimes } = useSync();

    // Get user info from localStorage
    const userString = localStorage.getItem('user');
    const user = userString ? JSON.parse(userString) : null;
    const userInitial = user?.username ? user.username.charAt(0).toUpperCase() : 'U';

    const formatShortTime = (isoString) => {
        if (!isoString) return 'Never';
        return new Date(isoString).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
    };

    const handleLogout = async () => {
        try {
            await axios.post(`${API_URL}/api/auth/logout`, {}, { withCredentials: true });
        } catch (err) {
            console.error("Logout error", err);
        } finally {
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
    };

    return (
        <header className="topbar">
            
            <div className="topbar-logo">
                <div className="logo-icon-wrapper">
                    <Box size={20} strokeWidth={2.5} />
                </div>
                GTS <span className="logo-accent">x</span> Lightwheel
            </div>

            <div className="topbar-center">
                {syncState !== 'idle' && (
                    <div className={`global-sync-badge ${syncState}`}>
                        {syncState === 'syncing' && <Loader2 size={16} className="spinning" />}
                        {syncState === 'success' && <CheckCircle size={16} />}
                        {syncState === 'error' && <AlertCircle size={16} />}
                        
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span className="sync-badge-title">
                                {syncType === 'TASK' ? 'Task Sync' : 
                                 syncType === 'TRANSLATE' ? 'Translation' : 'QC Sync'}: {syncMessage}
                            </span>
                            {syncState === 'syncing' && progress > 0 && (
                                <span className="sync-badge-progress">Processed: {progress.toLocaleString()} rows</span>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div className="topbar-right">
                
                <div className="topbar-timestamps">
                    <div className="timestamp-item" title="Last Task Sync">
                        <Layers size={14} className="timestamp-icon task" />
                        <span>{formatShortTime(lastSyncTimes.task)}</span>
                    </div>
                    <div className="timestamp-divider"></div>
                    <div className="timestamp-item" title="Last QC Sync">
                        <ShieldAlert size={14} className="timestamp-icon qc" />
                        <span>{formatShortTime(lastSyncTimes.qc)}</span>
                    </div>
                </div>

                <button className="icon-btn" aria-label="Notifications">
                    <Bell size={20} />
                </button>
                
                <button 
                    className={`theme-pill ${isDarkMode ? 'dark' : 'light'}`} 
                    onClick={toggleTheme}
                    aria-label="Toggle Dark Mode"
                >
                    <Sun size={14} className="track-icon" />
                    <Moon size={14} className="track-icon" />
                    <div className="theme-thumb">
                        {isDarkMode ? <Moon size={14} strokeWidth={2.5} /> : <Sun size={14} strokeWidth={2.5} />}
                    </div>
                </button>
                
                {/* Dynamic Avatar */}
                <div className="avatar" title={user?.username}>{userInitial}</div>

                {/* Logout Button */}
                <button className="icon-btn" onClick={handleLogout} title="Logout" style={{ marginLeft: '4px', color: '#ef4444' }}>
                    <LogOut size={20} />
                </button>
            </div>
        </header>
    );
}