import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Calendar, ChevronLeft, ChevronRight, Search, Filter, UserCheck, AlertCircle, X, Eye, ChevronDown, Users, Download, Video, Clock } from 'lucide-react';
import { generateAttendancePDF } from '../utils/pdfExport'; 
import './ProjectDashboard.css'; 
import './AttendanceDashboard.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const CustomSelect = ({ value, onChange, options, icon: Icon, placeholder }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedLabel = options.find(o => o.value === value)?.label || placeholder;

    return (
        <div className="custom-dropdown-container" style={{ width: 'auto', minWidth: '160px' }} ref={dropdownRef}>
            <div className="custom-dropdown-header" onClick={() => setIsOpen(!isOpen)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {Icon && <Icon size={16} color="var(--text-muted)" />}
                    <span>{selectedLabel}</span>
                </div>
                <ChevronDown size={16} color="var(--text-muted)" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }} />
            </div>
            {isOpen && (
                <div className="custom-dropdown-menu">
                    <ul className="custom-dropdown-list">
                        {options.map(opt => (
                            <li 
                                key={opt.value} 
                                className={`custom-dropdown-item ${value === opt.value ? 'active' : ''}`}
                                onClick={() => { onChange(opt.value); setIsOpen(false); }}
                            >
                                {opt.label}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default function AttendanceDashboard() {
    // --- UI TABS ---
    const [activeTab, setActiveTab] = useState('LIVE'); // 'LIVE' or 'HISTORY'

    // --- STATE ---
    const [attendance, setAttendance] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [teams, setTeams] = useState([]);

    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [activeFilterBtn, setActiveFilterBtn] = useState('thisMonth');
    const [teamCategory, setTeamCategory] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');

    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const limit = 50;

    const [selectedProducer, setSelectedProducer] = useState(null);

    useEffect(() => {
        applyQuickFilter('thisMonth');
        fetchTeams();
    }, []);

    const fetchTeams = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/teams`);
            const uniqueTeams = new Set(res.data.map(m => m.teamName));
            setTeams(Array.from(uniqueTeams));
        } catch (error) { console.error("Failed to load teams", error); }
    };

    useEffect(() => {
        if (!startDate || !endDate) return; 
        const fetchAttendance = async () => {
            setIsLoading(true);
            try {
                let url = `${API_URL}/api/attendance?page=${page}&limit=${limit}&startDate=${startDate}&endDate=${endDate}`;
                if (teamCategory !== 'ALL') url += `&team=${teamCategory}`;
                if (searchQuery) url += `&producer=${searchQuery}`;

                const res = await axios.get(url);
                setAttendance(res.data.attendance);
                setTotalPages(res.data.totalPages);
                setTotalRecords(res.data.totalRecords);
            } catch (err) { console.error("Failed to fetch attendance:", err); } 
            finally { setIsLoading(false); }
        };
        const timeoutId = setTimeout(() => fetchAttendance(), 300);
        return () => clearTimeout(timeoutId);
    }, [startDate, endDate, page, teamCategory, searchQuery]);

    const applyQuickFilter = (type) => {
        setActiveFilterBtn(type);
        setPage(1);
        const today = new Date();
        const formatDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

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
        }
    };

    const handleManualDateChange = (setter, value) => {
        setActiveFilterBtn(''); setter(value); setPage(1);
    };

    const getExpectedWorkingDays = () => {
        if (!startDate || !endDate) return 0;
        let start = new Date(startDate);
        let end = new Date(endDate);
        let count = 0;
        let current = new Date(start);
        while (current <= end) {
            if (current.getDay() !== 0) count++; 
            current.setDate(current.getDate() + 1);
        }
        return count;
    };

    const expectedWorkingDays = getExpectedWorkingDays();

    const handleExportPDF = async () => {
        setIsExporting(true);
        try {
            let url = `${API_URL}/api/attendance?page=1&limit=50000&startDate=${startDate}&endDate=${endDate}`;
            if (teamCategory !== 'ALL') url += `&team=${teamCategory}`;
            if (searchQuery) url += `&producer=${searchQuery}`;

            const res = await axios.get(url);
            if (res.data.attendance.length > 0) {
                await generateAttendancePDF(res.data.attendance, startDate, endDate, expectedWorkingDays, teamCategory);
            }
        } catch (error) {
            console.error("Export failed:", error);
        } finally {
            setIsExporting(false);
        }
    };

    const formatTimeIST = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    };

    const formatOfficeHours = (seconds) => {
        if (!seconds || seconds <= 0) return '0h 0m';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return `${h}h ${m}m`;
    };

    // --- LIVE SHIFT LOGIC (Fallback grouping until backend provides shift_type) ---
    const getShiftGroups = () => {
        const groups = {
            'Morning (7 AM - 3 PM)': [],
            'Regular (9 AM - 5 PM)': [],
            'Evening (3 PM - 11 PM)': [],
            'Night (9 PM - 7 AM)': []
        };

        // For "Live", we only want people who checked in today
        const todayStr = new Date().toISOString().split('T')[0];
        
        attendance.forEach(producer => {
            const todayRecord = producer.dailyRecords.find(r => r.date.startsWith(todayStr));
            if (!todayRecord) return; // Not present today

            // Use backend shift if available, otherwise guess via hour
            if (producer.shift) {
                if (groups[producer.shift]) groups[producer.shift].push({ producer: producer.producer, ...todayRecord });
            } else {
                const hour = new Date(todayRecord.checkIn).getHours();
                if (hour >= 6 && hour < 9) groups['Morning (7 AM - 3 PM)'].push({ producer: producer.producer, ...todayRecord });
                else if (hour >= 9 && hour < 14) groups['Regular (9 AM - 5 PM)'].push({ producer: producer.producer, ...todayRecord });
                else if (hour >= 14 && hour < 20) groups['Evening (3 PM - 11 PM)'].push({ producer: producer.producer, ...todayRecord });
                else groups['Night (9 PM - 7 AM)'].push({ producer: producer.producer, ...todayRecord });
            }
        });

        return groups;
    };

    const liveShifts = getShiftGroups();

    return (
        <div className="dashboard-card" style={{ maxWidth: '1400px', margin: '0 auto' }}>
            
            {/* HEADER & TABS */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <h2 className="dashboard-header" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, color: 'var(--primary)' }}>
                        <UserCheck size={28} /> Attendance
                    </h2>
                    
                    {/* TAB NAVIGATION */}
                    <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-secondary)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <button 
                            onClick={() => setActiveTab('LIVE')}
                            style={{ padding: '8px 16px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', background: activeTab === 'LIVE' ? 'var(--primary)' : 'transparent', color: activeTab === 'LIVE' ? '#fff' : 'var(--text-muted)' }}
                        >
                            Live Shifts
                        </button>
                        <button 
                            onClick={() => setActiveTab('HISTORY')}
                            style={{ padding: '8px 16px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', background: activeTab === 'HISTORY' ? 'var(--primary)' : 'transparent', color: activeTab === 'HISTORY' ? '#fff' : 'var(--text-muted)' }}
                        >
                            Historical Roster
                        </button>
                    </div>
                </div>

                {/* FILTERS (Only show on History Tab) */}
                {activeTab === 'HISTORY' && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '12px' }}>
                        <div className="quick-filters-container">
                            <button className={`quick-filter-btn ${activeFilterBtn === 'today' ? 'active' : ''}`} onClick={() => applyQuickFilter('today')}>Today</button>
                            <button className={`quick-filter-btn ${activeFilterBtn === 'yesterday' ? 'active' : ''}`} onClick={() => applyQuickFilter('yesterday')}>Yesterday</button>
                            <button className={`quick-filter-btn ${activeFilterBtn === 'thisWeek' ? 'active' : ''}`} onClick={() => applyQuickFilter('thisWeek')}>This Week</button>
                            <button className={`quick-filter-btn ${activeFilterBtn === 'thisMonth' ? 'active' : ''}`} onClick={() => applyQuickFilter('thisMonth')}>This Month</button>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <div className="qc-filter-wrapper search-wrapper">
                                <Search size={16} color="var(--text-muted)" />
                                <input type="text" placeholder="Search Producer..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }} className="attendance-search" />
                            </div>

                            <CustomSelect icon={Users} value={teamCategory} onChange={(val) => { setTeamCategory(val); setPage(1); }} options={[{ value: 'ALL', label: 'All Teams' }, ...teams.map(t => ({ value: t, label: t }))]} />

                            <div className="qc-filter-wrapper">
                                <Calendar size={16} color="var(--text-muted)" />
                                <input type="date" value={startDate} onChange={(e) => handleManualDateChange(setStartDate, e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none' }} />
                                <span style={{ color: 'var(--text-muted)' }}>to</span>
                                <input type="date" value={endDate} onChange={(e) => handleManualDateChange(setEndDate, e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none' }} />
                            </div>

                            <button onClick={handleExportPDF} disabled={totalRecords === 0 || isExporting} style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: totalRecords === 0 ? 'var(--bg-secondary)' : 'var(--primary)', color: totalRecords === 0 ? 'var(--text-muted)' : 'white', border: totalRecords === 0 ? '1px solid var(--border-color)' : 'none', padding: '0 16px', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: totalRecords === 0 ? 'not-allowed' : 'pointer', height: '40px' }}>
                                <Download size={16} /> {isExporting ? 'Generating...' : 'Export PDF'}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', marginBottom: '24px' }} />

            {/* ============================== */}
            {/* VIEW 1: LIVE SHIFTS */}
            {/* ============================== */}
            {activeTab === 'LIVE' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                    {Object.entries(liveShifts).map(([shiftName, producers]) => (
                        <div key={shiftName} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
                            <div style={{ background: 'var(--primary)', padding: '12px 16px', color: 'white', fontWeight: '600', display: 'flex', justifyContent: 'space-between' }}>
                                <span>{shiftName}</span>
                                <span style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '12px', fontSize: '12px' }}>{producers.length} Present</span>
                            </div>
                            <div style={{ padding: '16px', maxHeight: '400px', overflowY: 'auto' }}>
                                {producers.length === 0 ? (
                                    <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>No active producers in this shift.</div>
                                ) : (
                                    producers.map((p, i) => (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i !== producers.length -1 ? '1px solid var(--border-color)' : 'none' }}>
                                            <div>
                                                <div style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '14px' }}>{p.producer}</div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', gap: '8px', marginTop: '4px' }}>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={12}/> In: {formatTimeIST(p.checkIn)}</span>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Video size={12}/> {p.totalVideos} vids</span>
                                                </div>
                                            </div>
                                            <div style={{ fontWeight: 'bold', color: 'var(--primary)', fontSize: '13px' }}>
                                                {formatOfficeHours(p.officeDurationSec)}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ============================== */}
            {/* VIEW 2: HISTORICAL ROSTER */}
            {/* ============================== */}
            {activeTab === 'HISTORY' && (
                <>
                    <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', overflowX: 'auto', marginBottom: '16px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr>
                                    <th className="att-th">Producer</th>
                                    <th className="att-th" style={{ textAlign: 'center' }}>Present Days</th>
                                    <th className="att-th" style={{ textAlign: 'center' }}>Leaves</th>
                                    <th className="att-th" style={{ textAlign: 'center' }}>Total Videos</th>
                                    <th className="att-th" style={{ textAlign: 'center' }}>Recorded Hours</th>
                                    <th className="att-th" style={{ textAlign: 'center' }}>Office Hours</th>
                                    <th className="att-th" style={{ textAlign: 'center' }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    <tr><td colSpan="7" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading roster...</td></tr>
                                ) : attendance.length > 0 ? (
                                    attendance.map((record) => {
                                        const leaves = Math.max(0, expectedWorkingDays - record.presentDays);
                                        return (
                                            <tr key={record.producer} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                <td style={{ padding: '16px', color: 'var(--text-main)', fontWeight: '600' }}>{record.producer}</td>
                                                <td style={{ padding: '16px', textAlign: 'center', fontWeight: 'bold', color: '#10b981' }}>{record.presentDays} / {expectedWorkingDays}</td>
                                                <td style={{ padding: '16px', textAlign: 'center', fontWeight: 'bold', color: leaves > 0 ? '#ef4444' : 'var(--text-muted)' }}>{leaves}</td>
                                                <td style={{ padding: '16px', textAlign: 'center', fontWeight: '600' }}>{record.totalVideos}</td>
                                                <td style={{ padding: '16px', textAlign: 'center', fontWeight: 'bold', color: 'var(--primary)' }}>{formatOfficeHours(record.totalRecordedSec)}</td>
                                                <td style={{ padding: '16px', textAlign: 'center', fontWeight: 'bold', color: 'var(--text-main)' }}>{formatOfficeHours(record.totalOfficeDurationSec)}</td>
                                                <td style={{ padding: '16px', textAlign: 'center' }}>
                                                    <button className="view-details-btn" onClick={() => setSelectedProducer(record)}>
                                                        <Eye size={14} /> Details
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    })
                                ) : (
                                    <tr><td colSpan="7" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No records found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {totalPages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
                            <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Page <span style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>{page}</span> of {totalPages}</div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="att-page-btn"><ChevronLeft size={16} /> Prev</button>
                                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="att-page-btn">Next <ChevronRight size={16} /></button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* --- RIGHT OVERLAY SIDEBAR --- */}
            <div className={`attendance-overlay ${selectedProducer ? 'open' : ''}`}>
                <div className="overlay-header">
                    <div>
                        <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '18px' }}>{selectedProducer?.producer}</h3>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>Daily Breakdown</div>
                    </div>
                    <button onClick={() => setSelectedProducer(null)} className="overlay-close-btn"><X size={20} /></button>
                </div>
                
                <div className="overlay-content">
                    {selectedProducer && selectedProducer.dailyRecords.map((day, idx) => {
                        const isSingleVideo = day.totalVideos === 1;
                        return (
                            <div key={idx} className="daily-record-card">
                                <div style={{ fontWeight: '600', color: 'var(--primary)', marginBottom: '12px' }}>
                                    {new Date(day.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                                </div>
                                
                                <div className="daily-stats-grid" style={{ gridTemplateColumns: '1fr 1fr', rowGap: '16px', columnGap: '12px' }}>
                                    <div>
                                        <div className="daily-label">First Video Recorded</div>
                                        <div style={{ fontWeight: 'bold', color: '#10b981', fontSize: '14px' }}>{formatTimeIST(day.checkIn)}</div>
                                    </div>
                                    <div>
                                        <div className="daily-label">Last Video Recorded</div>
                                        <div style={{ fontWeight: 'bold', color: isSingleVideo ? 'var(--text-muted)' : '#f59e0b', fontSize: '14px' }}>
                                            {isSingleVideo ? 'N/A' : formatTimeIST(day.checkOut)}
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <div className="daily-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Video size={12}/> Recorded</div>
                                        <div style={{ fontWeight: 'bold', color: 'var(--primary)', fontSize: '14px' }}>{formatOfficeHours(day.recordedSec)}</div>
                                    </div>
                                    <div>
                                        <div className="daily-label">Office Time</div>
                                        <div style={{ fontWeight: 'bold', color: 'var(--text-main)', fontSize: '14px' }}>{isSingleVideo ? '0h 0m' : formatOfficeHours(day.officeDurationSec)}</div>
                                    </div>

                                    <div style={{ gridColumn: '1 / -1', background: 'var(--bg-main)', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span className="daily-label" style={{ margin: 0 }}>Total Videos Submissions:</span>
                                        <span style={{ fontWeight: 'bold' }}>
                                            {isSingleVideo ? <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}><AlertCircle size={12}/> 1</span> : day.totalVideos}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
            
            {/* OVERLAY BACKDROP */}
            {selectedProducer && <div className="overlay-backdrop" onClick={() => setSelectedProducer(null)}></div>}

        </div>
    );
}