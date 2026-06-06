import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { Filter, Calendar, Users, ChevronDown, Activity, Loader2, Tag as TagIcon, Clock, TrendingUp } from 'lucide-react';
import './TaskDashboard.css';
import './ProjectDashboard.css';

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
        <div className="searchable-dropdown-container" style={containerStyle || { width: 'auto', minWidth: '160px' }} ref={dropdownRef}>
            <div className="searchable-dropdown-header" onClick={() => setIsOpen(!isOpen)} style={{ height: '100%', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1 }}>
                    {Icon && <Icon size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />}
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', width: '100%' }}>{selectedLabel}</span>
                </div>
                <ChevronDown size={16} color="var(--text-muted)" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s', flexShrink: 0 }} />
            </div>
            {isOpen && (
                <div className="searchable-dropdown-menu">
                    <ul className="searchable-dropdown-list">
                        {options.map(opt => (
                            <li key={opt.value} className={`searchable-dropdown-item ${value === opt.value ? 'active' : ''}`} onClick={() => { onChange(opt.value); setIsOpen(false); }}>
                                {opt.label}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default function ProjectDashboard() {
    const [viewCategory, setViewCategory] = useState('ALL');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [activeGlobalFilter, setActiveGlobalFilter] = useState('allTime');

    const [activeTag, setActiveTag] = useState('ALL');
    const [activeShift, setActiveShift] = useState('ALL');
    const [teamCategory, setTeamCategory] = useState('ALL');

    const [tags, setTags] = useState([]);
    const [shifts, setShifts] = useState([]);
    const [teams, setTeams] = useState([]);
    const [teamConfigs, setTeamConfigs] = useState([]);

    // Corrected Math to convert decimal hours to XXh YYmin
    const formatDecimalHours = (decimalHours) => {
        if (!decimalHours || isNaN(decimalHours) || decimalHours === 0) return '0h 0min';
        
        const hrs = Math.floor(decimalHours);
        const mins = Math.round((decimalHours - hrs) * 60);
        
        // Handle edge case where rounding pushes minutes to 60
        if (mins === 60) return `${hrs + 1}h 0min`;
        
        return `${hrs}h ${mins}m`;
    };

    const applyQuickFilter = (type) => {
        setActiveGlobalFilter(type);
        const today = new Date();
        const formatDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

        if (type === 'today') { setStartDate(formatDate(today)); setEndDate(formatDate(today)); } 
        else if (type === 'yesterday') { const y = new Date(today); y.setDate(y.getDate() - 1); setStartDate(formatDate(y)); setEndDate(formatDate(y)); } 
        else if (type === 'thisWeek') { const m = new Date(today); m.setDate(m.getDate() - (m.getDay() || 7) + 1); setStartDate(formatDate(m)); setEndDate(formatDate(today)); } 
        else if (type === 'thisMonth') { setStartDate(formatDate(new Date(today.getFullYear(), today.getMonth(), 1))); setEndDate(formatDate(today)); } 
        else { setStartDate(''); setEndDate(''); }
    };

    const handleDateChange = (value, isStart) => {
        setActiveGlobalFilter('');
        isStart ? setStartDate(value) : setEndDate(value);
    };

    useEffect(() => {
        const fetchMetadata = async () => {
            try {
                const [configsRes, tagsRes, shiftsRes] = await Promise.all([
                    axios.get(`${API_URL}/api/teams/configs`),
                    axios.get(`${API_URL}/api/teams/tags`),
                    axios.get(`${API_URL}/api/teams/shifts`)
                ]);
                setTeamConfigs(configsRes.data);
                setTags(tagsRes.data.map(t => t.name));
                setShifts(shiftsRes.data.map(s => s.name));
                setTeams(Array.from(new Set(configsRes.data.map(c => c.name))));
            } catch (error) { console.error("Failed to load metadata", error); }
        };
        fetchMetadata();
    }, []);

    let matchingTeams = teamConfigs;
    if (activeTag !== 'ALL') matchingTeams = matchingTeams.filter(t => t.tag === activeTag);
    if (activeShift !== 'ALL') matchingTeams = matchingTeams.filter(t => t.timingSlot === activeShift);
    if (teamCategory !== 'ALL') matchingTeams = matchingTeams.filter(t => t.name === teamCategory);

    let teamQuery = 'ALL';
    if ((activeTag !== 'ALL' || activeShift !== 'ALL' || teamCategory !== 'ALL') && matchingTeams.length === 0) teamQuery = '___NONE___'; 
    else if (activeTag !== 'ALL' || activeShift !== 'ALL' || teamCategory !== 'ALL') teamQuery = matchingTeams.map(t => t.name).join(',');

    const { data: summary, isFetching } = useQuery({
        queryKey: ['projectSummary', viewCategory, teamQuery, startDate, endDate, teamConfigs.length],
        queryFn: async () => {
            let url = `${API_URL}/api/dashboard/stats/summary?category=${viewCategory}&teams=${teamQuery}`;
            if (startDate && endDate) url += `&startDate=${startDate}&endDate=${endDate}`;
            const res = await axios.get(url);
            return res.data;
        },
        placeholderData: (prev) => prev,
        refetchOnWindowFocus: false,
        enabled: teamConfigs.length > 0
    });

    const totalCount = summary?.total?.count || 0;
    const acceptedCount = summary?.accepted?.count || 0;
    const rejectedCount = summary?.rejected?.count || 0;
    const pendingCount = summary?.pending?.count || 0;

    const totalHours = summary?.total?.hours || 0;
    const acceptedHours = summary?.accepted?.hours || 0;
    const rejectedHours = summary?.rejected?.hours || 0;
    const pendingHours = summary?.pending?.hours || 0;

    const inspectedCount = acceptedCount + rejectedCount;
    const inspectedHours = acceptedHours + rejectedHours;

    const acceptanceRate = inspectedHours > 0 ? ((acceptedHours / inspectedHours) * 100).toFixed(1) : '0.0';
    const rejectionRate = inspectedHours > 0 ? ((rejectedHours / inspectedHours) * 100).toFixed(1) : '0.0';
    const pendingRate = totalHours > 0 ? ((pendingHours / totalHours) * 100).toFixed(1) : '0.0';
    const inspectedRate = totalHours > 0 ? ((inspectedHours / totalHours) * 100).toFixed(1) : '0.0';

    return (
        <div className="dashboard-card" style={{ maxWidth: '1400px', margin: '0 auto' }}>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '32px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <h2 className="dashboard-header" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                        <Activity color="var(--primary)" size={24} />
                        Project Overview
                    </h2>
                    <div className="quick-filters-container" style={{ margin: 0 }}>
                        <button className={`quick-filter-btn ${activeGlobalFilter === 'allTime' ? 'active' : ''}`} onClick={() => applyQuickFilter('allTime')}>All Time</button>
                        <button className={`quick-filter-btn ${activeGlobalFilter === 'today' ? 'active' : ''}`} onClick={() => applyQuickFilter('today')}>Today</button>
                        <button className={`quick-filter-btn ${activeGlobalFilter === 'yesterday' ? 'active' : ''}`} onClick={() => applyQuickFilter('yesterday')}>Yesterday</button>
                        <button className={`quick-filter-btn ${activeGlobalFilter === 'thisWeek' ? 'active' : ''}`} onClick={() => applyQuickFilter('thisWeek')}>This Week</button>
                        <button className={`quick-filter-btn ${activeGlobalFilter === 'thisMonth' ? 'active' : ''}`} onClick={() => applyQuickFilter('thisMonth')}>This Month</button>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <CustomSelect icon={TagIcon} value={activeTag} onChange={setActiveTag} options={[{ value: 'ALL', label: 'All Tags' }, ...tags.map(t => ({ value: t, label: t }))]} containerStyle={{ width: '180px', height: '40px' }} />
                    <CustomSelect icon={Clock} value={activeShift} onChange={setActiveShift} options={[{ value: 'ALL', label: 'All Shifts' }, ...shifts.map(s => ({ value: s, label: s }))]} containerStyle={{ width: '220px', height: '40px' }} />
                    <CustomSelect icon={Users} value={teamCategory} onChange={setTeamCategory} options={[{ value: 'ALL', label: 'All Teams' }, ...teams.map(t => ({ value: t, label: t }))]} containerStyle={{ width: '180px', height: '40px' }} />
                    <CustomSelect icon={Filter} value={viewCategory} onChange={setViewCategory} options={[{ value: 'ALL', label: 'All Projects' }, { value: 'OFFICE', label: 'Office Tasks' }, { value: 'HOUSE', label: 'House Tasks' }]} containerStyle={{ width: '180px', height: '40px' }} />

                    <div className="searchable-dropdown-header" style={{ cursor: 'default', height: '40px' }}>
                        <Calendar size={16} color="var(--text-muted)" />
                        <input type="date" value={startDate} onChange={(e) => handleDateChange(e.target.value, true)} style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none', paddingLeft: '8px' }} />
                        <span style={{ color: 'var(--text-muted)', margin: '0 8px' }}>to</span>
                        <input type="date" value={endDate} onChange={(e) => handleDateChange(e.target.value, false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none' }} />
                    </div>
                </div>
            </div>

            <div className="summary-cards" style={{ opacity: isFetching ? 0.5 : 1, transition: 'opacity 0.2s', marginBottom: '40px', flexWrap: 'wrap' }}>
                <div className="summary-card">
                    <span className="card-title">Total Volume</span>
                    <div style={{ display: 'flex', flexDirection: 'column', marginTop: '8px' }}>
                        <span className="card-value" style={{ color: 'var(--primary)', lineHeight: '1' }}>{formatDecimalHours(totalHours)}</span>
                        <span style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px', fontWeight: '500' }}>{totalCount.toLocaleString()} clips</span>
                    </div>
                </div>
                <div className="summary-card">
                    <span className="card-title">Total Accepted</span>
                    <div style={{ display: 'flex', flexDirection: 'column', marginTop: '8px' }}>
                        <span className="card-value" style={{ color: '#10b981', lineHeight: '1' }}>{formatDecimalHours(acceptedHours)}</span>
                        <span style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px', fontWeight: '500' }}>{acceptedCount.toLocaleString()} clips</span>
                        {inspectedCount > 0 && <span style={{ fontSize: '13px', color: 'var(--text-main)', marginTop: '2px', fontWeight: '600' }}>Acceptance Rate - {acceptanceRate}%</span>}
                    </div>
                </div>
                <div className="summary-card">
                    <span className="card-title">Total Rejected</span>
                    <div style={{ display: 'flex', flexDirection: 'column', marginTop: '8px' }}>
                        <span className="card-value" style={{ color: '#ef4444', lineHeight: '1' }}>{formatDecimalHours(rejectedHours)}</span>
                        <span style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px', fontWeight: '500' }}>{rejectedCount.toLocaleString()} clips</span>
                        {inspectedCount > 0 && <span style={{ fontSize: '13px', color: 'var(--text-main)', marginTop: '2px', fontWeight: '600' }}>Rejection Rate - {rejectionRate}%</span>}
                    </div>
                </div>
                <div className="summary-card">
                    <span className="card-title">QC Done</span>
                    <div style={{ display: 'flex', flexDirection: 'column', marginTop: '8px' }}>
                        <span className="card-value" style={{ color: '#3b82f6', lineHeight: '1' }}>{formatDecimalHours(inspectedHours)}</span>
                        <span style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px', fontWeight: '500' }}>{inspectedCount.toLocaleString()} clips</span>
                        {totalCount > 0 && <span style={{ fontSize: '13px', color: 'var(--text-main)', marginTop: '2px', fontWeight: '600' }}>QC Completed - {inspectedRate}%</span>}
                    </div>
                </div>
                <div className="summary-card">
                    <span className="card-title">Pending QC</span>
                    <div style={{ display: 'flex', flexDirection: 'column', marginTop: '8px' }}>
                        <span className="card-value" style={{ color: '#f59e0b', lineHeight: '1' }}>{formatDecimalHours(pendingHours)}</span>
                        <span style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px', fontWeight: '500' }}>{pendingCount.toLocaleString()} clips</span>
                        {totalCount > 0 && <span style={{ fontSize: '13px', color: 'var(--text-main)', marginTop: '2px', fontWeight: '600' }}>QC Pending - {pendingRate}%</span>}
                    </div>
                </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '40px 0 24px 0' }} />
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
                    <TrendingUp size={20} color="var(--primary)" />
                    Daily Production Summary
                </h3>
            </div>

            <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', opacity: isFetching ? 0.6 : 1, transition: 'opacity 0.2s' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr>
                            <th style={{ padding: '16px', background: 'var(--bg-secondary)', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)' }}>Date</th>
                            <th style={{ padding: '16px', background: 'var(--bg-secondary)', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>Active Collectors</th>
                            <th style={{ padding: '16px', background: 'var(--bg-secondary)', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>Hrs Collected</th>
                            <th style={{ padding: '16px', background: 'var(--bg-secondary)', color: '#10b981', fontSize: '12px', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>QC Pass</th>
                            <th style={{ padding: '16px', background: 'var(--bg-secondary)', color: '#ef4444', fontSize: '12px', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>QC Fail</th>
                            <th style={{ padding: '16px', background: 'var(--bg-secondary)', color: '#f59e0b', fontSize: '12px', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>QC Pending</th>
                            <th style={{ padding: '16px', background: 'var(--bg-secondary)', color: 'var(--text-main)', fontSize: '12px', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>Pass Rate</th>
                        </tr>
                    </thead>
                    <tbody>
                        {summary?.trend?.length > 0 ? (
                            summary.trend.map(day => {
                                const passRate = day.accepted.hours > 0 
                                    ? ((day.accepted.hours / (day.accepted.hours + day.rejected.hours)) * 100).toFixed(1) 
                                    : '0.0';

                                return (
                                    <tr key={day.date} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '16px' }}>
                                            <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-main)' }}>{day.date}</div>
                                        </td>
                                        <td style={{ padding: '16px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)' }}>{day.activeProducers}</div>
                                        </td>
                                        <td style={{ padding: '16px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)' }}>{formatDecimalHours(day.total.hours)}</div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{day.total.count.toLocaleString()} clips</div>
                                        </td>
                                        <td style={{ padding: '16px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '15px', fontWeight: '600', color: '#10b981' }}>{formatDecimalHours(day.accepted.hours)}</div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{day.accepted.count.toLocaleString()} clips</div>
                                        </td>
                                        <td style={{ padding: '16px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '15px', fontWeight: '600', color: '#ef4444' }}>{formatDecimalHours(day.rejected.hours)}</div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{day.rejected.count.toLocaleString()} clips</div>
                                        </td>
                                        <td style={{ padding: '16px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '15px', fontWeight: '600', color: '#f59e0b' }}>{formatDecimalHours(day.pending.hours)}</div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{day.pending.count.toLocaleString()} clips</div>
                                        </td>
                                        <td style={{ padding: '16px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--primary)' }}>{passRate}%</div>
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan="7" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    {isFetching ? <Loader2 className="spinning" style={{ margin: '0 auto' }} /> : 'No data found for the selected filters.'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}