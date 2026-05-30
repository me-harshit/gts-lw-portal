import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Calendar, ChevronLeft, ChevronRight, Search, Filter, UserCheck, AlertCircle, X, Eye, ChevronDown, Users } from 'lucide-react';
import './ProjectDashboard.css'; 
import './AttendanceDashboard.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// --- CUSTOM DROPDOWN COMPONENT ---
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
    const [attendance, setAttendance] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [teams, setTeams] = useState([]);

    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [activeFilterBtn, setActiveFilterBtn] = useState('thisWeek');
    const [teamCategory, setTeamCategory] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');

    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const limit = 50;

    const [selectedProducer, setSelectedProducer] = useState(null);

    useEffect(() => {
        applyQuickFilter('thisWeek');
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
            if (current.getDay() !== 0) count++; // 0 is Sunday
            current.setDate(current.getDate() + 1);
        }
        return count;
    };

    const expectedWorkingDays = getExpectedWorkingDays();

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

    return (
        <div className="dashboard-card" style={{ maxWidth: '1400px', margin: '0 auto' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <h2 className="dashboard-header" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, color: 'var(--primary)' }}>
                        <UserCheck size={28} /> Attendance Roster
                    </h2>
                    
                    <div className="quick-filters-container" style={{ marginTop: '12px' }}>
                        <button className={`quick-filter-btn ${activeFilterBtn === 'today' ? 'active' : ''}`} onClick={() => applyQuickFilter('today')}>Today</button>
                        <button className={`quick-filter-btn ${activeFilterBtn === 'yesterday' ? 'active' : ''}`} onClick={() => applyQuickFilter('yesterday')}>Yesterday</button>
                        <button className={`quick-filter-btn ${activeFilterBtn === 'thisWeek' ? 'active' : ''}`} onClick={() => applyQuickFilter('thisWeek')}>This Week</button>
                        <button className={`quick-filter-btn ${activeFilterBtn === 'thisMonth' ? 'active' : ''}`} onClick={() => applyQuickFilter('thisMonth')}>This Month</button>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div className="qc-filter-wrapper search-wrapper">
                        <Search size={16} color="var(--text-muted)" />
                        <input type="text" placeholder="Search Producer..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }} className="attendance-search" />
                    </div>

                    {/* NEW CUSTOM SELECT DROPDOWN */}
                    <CustomSelect 
                        icon={Users}
                        value={teamCategory}
                        onChange={(val) => { setTeamCategory(val); setPage(1); }}
                        options={[{ value: 'ALL', label: 'All Teams' }, ...teams.map(t => ({ value: t, label: t }))]}
                    />

                    <div className="qc-filter-wrapper">
                        <Calendar size={16} color="var(--text-muted)" />
                        <input type="date" value={startDate} onChange={(e) => handleManualDateChange(setStartDate, e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none' }} />
                        <span style={{ color: 'var(--text-muted)' }}>to</span>
                        <input type="date" value={endDate} onChange={(e) => handleManualDateChange(setEndDate, e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none' }} />
                    </div>
                </div>
            </div>

            <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', overflowX: 'auto', marginBottom: '16px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr>
                            <th className="att-th">Producer</th>
                            <th className="att-th" style={{ textAlign: 'center' }}>Present Days</th>
                            <th className="att-th" style={{ textAlign: 'center' }}>Leaves</th>
                            <th className="att-th" style={{ textAlign: 'center' }}>Total Videos</th>
                            <th className="att-th" style={{ textAlign: 'center' }}>Total Office Hours</th>
                            <th className="att-th" style={{ textAlign: 'center' }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading roster...</td></tr>
                        ) : attendance.length > 0 ? (
                            attendance.map((record) => {
                                const leaves = Math.max(0, expectedWorkingDays - record.presentDays);
                                return (
                                    <tr key={record.producer} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '16px', color: 'var(--text-main)', fontWeight: '600' }}>{record.producer}</td>
                                        <td style={{ padding: '16px', textAlign: 'center', fontWeight: 'bold', color: '#10b981' }}>{record.presentDays} / {expectedWorkingDays}</td>
                                        <td style={{ padding: '16px', textAlign: 'center', fontWeight: 'bold', color: leaves > 0 ? '#ef4444' : 'var(--text-muted)' }}>{leaves}</td>
                                        <td style={{ padding: '16px', textAlign: 'center', fontWeight: '600' }}>{record.totalVideos}</td>
                                        <td style={{ padding: '16px', textAlign: 'center', fontWeight: 'bold', color: 'var(--primary)' }}>{formatOfficeHours(record.totalOfficeDurationSec)}</td>
                                        <td style={{ padding: '16px', textAlign: 'center' }}>
                                            <button className="view-details-btn" onClick={() => setSelectedProducer(record)}>
                                                <Eye size={14} /> Details
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })
                        ) : (
                            <tr><td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No records found.</td></tr>
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
                                <div style={{ fontWeight: '600', color: 'var(--primary)', marginBottom: '8px' }}>
                                    {new Date(day.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                                </div>
                                <div className="daily-stats-grid">
                                    <div>
                                        <div className="daily-label">Check In</div>
                                        <div style={{ fontWeight: 'bold', color: '#10b981' }}>{formatTimeIST(day.checkIn)}</div>
                                    </div>
                                    <div>
                                        <div className="daily-label">Check Out</div>
                                        <div style={{ fontWeight: 'bold', color: isSingleVideo ? 'var(--text-muted)' : '#f59e0b' }}>
                                            {isSingleVideo ? 'N/A' : formatTimeIST(day.checkOut)}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="daily-label">Videos</div>
                                        <div style={{ fontWeight: 'bold' }}>
                                            {isSingleVideo ? <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}><AlertCircle size={12}/> 1</span> : day.totalVideos}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="daily-label">Hours</div>
                                        <div style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>{isSingleVideo ? '0h 0m' : formatOfficeHours(day.officeDurationSec)}</div>
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