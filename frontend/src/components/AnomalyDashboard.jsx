import { useState, useEffect } from 'react';
import axios from 'axios';
import { AlertTriangle, Download, Clock, ShieldAlert, Calendar, ChevronLeft, ChevronRight, TimerOff, Loader2 } from 'lucide-react';
import { generateAnomaliesPDF } from '../utils/pdfExport';
import './ProjectDashboard.css'; 
import './AnomalyDashboard.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function AnomalyDashboard() {
    const [anomalyType, setAnomalyType] = useState('DOWNGRADED'); // 'DOWNGRADED' | 'ZERO_DURATION'
    const [anomalies, setAnomalies] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    
    // Filters & Pagination
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [activeFilterBtn, setActiveFilterBtn] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const [globalLostSeconds, setGlobalLostSeconds] = useState(0); 
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

    // Reset pagination when switching tabs
    const handleTabChange = (type) => {
        setAnomalyType(type);
        setPage(1);
    };

    useEffect(() => {
        const fetchAnomalies = async () => {
            setIsLoading(true);
            try {
                let url = `${API_URL}/api/dashboard/anomalies?type=${anomalyType}&page=${page}&limit=${limit}`;
                if (startDate && endDate) {
                    url += `&startDate=${startDate}&endDate=${endDate}`;
                }
                const res = await axios.get(url);
                setAnomalies(res.data.anomalies);
                setTotalPages(res.data.totalPages);
                setTotalRecords(res.data.totalRecords);
                setGlobalLostSeconds(res.data.totalLostSeconds || 0);
            } catch (err) {
                console.error("Failed to fetch anomalies:", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchAnomalies();
    }, [startDate, endDate, page, anomalyType]);

    const handleExport = async () => {
        setIsExporting(true);
        try {
            let url = `${API_URL}/api/dashboard/anomalies?type=${anomalyType}&page=1&limit=50000`;
            if (startDate && endDate) {
                url += `&startDate=${startDate}&endDate=${endDate}`;
            }
            const res = await axios.get(url);
            if (res.data.anomalies.length > 0) {
                await generateAnomaliesPDF(res.data.anomalies, startDate, endDate, anomalyType);
            }
        } catch (error) {
            console.error("Export failed:", error);
        } finally {
            setIsExporting(false);
        }
    };

    const totalLostHours = (globalLostSeconds / 3600).toFixed(2);

    return (
        <div className="dashboard-card anomaly-dashboard-container">
            
            {/* Header Section */}
            <div className="anomaly-header-section">
                <div className="anomaly-header-left">
                    <h2 className="anomaly-header-title">
                        <AlertTriangle size={28} /> QC Anomaly Tracker
                    </h2>
                    
                    {/* --- TABS FOR ANOMALY TYPES --- */}
                    <div className="anomaly-tabs">
                        <button 
                            className={`anomaly-tab-btn ${anomalyType === 'DOWNGRADED' ? 'active' : ''}`}
                            onClick={() => handleTabChange('DOWNGRADED')}
                        >
                            <ShieldAlert size={16} /> Downgraded Records
                        </button>
                        <button 
                            className={`anomaly-tab-btn ${anomalyType === 'ZERO_DURATION' ? 'active warning' : ''}`}
                            onClick={() => handleTabChange('ZERO_DURATION')}
                        >
                            <TimerOff size={16} /> Zero-Duration Clips
                        </button>
                    </div>
                </div>

                <div className="anomaly-header-right">
                    <div className="quick-filters-container">
                        <button className={`quick-filter-btn ${activeFilterBtn === 'allTime' ? 'active' : ''}`} onClick={() => applyQuickFilter('allTime')}>All Time</button>
                        <button className={`quick-filter-btn ${activeFilterBtn === 'today' ? 'active' : ''}`} onClick={() => applyQuickFilter('today')}>Today</button>
                        <button className={`quick-filter-btn ${activeFilterBtn === 'yesterday' ? 'active' : ''}`} onClick={() => applyQuickFilter('yesterday')}>Yesterday</button>
                        <button className={`quick-filter-btn ${activeFilterBtn === 'thisWeek' ? 'active' : ''}`} onClick={() => applyQuickFilter('thisWeek')}>This Week</button>
                        <button className={`quick-filter-btn ${activeFilterBtn === 'thisMonth' ? 'active' : ''}`} onClick={() => applyQuickFilter('thisMonth')}>This Month</button>
                    </div>

                    <div className="anomaly-actions">
                        <div className="qc-filter-wrapper">
                            <Calendar size={16} className="pd-icon-muted" />
                            <input type="date" className="pd-date-input" value={startDate} onChange={(e) => handleManualDateChange(setStartDate, e.target.value)} />
                            <span className="pd-date-separator">to</span>
                            <input type="date" className="pd-date-input" value={endDate} onChange={(e) => handleManualDateChange(setEndDate, e.target.value)} />
                        </div>

                        <button className="export-anomaly-btn" onClick={handleExport} disabled={totalRecords === 0 || isExporting}>
                            {isExporting ? <Loader2 size={16} className="spinning" /> : <Download size={16} />}
                            {isExporting ? 'Generating...' : 'Export PDF'}
                        </button>
                    </div>
                </div>
            </div>

            <p className="anomaly-desc">
                {anomalyType === 'DOWNGRADED' 
                    ? "This vault tracks records that were previously marked as PASSED by Lightwheel but were retroactively downgraded to FAILED or PENDING during a subsequent sync. Your original approved durations are securely locked here."
                    : "This tracker isolates uploaded records where the system registered 0 seconds of video duration, indicating a potential file corruption or tracking bug during production."
                }
            </p>

            {/* Dynamic Stats Cards */}
            <div className="anomaly-stats-grid">
                <div className={`anomaly-stat-card ${anomalyType === 'ZERO_DURATION' ? 'warning' : 'danger'}`}>
                    <div className="anomaly-stat-label">
                        {anomalyType === 'DOWNGRADED' ? <ShieldAlert size={16} /> : <TimerOff size={16} />} 
                        Total {anomalyType === 'DOWNGRADED' ? 'Downgraded' : '0-Sec'} Records
                    </div>
                    <div className="anomaly-stat-value">
                        {isLoading ? '...' : totalRecords.toLocaleString()}
                    </div>
                </div>

                {anomalyType === 'DOWNGRADED' && (
                    <div className="anomaly-stat-card warning">
                        <div className="anomaly-stat-label"><Clock size={16} /> Grand Total Locked Hours</div>
                        <div className="anomaly-stat-value warning">
                            {isLoading ? '...' : `${totalLostHours} hr`}
                        </div>
                    </div>
                )}
            </div>

            {/* Dynamic Table */}
            <div className="anomaly-table-wrapper">
                <table className="anomaly-table">
                    <thead>
                        <tr>
                            <th>Video ID</th>
                            <th>Producer</th>
                            {anomalyType === 'DOWNGRADED' ? (
                                <>
                                    <th className="text-center">Locked Hours</th>
                                    <th className="text-center">Current Status</th>
                                    <th>Downgraded On</th>
                                </>
                            ) : (
                                <>
                                    <th>Task / Category</th>
                                    <th className="text-center">Recorded Duration</th>
                                    <th className="text-center">Current Status</th>
                                    <th>Produced On</th>
                                </>
                            )}
                        </tr>
                    </thead>
                    <tbody className={isLoading ? 'loading-opacity' : ''}>
                        {isLoading ? (
                            <tr><td colSpan="5" className="anomaly-empty-state"><Loader2 className="spinning pd-icon-center" size={24} /></td></tr>
                        ) : anomalies.length > 0 ? (
                            anomalies.map((anom) => {
                                let dateStr = 'Unknown';
                                if (anomalyType === 'DOWNGRADED') {
                                    if (anom.status_history?.length > 0) {
                                        dateStr = new Date(anom.status_history[anom.status_history.length - 1].changedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
                                    } else if (anom.updatedAt) {
                                        dateStr = new Date(anom.updatedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
                                    }
                                } else {
                                    if (anom.start_produce_time) {
                                        dateStr = new Date(anom.start_produce_time).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
                                    }
                                }

                                return (
                                    <tr key={anom._id}>
                                        <td className="anomaly-id-cell">{anom.data_name}</td>
                                        <td className="anomaly-producer-cell">{anom.producer}</td>
                                        
                                        {anomalyType === 'DOWNGRADED' ? (
                                            <>
                                                <td className="text-center anomaly-locked-cell">
                                                    {anom.locked_duration ? (anom.locked_duration / 3600).toFixed(2) + ' hr' : 'N/A'}
                                                </td>
                                                <td className="text-center">
                                                    <span className="anomaly-status-badge">
                                                        {anom.inspect_result?.replace('INSPECT_', '')}
                                                    </span>
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td>
                                                    <div style={{ fontWeight: '500', color: 'var(--text-main)' }}>{anom.task_name || 'Unknown Task'}</div>
                                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{anom.project_category}</div>
                                                </td>
                                                <td className="text-center" style={{ color: '#ef4444', fontWeight: 'bold' }}>
                                                    0h 0m
                                                </td>
                                                <td className="text-center">
                                                    <span className={`anomaly-status-badge ${anom.inspect_result === 'INSPECT_PASSED' ? 'passed' : anom.inspect_result === 'INSPECT_WAITING' ? 'pending' : ''}`}>
                                                        {anom.inspect_result?.replace('INSPECT_', '')}
                                                    </span>
                                                </td>
                                            </>
                                        )}
                                        
                                        <td className="anomaly-date-cell">{dateStr}</td>
                                    </tr>
                                )
                            })
                        ) : (
                            <tr>
                                <td colSpan="5" className="anomaly-empty-state">No anomalies detected in this date range.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div className="anomaly-pagination">
                    <div className="pagination-info">
                        Showing page <span>{page}</span> of <span>{totalPages}</span>
                    </div>
                    <div className="pagination-controls">
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="pagination-btn">
                            <ChevronLeft size={16} /> Previous
                        </button>
                        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="pagination-btn">
                            Next <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}