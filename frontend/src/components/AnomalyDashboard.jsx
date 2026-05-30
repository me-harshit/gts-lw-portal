import { useState, useEffect } from 'react';
import axios from 'axios';
import { AlertTriangle, Download, Clock, ShieldAlert, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { generateAnomaliesPDF } from '../utils/pdfExport';
import './ProjectDashboard.css'; 

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function AnomalyDashboard() {
    const [anomalies, setAnomalies] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    
    // --- DATE FILTER STATE ---
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [activeFilterBtn, setActiveFilterBtn] = useState('');

    // --- PAGINATION & STATS STATE ---
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const [globalLostSeconds, setGlobalLostSeconds] = useState(0); // <-- NEW STATE
    const limit = 50; 

    const applyQuickFilter = (type) => {
        setActiveFilterBtn(type);
        setPage(1); 
        const today = new Date();
        
        const formatDate = (date) => {
            const yyyy = date.getFullYear();
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const dd = String(date.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
        };

        if (type === 'today') {
            setStartDate(formatDate(today)); setEndDate(formatDate(today));
        } else if (type === 'yesterday') {
            const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
            setStartDate(formatDate(yesterday)); setEndDate(formatDate(yesterday));
        } else if (type === 'thisWeek') {
            const monday = new Date(today); const day = monday.getDay() || 7; monday.setDate(monday.getDate() - (day - 1));
            setStartDate(formatDate(monday)); setEndDate(formatDate(today));
        } else if (type === 'thisMonth') {
            const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
            setStartDate(formatDate(firstDay)); setEndDate(formatDate(today));
        } else if (type === 'allTime') {
            setStartDate(''); setEndDate('');
        }
    };

    const handleManualDateChange = (setter, value) => {
        setActiveFilterBtn('');
        setter(value);
        setPage(1); 
    };

    useEffect(() => {
        const fetchAnomalies = async () => {
            setIsLoading(true);
            try {
                let url = `${API_URL}/api/dashboard/anomalies?page=${page}&limit=${limit}`;
                if (startDate && endDate) {
                    url += `&startDate=${startDate}&endDate=${endDate}`;
                }
                const res = await axios.get(url);
                setAnomalies(res.data.anomalies);
                setTotalPages(res.data.totalPages);
                setTotalRecords(res.data.totalRecords);
                setGlobalLostSeconds(res.data.totalLostSeconds || 0); // <-- SET TRUE TOTAL
            } catch (err) {
                console.error("Failed to fetch anomalies:", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchAnomalies();
    }, [startDate, endDate, page]);

    const handleExport = async () => {
        setIsExporting(true);
        try {
            let url = `${API_URL}/api/dashboard/anomalies?page=1&limit=50000`;
            if (startDate && endDate) {
                url += `&startDate=${startDate}&endDate=${endDate}`;
            }
            const res = await axios.get(url);
            if (res.data.anomalies.length > 0) {
                await generateAnomaliesPDF(res.data.anomalies, startDate, endDate);
            }
        } catch (error) {
            console.error("Export failed:", error);
        } finally {
            setIsExporting(false);
        }
    };

    // Calculate the total based on the SERVER'S grand total, not the local 50 items
    const totalLostHours = (globalLostSeconds / 3600).toFixed(2);

    return (
        <div className="dashboard-card" style={{ maxWidth: '1200px', margin: '0 auto' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <h2 className="dashboard-header" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, color: '#ef4444' }}>
                        <AlertTriangle size={28} />
                        QC Anomaly Tracker
                    </h2>
                    
                    <div className="quick-filters-container" style={{ marginTop: '12px' }}>
                        <button className={`quick-filter-btn ${activeFilterBtn === 'allTime' ? 'active' : ''}`} onClick={() => applyQuickFilter('allTime')}>All Time</button>
                        <button className={`quick-filter-btn ${activeFilterBtn === 'today' ? 'active' : ''}`} onClick={() => applyQuickFilter('today')}>Today</button>
                        <button className={`quick-filter-btn ${activeFilterBtn === 'yesterday' ? 'active' : ''}`} onClick={() => applyQuickFilter('yesterday')}>Yesterday</button>
                        <button className={`quick-filter-btn ${activeFilterBtn === 'thisWeek' ? 'active' : ''}`} onClick={() => applyQuickFilter('thisWeek')}>This Week</button>
                        <button className={`quick-filter-btn ${activeFilterBtn === 'thisMonth' ? 'active' : ''}`} onClick={() => applyQuickFilter('thisMonth')}>This Month</button>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div className="qc-filter-wrapper">
                        <Calendar size={16} color="var(--text-muted)" />
                        <input 
                            type="date" value={startDate} onChange={(e) => handleManualDateChange(setStartDate, e.target.value)}
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none' }}
                        />
                        <span style={{ color: 'var(--text-muted)' }}>to</span>
                        <input 
                            type="date" value={endDate} onChange={(e) => handleManualDateChange(setEndDate, e.target.value)}
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none' }}
                        />
                    </div>

                    <button 
                        onClick={handleExport}
                        disabled={totalRecords === 0 || isExporting}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            backgroundColor: totalRecords === 0 ? 'var(--bg-secondary)' : '#ef4444',
                            color: totalRecords === 0 ? 'var(--text-muted)' : 'white',
                            border: totalRecords === 0 ? '1px solid var(--border-color)' : 'none',
                            padding: '0 16px', borderRadius: '8px', fontSize: '14px', fontWeight: '600',
                            cursor: totalRecords === 0 ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s', height: '40px'
                        }}
                    >
                        <Download size={16} />
                        {isExporting ? 'Generating...' : 'Export PDF'}
                    </button>
                </div>
            </div>

            <p style={{ color: 'var(--text-muted)', marginBottom: '32px', fontSize: '14.5px', maxWidth: '800px', lineHeight: '1.5' }}>
                This vault tracks records that were previously marked as <b>PASSED</b> by Lightwheel but were retroactively downgraded to FAILED or PENDING during a subsequent sync. Your original approved durations are securely locked here.
            </p>

            <div style={{ display: 'flex', gap: '20px', marginBottom: '32px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '200px', padding: '20px', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', borderLeft: '4px solid #ef4444' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: '600', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ShieldAlert size={16} /> Total Downgraded Records
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--text-main)' }}>
                        {isLoading ? '...' : totalRecords}
                    </div>
                </div>

                <div style={{ flex: 1, minWidth: '200px', padding: '20px', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', borderLeft: '4px solid #f59e0b' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: '600', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={16} /> Grand Total Locked Hours
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#f59e0b' }}>
                        {isLoading ? '...' : `${totalLostHours} hr`}
                    </div>
                </div>
            </div>

            <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', overflowX: 'auto', marginBottom: '16px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr>
                            <th style={{ padding: '16px', background: 'var(--bg-secondary)', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', fontWeight: '600', borderBottom: '1px solid var(--border-color)' }}>Video ID</th>
                            <th style={{ padding: '16px', background: 'var(--bg-secondary)', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', fontWeight: '600', borderBottom: '1px solid var(--border-color)' }}>Producer</th>
                            <th style={{ padding: '16px', background: 'var(--bg-secondary)', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', fontWeight: '600', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>Locked Hours</th>
                            <th style={{ padding: '16px', background: 'var(--bg-secondary)', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', fontWeight: '600', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>Current Status</th>
                            <th style={{ padding: '16px', background: 'var(--bg-secondary)', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', fontWeight: '600', borderBottom: '1px solid var(--border-color)' }}>Downgraded On</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan="5" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading records...</td></tr>
                        ) : anomalies.length > 0 ? (
                            anomalies.map((anom) => {
                                let changedDate = 'Unknown';
                                if (anom.status_history && anom.status_history.length > 0) {
                                    changedDate = new Date(anom.status_history[anom.status_history.length - 1].changedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
                                } else if (anom.updatedAt) {
                                    changedDate = new Date(anom.updatedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
                                }

                                return (
                                    <tr key={anom._id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '16px', fontFamily: 'monospace', color: 'var(--primary)', fontSize: '13px' }}>{anom.data_name}</td>
                                        <td style={{ padding: '16px', color: 'var(--text-main)', fontWeight: '500' }}>{anom.producer}</td>
                                        <td style={{ padding: '16px', textAlign: 'center', fontWeight: 'bold', color: '#10b981' }}>{anom.locked_duration ? (anom.locked_duration / 3600).toFixed(2) + ' hr' : 'N/A'}</td>
                                        <td style={{ padding: '16px', textAlign: 'center' }}>
                                            <span style={{ padding: '6px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                                                {anom.inspect_result.replace('INSPECT_', '')}
                                            </span>
                                        </td>
                                        <td style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '13px' }}>{changedDate}</td>
                                    </tr>
                                )
                            })
                        ) : (
                            <tr>
                                <td colSpan="5" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No downgrades detected in this date range.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                        Showing page <span style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>{page}</span> of <span style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>{totalPages}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            style={{ 
                                display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 12px', borderRadius: '6px', 
                                border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-main)', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.5 : 1
                            }}
                        >
                            <ChevronLeft size={16} /> Previous
                        </button>
                        <button 
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            style={{ 
                                display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 12px', borderRadius: '6px', 
                                border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-main)', cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.5 : 1
                            }}
                        >
                            Next <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}