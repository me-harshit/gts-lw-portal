import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { Filter, Calendar, Users, ChevronDown, Activity, Loader2, Tag as TagIcon, Clock, TrendingUp } from 'lucide-react';
import './TaskDashboard.css';
import './ProjectDashboard.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const CustomSelect = ({ value, onChange, options, icon: Icon, placeholder, className }) => {
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
        <div className={`searchable-dropdown-container ${className || ''}`} ref={dropdownRef}>
            <div className="searchable-dropdown-header" onClick={() => setIsOpen(!isOpen)}>
                <div className="searchable-dropdown-header-content">
                    {Icon && <Icon size={16} className="searchable-dropdown-icon" />}
                    <span className="searchable-dropdown-text">{selectedLabel}</span>
                </div>
                <ChevronDown size={16} className={`searchable-dropdown-caret ${isOpen ? 'open' : ''}`} />
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
    const [activeGlobalFilter, setActiveGlobalFilter] = useState('thisMonth');

    const [activeTag, setActiveTag] = useState('ALL');
    const [activeShift, setActiveShift] = useState('ALL');
    const [teamCategory, setTeamCategory] = useState('ALL');

    const [tags, setTags] = useState([]);
    const [shifts, setShifts] = useState([]);
    const [teams, setTeams] = useState([]);
    const [teamConfigs, setTeamConfigs] = useState([]);

    const formatDecimalHours = (decimalHours) => {
        if (!decimalHours || isNaN(decimalHours) || decimalHours === 0) return '0h 0m';
        
        const hrs = Math.floor(decimalHours);
        const mins = Math.round((decimalHours - hrs) * 60);
        
        if (mins === 60) return `${hrs + 1}h 0m`;
        
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
        <div className="dashboard-card pd-container">

            <div className="pd-header-section">
                <div className="pd-header-row">
                    <h2 className="dashboard-header pd-title">
                        <Activity className="pd-icon-primary" size={24} />
                        Project Overview
                    </h2>
                    <div className="quick-filters-container pd-no-margin">
                        <button className={`quick-filter-btn ${activeGlobalFilter === 'allTime' ? 'active' : ''}`} onClick={() => applyQuickFilter('allTime')}>All Time</button>
                        <button className={`quick-filter-btn ${activeGlobalFilter === 'today' ? 'active' : ''}`} onClick={() => applyQuickFilter('today')}>Today</button>
                        <button className={`quick-filter-btn ${activeGlobalFilter === 'yesterday' ? 'active' : ''}`} onClick={() => applyQuickFilter('yesterday')}>Yesterday</button>
                        <button className={`quick-filter-btn ${activeGlobalFilter === 'thisWeek' ? 'active' : ''}`} onClick={() => applyQuickFilter('thisWeek')}>This Week</button>
                        <button className={`quick-filter-btn ${activeGlobalFilter === 'thisMonth' ? 'active' : ''}`} onClick={() => applyQuickFilter('thisMonth')}>This Month</button>
                    </div>
                </div>

                <div className="pd-filter-row">
                    <CustomSelect className="pd-select-sm" icon={TagIcon} value={activeTag} onChange={setActiveTag} options={[{ value: 'ALL', label: 'All Tags' }, ...tags.map(t => ({ value: t, label: t }))]} />
                    <CustomSelect className="pd-select-md" icon={Clock} value={activeShift} onChange={setActiveShift} options={[{ value: 'ALL', label: 'All Shifts' }, ...shifts.map(s => ({ value: s, label: s }))]} />
                    <CustomSelect className="pd-select-sm" icon={Users} value={teamCategory} onChange={setTeamCategory} options={[{ value: 'ALL', label: 'All Teams' }, ...teams.map(t => ({ value: t, label: t }))]} />
                    <CustomSelect className="pd-select-sm" icon={Filter} value={viewCategory} onChange={setViewCategory} options={[{ value: 'ALL', label: 'All Projects' }, { value: 'OFFICE', label: 'Office Tasks' }, { value: 'HOUSE', label: 'House Tasks' }]} />

                    <div className="pd-date-wrapper">
                        <Calendar size={16} className="pd-icon-muted" />
                        <input type="date" className="pd-date-input" value={startDate} onChange={(e) => handleDateChange(e.target.value, true)} />
                        <span className="pd-date-separator">to</span>
                        <input type="date" className="pd-date-input" value={endDate} onChange={(e) => handleDateChange(e.target.value, false)} />
                    </div>
                </div>
            </div>

            <div className={`summary-cards pd-summary-wrap ${isFetching ? 'pd-is-fetching' : ''}`}>
                <div className="summary-card">
                    <span className="card-title">Total Volume</span>
                    <div className="pd-summary-content">
                        <span className="card-value pd-text-primary">{formatDecimalHours(totalHours)}</span>
                        <span className="pd-summary-subtext">{totalCount.toLocaleString()} clips</span>
                    </div>
                </div>
                <div className="summary-card">
                    <span className="card-title">Total Accepted</span>
                    <div className="pd-summary-content">
                        <span className="card-value pd-text-success">{formatDecimalHours(acceptedHours)}</span>
                        <span className="pd-summary-subtext">{acceptedCount.toLocaleString()} clips</span>
                        {inspectedCount > 0 && <span className="pd-summary-subtext-bold">Acceptance Rate - {acceptanceRate}%</span>}
                    </div>
                </div>
                <div className="summary-card">
                    <span className="card-title">Total Rejected</span>
                    <div className="pd-summary-content">
                        <span className="card-value pd-text-danger">{formatDecimalHours(rejectedHours)}</span>
                        <span className="pd-summary-subtext">{rejectedCount.toLocaleString()} clips</span>
                        {inspectedCount > 0 && <span className="pd-summary-subtext-bold">Rejection Rate - {rejectionRate}%</span>}
                    </div>
                </div>
                <div className="summary-card">
                    <span className="card-title">QC Done</span>
                    <div className="pd-summary-content">
                        <span className="card-value pd-text-info">{formatDecimalHours(inspectedHours)}</span>
                        <span className="pd-summary-subtext">{inspectedCount.toLocaleString()} clips</span>
                        {totalCount > 0 && <span className="pd-summary-subtext-bold">QC Completed - {inspectedRate}%</span>}
                    </div>
                </div>
                <div className="summary-card">
                    <span className="card-title">Pending QC</span>
                    <div className="pd-summary-content">
                        <span className="card-value pd-text-warning">{formatDecimalHours(pendingHours)}</span>
                        <span className="pd-summary-subtext">{pendingCount.toLocaleString()} clips</span>
                        {totalCount > 0 && <span className="pd-summary-subtext-bold">QC Pending - {pendingRate}%</span>}
                    </div>
                </div>
            </div>

            <hr className="pd-divider" />
            
            <div className="pd-section-header">
                <h3 className="pd-section-title">
                    <TrendingUp size={20} className="pd-icon-primary" />
                    Daily Production Summary
                </h3>
            </div>

            <div className={`pd-table-wrapper ${isFetching ? 'pd-is-fetching' : ''}`}>
                <table className="pd-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th className="pd-text-center">Active Collectors</th>
                            <th className="pd-text-center">Hrs Collected</th>
                            <th className="pd-text-center pd-th-success">QC Pass</th>
                            <th className="pd-text-center pd-th-danger">QC Fail</th>
                            <th className="pd-text-center pd-th-warning">QC Pending</th>
                            <th className="pd-text-center pd-th-main">Pass Rate</th>
                        </tr>
                    </thead>
                    <tbody>
                        {summary?.trend?.length > 0 ? (
                            summary.trend.map(day => {
                                const passRate = day.accepted.hours > 0 
                                    ? ((day.accepted.hours / (day.accepted.hours + day.rejected.hours)) * 100).toFixed(1) 
                                    : '0.0';

                                return (
                                    <tr key={day.date}>
                                        <td>
                                            <div className="pd-table-val">{day.date}</div>
                                        </td>
                                        <td className="pd-text-center">
                                            <div className="pd-table-val">{day.activeProducers}</div>
                                        </td>
                                        <td className="pd-text-center">
                                            <div className="pd-table-val">{formatDecimalHours(day.total.hours)}</div>
                                            <div className="pd-table-subtext">{day.total.count.toLocaleString()} clips</div>
                                        </td>
                                        <td className="pd-text-center">
                                            <div className="pd-table-val-success">{formatDecimalHours(day.accepted.hours)}</div>
                                            <div className="pd-table-subtext">{day.accepted.count.toLocaleString()} clips</div>
                                        </td>
                                        <td className="pd-text-center">
                                            <div className="pd-table-val-danger">{formatDecimalHours(day.rejected.hours)}</div>
                                            <div className="pd-table-subtext">{day.rejected.count.toLocaleString()} clips</div>
                                        </td>
                                        <td className="pd-text-center">
                                            <div className="pd-table-val-warning">{formatDecimalHours(day.pending.hours)}</div>
                                            <div className="pd-table-subtext">{day.pending.count.toLocaleString()} clips</div>
                                        </td>
                                        <td className="pd-text-center">
                                            <div className="pd-table-val-primary">{passRate}%</div>
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan="7" className="pd-empty-state">
                                    {isFetching ? <Loader2 className="spinning pd-icon-center" size={24} /> : 'No data found for the selected filters.'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}