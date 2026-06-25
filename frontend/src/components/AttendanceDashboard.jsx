import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Calendar, ChevronLeft, ChevronRight, Search, UserCheck, AlertCircle, X, ChevronDown, Users, Download, Video, Clock, Tag as TagIcon, Eye, Loader2 } from 'lucide-react';
import { generateAttendancePDF } from '../utils/pdfExport';
import './ProjectDashboard.css';
import './AttendanceDashboard.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const CustomSelect = ({ value, onChange, options, icon: Icon, placeholder, containerStyle }) => {
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
        <div className="custom-dropdown-container" style={containerStyle || { width: '200px' }} ref={dropdownRef}>
            <div className="custom-dropdown-header" onClick={() => setIsOpen(!isOpen)} style={{ height: '100%', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1 }}>
                    {Icon && <Icon size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />}
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', width: '100%' }}>
                        {selectedLabel}
                    </span>
                </div>
                <ChevronDown size={16} color="var(--text-muted)" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s', flexShrink: 0 }} />
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

const generateMonthFilters = () => {
    const months = [];
    const today = new Date();
    for (let i = 0; i < 5; i++) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        months.push({
            label: d.toLocaleString('default', { month: 'long', year: 'numeric' }),
            value: d
        });
    }
    return months;
};

export default function AttendanceDashboard() {
    const [attendance, setAttendance] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);

    // Metadata State
    const [teams, setTeams] = useState([]);
    const [teamConfigs, setTeamConfigs] = useState([]);
    const [tags, setTags] = useState([]);
    const [shifts, setShifts] = useState([]);
    const [userMappings, setUserMappings] = useState([]);

    // Filter State
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [activeMonthFilter, setActiveMonthFilter] = useState('');
    const [activeTag, setActiveTag] = useState('ALL');
    const [activeShift, setActiveShift] = useState('ALL');
    const [teamCategory, setTeamCategory] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');

    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const limit = 50;

    // Overlay State
    const [selectedProducer, setSelectedProducer] = useState(null);
    const [selectedDateObj, setSelectedDateObj] = useState(null);

    const monthFilters = generateMonthFilters();

    useEffect(() => {
        if (monthFilters.length > 0) applyMonthFilter(monthFilters[0].value);
        fetchMetadata();
    }, []);

    const fetchMetadata = async () => {
        try {
            const [configsRes, tagsRes, shiftsRes, mapsRes] = await Promise.all([
                axios.get(`${API_URL}/api/teams/configs`),
                axios.get(`${API_URL}/api/teams/tags`),
                axios.get(`${API_URL}/api/teams/shifts`),
                axios.get(`${API_URL}/api/teams`)
            ]);
            setTeamConfigs(configsRes.data);
            setTags(tagsRes.data.map(t => t.name));
            setShifts(shiftsRes.data.map(s => s.name));
            setTeams(Array.from(new Set(configsRes.data.map(c => c.name))));
            setUserMappings(mapsRes.data);
        } catch (error) { console.error("Failed to load metadata", error); }
    };

    useEffect(() => {
        if (!startDate || !endDate) return;
        const fetchAttendance = async () => {
            setIsLoading(true);
            try {
                let matchingTeams = teamConfigs;
                if (activeTag !== 'ALL') matchingTeams = matchingTeams.filter(t => t.tag === activeTag);
                if (activeShift !== 'ALL') matchingTeams = matchingTeams.filter(t => t.timingSlot === activeShift);
                if (teamCategory !== 'ALL') matchingTeams = matchingTeams.filter(t => t.name === teamCategory);

                let teamQuery = 'ALL';
                if ((activeTag !== 'ALL' || activeShift !== 'ALL' || teamCategory !== 'ALL') && matchingTeams.length === 0) {
                    teamQuery = '___NONE___';
                } else if (activeTag !== 'ALL' || activeShift !== 'ALL' || teamCategory !== 'ALL') {
                    teamQuery = matchingTeams.map(t => t.name).join(',');
                }

                let url = `${API_URL}/api/attendance?page=${page}&limit=${limit}&startDate=${startDate}&endDate=${endDate}&teams=${teamQuery}`;
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
    }, [startDate, endDate, page, activeTag, activeShift, teamCategory, searchQuery, teamConfigs]);

    const formatDateString = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    const applyMonthFilter = (dateObj) => {
        const y = dateObj.getFullYear();
        const m = dateObj.getMonth();
        const firstDay = new Date(y, m, 1);
        const lastDay = new Date(y, m + 1, 0);
        setStartDate(formatDateString(firstDay));
        setEndDate(formatDateString(lastDay));
        setActiveMonthFilter(dateObj.getTime().toString());
        setPage(1);
    };

    const handleManualDateChange = (setter, value) => {
        setActiveMonthFilter(''); setter(value); setPage(1);
    };

    const expectedWorkingDays = (() => {
        if (!startDate || !endDate) return 0;
        let start = new Date(startDate);
        let end = new Date(endDate);
        let count = 0;
        let current = new Date(start);
        while (current <= end) {
            count++;
            current.setDate(current.getDate() + 1);
        }
        return count;
    })();

    const handleExportPDF = async () => {
        setIsExporting(true);
        try {
            let matchingTeams = teamConfigs;
            if (activeTag !== 'ALL') matchingTeams = matchingTeams.filter(t => t.tag === activeTag);
            if (activeShift !== 'ALL') matchingTeams = matchingTeams.filter(t => t.timingSlot === activeShift);
            if (teamCategory !== 'ALL') matchingTeams = matchingTeams.filter(t => t.name === teamCategory);

            let teamQuery = 'ALL';
            if ((activeTag !== 'ALL' || activeShift !== 'ALL' || teamCategory !== 'ALL') && matchingTeams.length === 0) teamQuery = '___NONE___';
            else if (activeTag !== 'ALL' || activeShift !== 'ALL' || teamCategory !== 'ALL') teamQuery = matchingTeams.map(t => t.name).join(',');

            let url = `${API_URL}/api/attendance?page=1&limit=50000&startDate=${startDate}&endDate=${endDate}&teams=${teamQuery}`;
            if (searchQuery) url += `&producer=${searchQuery}`;

            const res = await axios.get(url);
            if (res.data.attendance.length > 0) {
                await generateAttendancePDF(res.data.attendance, startDate, endDate, expectedWorkingDays, teamCategory);
            }
        } catch (error) { console.error("Export failed:", error); }
        finally { setIsExporting(false); }
    };

    const formatTimeIST = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });
    };

    const formatOfficeHours = (seconds) => {
        if (!seconds || seconds <= 0) return '0h 0m';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return `${h}h ${m}m`;
    };

    const renderCalendar = () => {
        if (!startDate) return null;

        const start = new Date(startDate);
        const y = start.getFullYear();
        const m = start.getMonth();

        const firstDayOfMonth = new Date(y, m, 1);
        const lastDayOfMonth = new Date(y, m + 1, 0);

        const days = [];

        for (let i = 0; i < firstDayOfMonth.getDay(); i++) {
            days.push(null);
        }

        for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
            days.push(new Date(y, m, i));
        }

        return (
            <div className="calendar-container">
                <div className="calendar-header-row">
                    <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
                </div>
                <div className="calendar-days-grid">
                    {days.map((d, index) => {
                        if (!d) return <div key={`empty-${index}`} className="calendar-cell empty"></div>;

                        const dateStr = formatDateString(d);
                        const record = selectedProducer?.dailyRecords.find(r => r.date === dateStr);
                        const isSelected = selectedDateObj?.date === dateStr;

                        return (
                            <div
                                key={dateStr}
                                className={`calendar-cell ${record ? 'present' : 'absent'} ${isSelected ? 'selected' : ''}`}
                                onClick={() => setSelectedDateObj(record || { date: dateStr, absent: true })}
                            >
                                {d.getDate()}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="dashboard-card" style={{ maxWidth: '1400px', margin: '0 auto' }}>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px' }}>
                <h2 className="dashboard-header" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, color: 'var(--primary)' }}>
                    <UserCheck size={28} /> Detailed Roster
                </h2>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <div className="quick-filters-container">
                        {monthFilters.map(month => (
                            <button
                                key={month.value.getTime()}
                                className={`quick-filter-btn ${activeMonthFilter === month.value.getTime().toString() ? 'active' : ''}`}
                                onClick={() => applyMonthFilter(month.value)}
                            >
                                {month.label}
                            </button>
                        ))}
                    </div>

                    <button onClick={handleExportPDF} disabled={totalRecords === 0 || isExporting} style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: totalRecords === 0 ? 'var(--bg-secondary)' : 'var(--primary)', color: totalRecords === 0 ? 'var(--text-muted)' : 'white', border: totalRecords === 0 ? '1px solid var(--border-color)' : 'none', padding: '0 16px', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: totalRecords === 0 ? 'not-allowed' : 'pointer', height: '40px' }}>
                        <Download size={16} /> {isExporting ? 'Generating...' : 'Export PDF'}
                    </button>
                </div>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <CustomSelect icon={TagIcon} value={activeTag} onChange={(val) => { setActiveTag(val); setPage(1); }} options={[{ value: 'ALL', label: 'All Tags' }, ...tags.map(t => ({ value: t, label: t }))]} containerStyle={{ width: '180px', height: '40px' }} />
                    <CustomSelect icon={Clock} value={activeShift} onChange={(val) => { setActiveShift(val); setPage(1); }} options={[{ value: 'ALL', label: 'All Shifts' }, ...shifts.map(s => ({ value: s, label: s }))]} containerStyle={{ width: '220px', height: '40px' }} />
                    <CustomSelect icon={Users} value={teamCategory} onChange={(val) => { setTeamCategory(val); setPage(1); }} options={[{ value: 'ALL', label: 'All Teams' }, ...teams.map(t => ({ value: t, label: t }))]} containerStyle={{ width: '180px', height: '40px' }} />

                    <div className="qc-filter-wrapper" style={{ height: '40px' }}>
                        <Calendar size={16} color="var(--text-muted)" />
                        <input type="date" value={startDate} onChange={(e) => handleManualDateChange(setStartDate, e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none' }} />
                        <span style={{ color: 'var(--text-muted)' }}>to</span>
                        <input type="date" value={endDate} onChange={(e) => handleManualDateChange(setEndDate, e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none' }} />
                    </div>
                </div>

                <div style={{ display: 'flex' }}>
                    <div className="qc-filter-wrapper search-wrapper" style={{ height: '40px', width: '100%', maxWidth: '400px' }}>
                        <Search size={16} color="var(--text-muted)" />
                        <input type="text" placeholder="Search Producer..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }} style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none', fontSize: '13px', width: '100%' }} />
                    </div>
                </div>
            </div>

            <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', overflowX: 'auto', marginBottom: '16px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr>
                            <th className="att-th">Producer</th>
                            <th className="att-th">Team Details</th>
                            <th className="att-th" style={{ textAlign: 'center' }}>Present Days</th>
                            <th className="att-th" style={{ textAlign: 'center' }}>Total Videos</th>
                            <th className="att-th" style={{ textAlign: 'center' }}>Accepted Hours</th>
                            <th className="att-th" style={{ textAlign: 'center' }}>Office Hours</th>
                            <th className="att-th" style={{ textAlign: 'center' }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan="7" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}><Loader2 className="spinning" size={24} style={{ margin: '0 auto' }} /></td></tr>
                        ) : attendance.length > 0 ? (
                            attendance.map((record) => {
                                const mapping = userMappings.find(m => m.username === record.producer);
                                const teamName = mapping && mapping.teamName !== 'Unassigned' ? mapping.teamName : 'Unassigned';
                                const config = teamConfigs.find(c => c.name === teamName);
                                const tag = config ? config.tag : 'N/A';
                                const shift = config ? config.timingSlot : 'N/A';

                                return (
                                    <tr key={record.producer} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '16px', color: 'var(--text-main)', fontWeight: '600' }}>
                                            {record.producer}
                                        </td>

                                        <td style={{ padding: '12px 16px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-main)' }}>{teamName}</span>
                                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                    {tag !== 'N/A' && (
                                                        <span style={{ fontSize: '10px', background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.3)', padding: '2px 6px', borderRadius: '4px', color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                            <TagIcon size={10} /> {tag}
                                                        </span>
                                                    )}
                                                    {shift !== 'N/A' && (
                                                        <span style={{ fontSize: '10px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '2px 6px', borderRadius: '4px', color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                            <Clock size={10} /> {shift}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        <td style={{ padding: '16px', textAlign: 'center', fontWeight: 'bold', color: '#10b981' }}>{record.presentDays}</td>
                                        <td style={{ padding: '16px', textAlign: 'center', fontWeight: '600' }}>{record.totalVideos}</td>
                                        <td style={{ padding: '16px', textAlign: 'center', fontWeight: 'bold', color: '#10b981' }}>{formatOfficeHours(record.totalAcceptedSec)}</td>
                                        <td style={{ padding: '16px', textAlign: 'center', fontWeight: 'bold', color: 'var(--text-main)' }}>{formatOfficeHours(record.totalOfficeDurationSec)}</td>
                                        <td style={{ padding: '16px', textAlign: 'center' }}>
                                            <button className="view-details-btn" onClick={() => { setSelectedProducer(record); setSelectedDateObj(null); }}>
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

            <div className={`attendance-overlay ${selectedProducer ? 'open' : ''}`}>
                <div className="overlay-header">
                    <div>
                        <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '18px' }}>{selectedProducer?.producer}</h3>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>Monthly Breakdown</div>
                    </div>
                    <button onClick={() => { setSelectedProducer(null); setSelectedDateObj(null); }} className="overlay-close-btn"><X size={20} /></button>
                </div>

                <div className="overlay-content">
                    {renderCalendar()}

                    {selectedDateObj && (
                        <div className="daily-record-card" style={{ marginTop: '24px' }}>
                            <div style={{ fontWeight: '600', color: selectedDateObj.absent ? '#ef4444' : 'var(--primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Calendar size={16} />
                                {new Date(selectedDateObj.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                                {selectedDateObj.absent && <span style={{ background: '#fef2f2', color: '#ef4444', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', marginLeft: 'auto' }}>Absent</span>}
                            </div>

                            {!selectedDateObj.absent && (
                                <div className="daily-stats-grid" style={{ gridTemplateColumns: '1fr 1fr', rowGap: '16px', columnGap: '12px' }}>
                                    <div>
                                        <div className="daily-label">First Video</div>
                                        <div style={{ fontWeight: 'bold', color: '#10b981', fontSize: '14px' }}>{formatTimeIST(selectedDateObj.checkIn)}</div>
                                    </div>
                                    <div>
                                        <div className="daily-label">Last Video</div>
                                        <div style={{ fontWeight: 'bold', color: selectedDateObj.totalVideos === 1 ? 'var(--text-muted)' : '#f59e0b', fontSize: '14px' }}>
                                            {selectedDateObj.totalVideos === 1 ? 'N/A' : formatTimeIST(selectedDateObj.checkOut)}
                                        </div>
                                    </div>

                                    <div>
                                        <div className="daily-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Video size={12} /> Recorded</div>
                                        <div style={{ fontWeight: 'bold', color: 'var(--text-main)', fontSize: '14px' }}>{formatOfficeHours(selectedDateObj.recordedSec)}</div>
                                    </div>
                                    <div>
                                        <div className="daily-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Video size={12} /> Accepted</div>
                                        <div style={{ fontWeight: 'bold', color: 'var(--primary)', fontSize: '14px' }}>{formatOfficeHours(selectedDateObj.acceptedSec)}</div>
                                    </div>

                                    <div>
                                        <div className="daily-label">Office Time</div>
                                        <div style={{ fontWeight: 'bold', color: 'var(--text-main)', fontSize: '14px' }}>{selectedDateObj.totalVideos === 1 ? '0h 0m' : formatOfficeHours(selectedDateObj.officeDurationSec)}</div>
                                    </div>

                                    <div style={{ gridColumn: '1 / -1', background: 'var(--bg-main)', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span className="daily-label" style={{ margin: 0 }}>Total Videos Submissions:</span>
                                        <span style={{ fontWeight: 'bold' }}>
                                            {selectedDateObj.totalVideos === 1 ? <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}><AlertCircle size={12} /> 1</span> : selectedDateObj.totalVideos}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {selectedProducer && <div className="overlay-backdrop" onClick={() => { setSelectedProducer(null); setSelectedDateObj(null); }}></div>}

        </div>
    );
}