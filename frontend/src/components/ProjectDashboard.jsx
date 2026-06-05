import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import {
    Filter, Calendar, User, ListChecks, Search,
    ChevronDown, Activity, Loader2, Tag as TagIcon, Clock, Users
} from 'lucide-react';
import { formatDuration } from '../utils/timeFormat';
import './TaskDashboard.css';
import './ProjectDashboard.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// --- REUSABLE CUSTOM SELECT COMPONENT ---
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
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', width: '100%' }}>
                        {selectedLabel}
                    </span>
                </div>
                <ChevronDown size={16} color="var(--text-muted)" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s', flexShrink: 0 }} />
            </div>
            {isOpen && (
                <div className="searchable-dropdown-menu">
                    <ul className="searchable-dropdown-list">
                        {options.map(opt => (
                            <li
                                key={opt.value}
                                className={`searchable-dropdown-item ${value === opt.value ? 'active' : ''}`}
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

export default function ProjectDashboard() {
    // Global Filters 
    const [viewCategory, setViewCategory] = useState('ALL');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [activeGlobalFilter, setActiveGlobalFilter] = useState('allTime');

    // Metadata Filters
    const [activeTag, setActiveTag] = useState('ALL');
    const [activeShift, setActiveShift] = useState('ALL');
    const [teamCategory, setTeamCategory] = useState('ALL');

    // Producer Specific Filters
    const [prodStartDate, setProdStartDate] = useState('');
    const [prodEndDate, setProdEndDate] = useState('');
    const [activeProdFilter, setActiveProdFilter] = useState('allTime');

    // Meta Data State
    const [tags, setTags] = useState([]);
    const [shifts, setShifts] = useState([]);
    const [teams, setTeams] = useState([]);
    const [teamConfigs, setTeamConfigs] = useState([]);
    const [userMappings, setUserMappings] = useState([]);

    const [selectedProducer, setSelectedProducer] = useState(null);

    // Custom Dropdown State for Producer Search
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [producerSearch, setProducerSearch] = useState('');
    const dropdownRef = useRef(null);

    // --- HELPER: FORMAT DECIMAL HOURS TO HOURS & MINUTES ---
    const formatDecimalHours = (decimalHours) => {
        if (decimalHours === undefined || decimalHours === null || isNaN(decimalHours)) return '-- hrs';
        const hrs = Math.floor(decimalHours);
        const mins = Math.round((decimalHours - hrs) * 60);
        if (hrs === 0) return `${mins}m`;
        if (mins === 0) return `${hrs}h`;
        return `${hrs}h ${mins}m`;
    };

    // --- QUICK FILTER LOGIC ---
    const applyQuickFilter = (type, setStart, setEnd, setActiveBtn) => {
        setActiveBtn(type);
        const today = new Date();

        const formatDate = (date) => {
            const yyyy = date.getFullYear();
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const dd = String(date.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
        };

        if (type === 'today') {
            setStart(formatDate(today)); setEnd(formatDate(today));
        } else if (type === 'yesterday') {
            const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
            setStart(formatDate(yesterday)); setEnd(formatDate(yesterday));
        } else if (type === 'thisWeek') {
            const monday = new Date(today); const day = monday.getDay() || 7; monday.setDate(monday.getDate() - (day - 1));
            setStart(formatDate(monday)); setEnd(formatDate(today));
        } else if (type === 'thisMonth') {
            const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
            setStart(formatDate(firstDay)); setEnd(formatDate(today));
        } else if (type === 'allTime') {
            setStart(''); setEnd('');
        }
    };

    const handleDateChange = (setter, value, setActiveBtn) => {
        setActiveBtn(''); setter(value);
    };

    useEffect(() => {
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
                setUserMappings(mapsRes.data);
                setTeams(Array.from(new Set(configsRes.data.map(c => c.name))));
            } catch (error) { console.error("Failed to load metadata", error); }
        };
        fetchMetadata();
    }, []);

    // Filter Logic for Global Summary
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

    const { data: summary, isFetching: isFetchingSummary } = useQuery({
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

    const { data: producerData, isFetching: isFetchingProducer } = useQuery({
        queryKey: ['producerHistory', selectedProducer?.username, viewCategory, prodStartDate, prodEndDate],
        queryFn: async () => {
            if (!selectedProducer) return null;
            let url = `${API_URL}/api/dashboard/stats/producer/${selectedProducer.username}?category=${viewCategory}`;
            if (prodStartDate && prodEndDate) url += `&startDate=${prodStartDate}&endDate=${prodEndDate}`;
            const res = await axios.get(url);
            return res.data;
        },
        enabled: !!selectedProducer,
        refetchOnWindowFocus: false
    });

    const enrichedProducers = userMappings.map(p => {
        const config = teamConfigs.find(c => c.name === p.teamName);
        return { 
            ...p, 
            tag: config ? config.tag : 'N/A',
            shift: config ? config.timingSlot : 'N/A'
        };
    });

    const filteredProducers = enrichedProducers.filter(p => {
        const matchesTeam = teamCategory === 'ALL' || p.teamName === teamCategory;
        const matchesSearch = p.username.toLowerCase().includes(producerSearch.toLowerCase());
        return matchesTeam && matchesSearch;
    });

    // --- TIME-BASED RATE CALCULATIONS ---
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

    const acceptanceRate = inspectedHours > 0 ? ((acceptedHours / inspectedHours) * 100).toFixed(2) : '0.00';
    const rejectionRate = inspectedHours > 0 ? ((rejectedHours / inspectedHours) * 100).toFixed(2) : '0.00';
    const pendingRate = totalHours > 0 ? ((pendingHours / totalHours) * 100).toFixed(2) : '0.00';
    const inspectedRate = totalHours > 0 ? ((inspectedHours / totalHours) * 100).toFixed(2) : '0.00';

    return (
        <div className="dashboard-card" style={{ maxWidth: '1400px', margin: '0 auto' }}>

            {/* ============================== */}
            {/* HEADER & GLOBAL FILTERS */}
            {/* ============================== */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '32px' }}>
                
                {/* ROW 1: Title & Quick Filters */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <h2 className="dashboard-header" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                        <Activity color="var(--primary)" size={24} />
                        Project Overview
                    </h2>
                    <div className="quick-filters-container" style={{ margin: 0 }}>
                        <button className={`quick-filter-btn ${activeGlobalFilter === 'allTime' ? 'active' : ''}`} onClick={() => applyQuickFilter('allTime', setStartDate, setEndDate, setActiveGlobalFilter)}>All Time</button>
                        <button className={`quick-filter-btn ${activeGlobalFilter === 'today' ? 'active' : ''}`} onClick={() => applyQuickFilter('today', setStartDate, setEndDate, setActiveGlobalFilter)}>Today</button>
                        <button className={`quick-filter-btn ${activeGlobalFilter === 'yesterday' ? 'active' : ''}`} onClick={() => applyQuickFilter('yesterday', setStartDate, setEndDate, setActiveGlobalFilter)}>Yesterday</button>
                        <button className={`quick-filter-btn ${activeGlobalFilter === 'thisWeek' ? 'active' : ''}`} onClick={() => applyQuickFilter('thisWeek', setStartDate, setEndDate, setActiveGlobalFilter)}>This Week</button>
                        <button className={`quick-filter-btn ${activeGlobalFilter === 'thisMonth' ? 'active' : ''}`} onClick={() => applyQuickFilter('thisMonth', setStartDate, setEndDate, setActiveGlobalFilter)}>This Month</button>
                    </div>
                </div>

                {/* ROW 2: Dropdowns & Project Category */}
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <CustomSelect 
                        icon={TagIcon} 
                        value={activeTag} 
                        onChange={setActiveTag} 
                        options={[{ value: 'ALL', label: 'All Tags' }, ...tags.map(t => ({ value: t, label: t }))]} 
                        containerStyle={{ width: '180px', height: '40px' }} 
                    />
                    
                    <CustomSelect 
                        icon={Clock} 
                        value={activeShift} 
                        onChange={setActiveShift} 
                        options={[{ value: 'ALL', label: 'All Shifts' }, ...shifts.map(s => ({ value: s, label: s }))]} 
                        containerStyle={{ width: '220px', height: '40px' }} 
                    />
                    
                    <CustomSelect 
                        icon={Users} 
                        value={teamCategory} 
                        onChange={setTeamCategory} 
                        options={[{ value: 'ALL', label: 'All Teams' }, ...teams.map(t => ({ value: t, label: t }))]} 
                        containerStyle={{ width: '180px', height: '40px' }} 
                    />

                    <CustomSelect
                        icon={Filter}
                        value={viewCategory}
                        onChange={setViewCategory}
                        options={[
                            { value: 'ALL', label: 'All Projects' },
                            { value: 'OFFICE', label: 'Office Tasks' },
                            { value: 'HOUSE', label: 'House Tasks' }
                        ]}
                        containerStyle={{ width: '180px', height: '40px' }} 
                    />

                    <div className="searchable-dropdown-header" style={{ cursor: 'default', height: '40px' }}>
                        <Calendar size={16} color="var(--text-muted)" />
                        <input type="date" value={startDate} onChange={(e) => handleDateChange(setStartDate, e.target.value, setActiveGlobalFilter)} style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none', paddingLeft: '8px' }} />
                        <span style={{ color: 'var(--text-muted)', margin: '0 8px' }}>to</span>
                        <input type="date" value={endDate} onChange={(e) => handleDateChange(setEndDate, e.target.value, setActiveGlobalFilter)} style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none' }} />
                    </div>
                </div>
            </div>

            {/* GLOBAL SUMMARY CARDS */}
            <div className="summary-cards" style={{ opacity: isFetchingSummary ? 0.5 : 1, transition: 'opacity 0.2s', marginBottom: '40px', flexWrap: 'wrap' }}>
                <div className="summary-card">
                    <span className="card-title">Total Volume</span>
                    <div style={{ display: 'flex', flexDirection: 'column', marginTop: '8px' }}>
                        <span className="card-value" style={{ color: 'var(--primary)', lineHeight: '1' }}>{formatDecimalHours(totalHours)}</span>
                        <span style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px', fontWeight: '500' }}>{totalCount.toLocaleString()} videos</span>
                    </div>
                </div>
                <div className="summary-card">
                    <span className="card-title">Total Accepted</span>
                    <div style={{ display: 'flex', flexDirection: 'column', marginTop: '8px' }}>
                        <span className="card-value" style={{ color: '#10b981', lineHeight: '1' }}>{formatDecimalHours(acceptedHours)}</span>
                        <span style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px', fontWeight: '500' }}>{acceptedCount.toLocaleString()} videos</span>
                        {inspectedCount > 0 && <span style={{ fontSize: '13px', color: 'var(--text-main)', marginTop: '2px', fontWeight: '600' }}>Acceptance Rate - {acceptanceRate}%</span>}
                    </div>
                </div>
                <div className="summary-card">
                    <span className="card-title">Total Rejected</span>
                    <div style={{ display: 'flex', flexDirection: 'column', marginTop: '8px' }}>
                        <span className="card-value" style={{ color: '#ef4444', lineHeight: '1' }}>{formatDecimalHours(rejectedHours)}</span>
                        <span style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px', fontWeight: '500' }}>{rejectedCount.toLocaleString()} videos</span>
                        {inspectedCount > 0 && <span style={{ fontSize: '13px', color: 'var(--text-main)', marginTop: '2px', fontWeight: '600' }}>Rejection Rate - {rejectionRate}%</span>}
                    </div>
                </div>
                <div className="summary-card">
                    <span className="card-title">QC Done</span>
                    <div style={{ display: 'flex', flexDirection: 'column', marginTop: '8px' }}>
                        <span className="card-value" style={{ color: '#3b82f6', lineHeight: '1' }}>{formatDecimalHours(inspectedHours)}</span>
                        <span style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px', fontWeight: '500' }}>{inspectedCount.toLocaleString()} videos</span>
                        {totalCount > 0 && <span style={{ fontSize: '13px', color: 'var(--text-main)', marginTop: '2px', fontWeight: '600' }}>QC Completed - {inspectedRate}%</span>}
                    </div>
                </div>
                <div className="summary-card">
                    <span className="card-title">Pending QC</span>
                    <div style={{ display: 'flex', flexDirection: 'column', marginTop: '8px' }}>
                        <span className="card-value" style={{ color: '#f59e0b', lineHeight: '1' }}>{formatDecimalHours(pendingHours)}</span>
                        <span style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px', fontWeight: '500' }}>{pendingCount.toLocaleString()} videos</span>
                        {totalCount > 0 && <span style={{ fontSize: '13px', color: 'var(--text-main)', marginTop: '2px', fontWeight: '600' }}>QC Pending - {pendingRate}%</span>}
                    </div>
                </div>
            </div>

            {/* --- PRODUCER ANALYTICS SECTION --- */}
            <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '40px 0 24px 0' }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
                        <ListChecks size={20} color="var(--primary)" />
                        Producer Analytics
                    </h3>
                    <div className="quick-filters-container" style={{ margin: 0 }}>
                        <button className={`quick-filter-btn ${activeProdFilter === 'allTime' ? 'active' : ''}`} onClick={() => applyQuickFilter('allTime', setProdStartDate, setProdEndDate, setActiveProdFilter)}>All Time</button>
                        <button className={`quick-filter-btn ${activeProdFilter === 'today' ? 'active' : ''}`} onClick={() => applyQuickFilter('today', setProdStartDate, setProdEndDate, setActiveProdFilter)}>Today</button>
                        <button className={`quick-filter-btn ${activeProdFilter === 'yesterday' ? 'active' : ''}`} onClick={() => applyQuickFilter('yesterday', setProdStartDate, setProdEndDate, setActiveProdFilter)}>Yesterday</button>
                        <button className={`quick-filter-btn ${activeProdFilter === 'thisWeek' ? 'active' : ''}`} onClick={() => applyQuickFilter('thisWeek', setProdStartDate, setProdEndDate, setActiveProdFilter)}>This Week</button>
                        <button className={`quick-filter-btn ${activeProdFilter === 'thisMonth' ? 'active' : ''}`} onClick={() => applyQuickFilter('thisMonth', setProdStartDate, setProdEndDate, setActiveProdFilter)}>This Month</button>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <div className="searchable-dropdown-header" style={{ cursor: 'default', height: '40px' }}>
                        <Calendar size={16} color="var(--text-muted)" />
                        <input type="date" value={prodStartDate} onChange={(e) => handleDateChange(setProdStartDate, e.target.value, setActiveProdFilter)} style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none', paddingLeft: '8px' }} />
                        <span style={{ color: 'var(--text-muted)', margin: '0 8px' }}>to</span>
                        <input type="date" value={prodEndDate} onChange={(e) => handleDateChange(setProdEndDate, e.target.value, setActiveProdFilter)} style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none' }} />
                    </div>

                    <div className="searchable-dropdown-container" style={{ width: '100%', maxWidth: '400px' }} ref={dropdownRef}>
                        <div className="searchable-dropdown-header" onClick={() => setIsDropdownOpen(!isDropdownOpen)} style={{ height: '40px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <User size={16} color="var(--text-muted)" />
                                <span>{selectedProducer ? selectedProducer.username : '-- Search Specific Producer --'}</span>
                            </div>
                            <ChevronDown size={16} color="var(--text-muted)" style={{ transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }} />
                        </div>

                        {isDropdownOpen && (
                            <div className="searchable-dropdown-menu">
                                <div className="searchable-dropdown-search">
                                    <Search size={14} className="searchable-dropdown-search-icon" />
                                    <input type="text" placeholder="Search by username..." value={producerSearch} onChange={(e) => setProducerSearch(e.target.value)} autoFocus />
                                </div>
                                <ul className="searchable-dropdown-list">
                                    {filteredProducers.length > 0 ? (
                                        filteredProducers.map(p => (
                                            <li key={p.username} className={`searchable-dropdown-item ${selectedProducer?.username === p.username ? 'active' : ''}`} onClick={() => { setSelectedProducer(p); setIsDropdownOpen(false); setProducerSearch(''); }}>
                                                <div style={{ fontWeight: '600' }}>{p.username}</div>
                                                <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                                                    <span style={{ fontSize: '10px', background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-muted)' }}>{p.teamName}</span>
                                                    {p.tag !== 'N/A' && <span style={{ fontSize: '10px', background: 'rgba(139, 92, 246, 0.1)', padding: '2px 6px', borderRadius: '4px', color: '#8b5cf6' }}>{p.tag}</span>}
                                                    {p.shift !== 'N/A' && <span style={{ fontSize: '10px', background: 'rgba(59, 130, 246, 0.1)', padding: '2px 6px', borderRadius: '4px', color: '#3b82f6' }}>{p.shift}</span>}
                                                </div>
                                            </li>
                                        ))
                                    ) : (
                                        <li style={{ padding: '10px 16px', color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center' }}>No producers found</li>
                                    )}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* PRODUCER TASK HISTORY TABLE */}
            {selectedProducer && (
                <div style={{ opacity: isFetchingProducer ? 0.6 : 1, transition: 'opacity 0.2s' }}>
                    {producerData && (
                        <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
                            {(() => {
                                const totalVids = producerData.tasks?.reduce((acc, t) => acc + t.totalVideos, 0) || 0;
                                const passedVids = producerData.tasks?.reduce((acc, t) => acc + t.passedVideos, 0) || 0;
                                const failedVids = producerData.tasks?.reduce((acc, t) => acc + t.failedVideos, 0) || 0;
                                const waitingVids = producerData.tasks?.reduce((acc, t) => acc + t.waitingVideos, 0) || 0;

                                return (
                                    <>
                                        <div style={{ flex: 1, minWidth: '120px' }}>
                                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Team</span>
                                            <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)', marginTop: '4px' }}>{producerData.teamName}</div>
                                        </div>
                                        <div style={{ flex: 1, minWidth: '120px', borderLeft: '1px solid var(--border-color)', paddingLeft: '16px' }}>
                                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Volume</span>
                                            <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--primary)', marginTop: '4px' }}>{formatDuration(producerData.stats.totalSec)}</div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', fontWeight: '500' }}>{totalVids.toLocaleString()} videos</div>
                                        </div>
                                        <div style={{ flex: 1, minWidth: '120px', borderLeft: '1px solid var(--border-color)', paddingLeft: '16px' }}>
                                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Accepted</span>
                                            <div style={{ fontSize: '15px', fontWeight: '600', color: '#10b981', marginTop: '4px' }}>{formatDuration(producerData.stats.acceptedSec)}</div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', fontWeight: '500' }}>{passedVids.toLocaleString()} videos</div>
                                        </div>
                                        <div style={{ flex: 1, minWidth: '120px', borderLeft: '1px solid var(--border-color)', paddingLeft: '16px' }}>
                                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Rejected</span>
                                            <div style={{ fontSize: '15px', fontWeight: '600', color: '#ef4444', marginTop: '4px' }}>{formatDuration(producerData.stats.rejectedSec)}</div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', fontWeight: '500' }}>{failedVids.toLocaleString()} videos</div>
                                        </div>
                                        <div style={{ flex: 1, minWidth: '120px', borderLeft: '1px solid var(--border-color)', paddingLeft: '16px' }}>
                                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Pending QC</span>
                                            <div style={{ fontSize: '15px', fontWeight: '600', color: '#f59e0b', marginTop: '4px' }}>{formatDuration(producerData.stats.waitingSec || 0)}</div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', fontWeight: '500' }}>{waitingVids.toLocaleString()} videos</div>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    )}

                    <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-main)' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr>
                                    <th style={{ padding: '14px 16px', background: 'var(--bg-secondary)', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)' }}>Task ID & Name</th>
                                    <th style={{ padding: '14px 16px', background: 'var(--bg-secondary)', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>Total Volume</th>
                                    <th style={{ padding: '14px 16px', background: 'var(--bg-secondary)', color: '#10b981', fontSize: '12px', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>Passed</th>
                                    <th style={{ padding: '14px 16px', background: 'var(--bg-secondary)', color: '#ef4444', fontSize: '12px', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>Failed</th>
                                    <th style={{ padding: '14px 16px', background: 'var(--bg-secondary)', color: '#f59e0b', fontSize: '12px', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>Waiting</th>
                                </tr>
                            </thead>
                            <tbody>
                                {producerData?.tasks?.length > 0 ? (
                                    producerData.tasks.map(task => {
                                        // --- FIX: Safely fallback to whichever key the backend provides ---
                                        const safePassedSec = task.passedSec || task.acceptedSec || 0;
                                        const safeFailedSec = task.failedSec || task.rejectedSec || 0;
                                        const safeWaitingSec = task.waitingSec || 0;
                                        const totalSec = task.totalSec || 1; // Prevent division by zero

                                        const safePassedVideos = task.passedVideos || task.acceptedVideos || 0;
                                        const safeFailedVideos = task.failedVideos || task.rejectedVideos || 0;
                                        const safeWaitingVideos = task.waitingVideos || 0;

                                        const passedPct = task.totalSec > 0 ? Math.round((safePassedSec / totalSec) * 100) : 0;
                                        const failedPct = task.totalSec > 0 ? Math.round((safeFailedSec / totalSec) * 100) : 0;
                                        const waitingPct = task.totalSec > 0 ? Math.round((safeWaitingSec / totalSec) * 100) : 0;

                                        return (
                                            <tr key={task._id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                <td style={{ padding: '14px 16px' }}>
                                                    <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-main)' }}>{task._id || 'Unknown Task ID'}</div>
                                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{task.taskName || 'Unknown Task Name'}</div>
                                                </td>
                                                <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                                    <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-main)' }}>{task.totalVideos} videos</div>
                                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{formatDuration(task.totalSec)}</div>
                                                </td>
                                                <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#10b981' }}>{safePassedVideos}</div>
                                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{passedPct}%</div>
                                                </td>
                                                <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#ef4444' }}>{safeFailedVideos}</div>
                                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{failedPct}%</div>
                                                </td>
                                                <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#f59e0b' }}>{safeWaitingVideos}</div>
                                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{waitingPct}%</div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan="5" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                            {isFetchingProducer ? <Loader2 className="spinning" style={{ margin: '0 auto' }} /> : 'No tasks found for this date range.'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}