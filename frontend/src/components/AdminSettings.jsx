import { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, Key, User, Link as LinkIcon, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import './AdminSettings.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function AdminSettings() {
    const [config, setConfig] = useState({
        lightwheelToken: '',
        lightwheelUsername: '',
        lightwheelQcApi: '',
        lightwheelTaskApi: ''
    });
    
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [status, setStatus] = useState({ type: '', message: '' }); // 'success' or 'error'

    // Fetch current settings on load
    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const res = await axios.get(`${API_URL}/api/config`);
                if (res.data) {
                    setConfig({
                        lightwheelToken: res.data.lightwheelToken || '',
                        lightwheelUsername: res.data.lightwheelUsername || '',
                        lightwheelQcApi: res.data.lightwheelQcApi || '',
                        lightwheelTaskApi: res.data.lightwheelTaskApi || ''
                    });
                }
            } catch (error) {
                setStatus({ type: 'error', message: 'Failed to load configuration.' });
            } finally {
                setIsLoading(false);
            }
        };
        fetchConfig();
    }, []);

    const handleSave = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        setStatus({ type: '', message: '' });

        try {
            await axios.put(`${API_URL}/api/config`, config);
            setStatus({ type: 'success', message: 'Settings saved successfully!' });
            
            // Clear success message after 3 seconds
            setTimeout(() => setStatus({ type: '', message: '' }), 3000);
        } catch (error) {
            setStatus({ type: 'error', message: 'Failed to save settings. Check backend connection.' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleChange = (e) => {
        setConfig({ ...config, [e.target.name]: e.target.value });
    };

    if (isLoading) {
        return <div style={{ padding: '40px', color: 'var(--text-main)' }}>Loading settings...</div>;
    }

    return (
        <div className="dashboard-card" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ marginBottom: '24px' }}>
                <h2 className="dashboard-header" style={{ margin: 0 }}>System Configuration</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '8px' }}>
                    Manage Lightwheel API credentials and endpoints. These settings power the background synchronization engines.
                </p>
            </div>

            {status.message && (
                <div style={{ 
                    display: 'flex', alignItems: 'center', gap: '8px', 
                    padding: '12px 16px', borderRadius: '8px', marginBottom: '24px',
                    background: status.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    color: status.type === 'success' ? '#10b981' : '#ef4444',
                    border: `1px solid ${status.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
                }}>
                    {status.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                    <span style={{ fontWeight: '500', fontSize: '14px' }}>{status.message}</span>
                </div>
            )}

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* Token Field */}
                <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
                        <Key size={14} /> Lightwheel Authorization Token
                    </label>
                    <input 
                        type="password" 
                        name="lightwheelToken"
                        value={config.lightwheelToken} 
                        onChange={handleChange}
                        placeholder="Paste your Bearer token here..."
                        style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-main)', outline: 'none' }}
                        required
                    />
                </div>

                {/* Username Field */}
                <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
                        <User size={14} /> Lightwheel Username
                    </label>
                    <input 
                        type="text" 
                        name="lightwheelUsername"
                        value={config.lightwheelUsername} 
                        onChange={handleChange}
                        placeholder="e.g., admin@gts.com"
                        style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-main)', outline: 'none' }}
                        required
                    />
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '10px 0' }} />

                {/* API URLs */}
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '300px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
                            <LinkIcon size={14} /> QC API Endpoint
                        </label>
                        <input 
                            type="text" 
                            name="lightwheelQcApi"
                            value={config.lightwheelQcApi} 
                            onChange={handleChange}
                            style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-main)', outline: 'none' }}
                            required
                        />
                    </div>
                    <div style={{ flex: 1, minWidth: '300px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
                            <LinkIcon size={14} /> Task API Endpoint
                        </label>
                        <input 
                            type="text" 
                            name="lightwheelTaskApi"
                            value={config.lightwheelTaskApi} 
                            onChange={handleChange}
                            style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-main)', outline: 'none' }}
                            required
                        />
                    </div>
                </div>

                {/* Submit Button */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                    <button 
                        type="submit" 
                        disabled={isSaving}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', background: 'var(--primary)', color: '#fff', borderRadius: '6px', border: 'none', cursor: isSaving ? 'not-allowed' : 'pointer', fontWeight: '600' }}
                    >
                        {isSaving ? <Loader2 size={18} className="spinning" /> : <Save size={18} />}
                        {isSaving ? 'Saving...' : 'Save Configuration'}
                    </button>
                </div>
            </form>
        </div>
    );
}