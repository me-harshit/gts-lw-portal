import { useState, useEffect, useRef, Fragment } from 'react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { Calendar, User, Search, ChevronDown, ChevronRight, FileWarning, ShieldAlert, Users, ListFilter, AlertCircle, Video, Tag as TagIcon, Clock, Loader2, FolderSearch } from 'lucide-react';
import './TaskDashboard.css';
import './ProjectDashboard.css';
import './QcDashboard.css';

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

export default function QcDashboard() {
    const [viewMode, setViewMode] = useState('BY_PRODUCER'); 

    // Filters
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [activeFilter, setActiveFilter] = useState('');
    
    const [activeTag, setActiveTag] = useState('ALL');
    const [activeShift, setActiveShift] = useState('ALL');
    const [teamCategory, setTeamCategory] = useState('ALL');

    // Metadata
    const [tags, setTags] = useState([]);
    const [shifts, setShifts] = useState([]);
    const [teams, setTeams] = useState([]);
    const [teamConfigs, setTeamConfigs] = useState([]);
    const [userMappings, setUserMappings] = useState([]);
    
    // Dropdowns
    const [selectedProducer, setSelectedProducer] = useState(null);
    const [isProducerOpen, setIsProducerOpen] = useState(false);
    const [producerSearch, setProducerSearch] = useState('');
    const producerRef = useRef(null);

    const [selectedReason, setSelectedReason] = useState(null);
    const [isReasonOpen, setIsReasonOpen] = useState(false);
    const [reasonSearch, setReasonSearch] = useState('');
    const reasonRef = useRef(null);

    const [selectedTask, setSelectedTask] = useState(null);
    const [isTaskOpen, setIsTaskOpen] = useState(false);
    const [taskSearch, setTaskSearch] = useState('');
    const taskRef = useRef(null);

    // Accordions
    const [expandedTops, setExpandedTops] = useState(new Set());
    const [expandedTasks, setExpandedTasks] = useState(new Set());

    const getBeijingDateStr = (dateObj) => {
        return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(dateObj);
    };

    const applyQuickFilter = (type) => {
        setActiveFilter(type);
        const today = new Date();

        if (type === 'today') {
            const todayStr = getBeijingDateStr(today);
            setStartDate(todayStr); setEndDate(todayStr);
        } else if (type === 'yesterday') {
            const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
            const yestStr = getBeijingDateStr(yesterday);
            setStartDate(yestStr); setEndDate(yestStr);
        } else if (type === 'thisWeek') {
            const monday = new Date(today); 
            const day = monday.getDay() || 7; 
            monday.setDate(monday.getDate() - (day - 1));
            setStartDate(getBeijingDateStr(monday)); 
            setEndDate(getBeijingDateStr(today));
        } else if (type === 'thisMonth') {
            const beijingParts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit' }).formatToParts(today);
            const y = beijingParts.find(p => p.type === 'year').value;
            const m = beijingParts.find(p => p.type === 'month').value;
            setStartDate(`${y}-${m}-01`); 
            setEndDate(getBeijingDateStr(today));
        } else if (type === 'allTime') {
            setStartDate(''); setEndDate('');
        }
    };

    const handleDateChange = (setter, value) => { setActiveFilter(''); setter(value); };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (producerRef.current && !producerRef.current.contains(event.target)) setIsProducerOpen(false);
            if (reasonRef.current && !reasonRef.current.contains(event.target)) setIsReasonOpen(false);
            if (taskRef.current && !taskRef.current.contains(event.target)) setIsTaskOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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
                applyQuickFilter('thisMonth');
                setTags(tagsRes.data.map(t => t.name));
                setShifts(shiftsRes.data.map(s => s.name));
                setUserMappings(mapsRes.data);
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
    if ((activeTag !== 'ALL' || activeShift !== 'ALL' || teamCategory !== 'ALL') && matchingTeams.length === 0) {
        teamQuery = '___NONE___'; 
    } else if (activeTag !== 'ALL' || activeShift !== 'ALL' || teamCategory !== 'ALL') {
        teamQuery = matchingTeams.map(t => t.name).join(',');
    }

    const { data: qcData, isFetching } = useQuery({
        queryKey: ['qcDetails', startDate, endDate, teamQuery, viewMode, selectedProducer?.username, selectedReason, selectedTask?.id],
        queryFn: async () => {
            let url = `${API_URL}/api/dashboard/stats/qc-details?teams=${teamQuery}&viewMode=${viewMode}`;
            if (startDate && endDate) url += `&startDate=${startDate}&endDate=${endDate}`;
            if (viewMode === 'BY_PRODUCER' && selectedProducer) url += `&producer=${selectedProducer.username}`;
            else if (viewMode === 'BY_REASON' && selectedReason) url += `&reason=${encodeURIComponent(selectedReason)}`;
            else if (viewMode === 'BY_TASK' && selectedTask) url += `&taskId=${encodeURIComponent(selectedTask.id)}`;
            
            const res = await axios.get(url);
            return res.data;
        },
        refetchOnWindowFocus: false,
        enabled: teamConfigs.length > 0
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

    const dynamicReasons = qcData?.dynamicReasons || [];
    const filteredReasons = dynamicReasons.filter(r => r.toLowerCase().includes(reasonSearch.toLowerCase()));

    const dynamicTasks = qcData?.dynamicTasks || [];
    const filteredTasks = dynamicTasks.filter(t => t.name.toLowerCase().includes(taskSearch.toLowerCase()));

    const toggleTopLevel = (title) => {
        const newExpanded = new Set(expandedTops);
        if (newExpanded.has(title)) newExpanded.delete(title);
        else newExpanded.add(title);
        setExpandedTops(newExpanded);
    };

    const toggleTask = (taskKey) => {
        const newExpanded = new Set(expandedTasks);
        if (newExpanded.has(taskKey)) newExpanded.delete(taskKey);
        else newExpanded.add(taskKey);
        setExpandedTasks(newExpanded);
    };

    const stats = qcData?.stats || { totalVideos: 0, qcDone: 0, accepted: 0, rejected: 0, waiting: 0 };
    const rejectionTree = qcData?.rejectionTree || [];

    const getDynamicHeaderTitle = () => {
        if (viewMode === 'BY_PRODUCER') return 'Failure Analysis by Producer';
        if (viewMode === 'BY_REASON') return 'Failure Analysis by Reason';
        return 'Failure Analysis by Task';
    };

    return (
        <div className="dashboard-card" style={{ maxWidth: '1400px', margin: '0 auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <h2 className="dashboard-header" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, color: 'var(--primary)' }}>
                        <ShieldAlert size={28} /> QC Analysis Hub
                    </h2>
                    <div className="quick-filters-container" style={{ margin: 0 }}>
                        <button className={`quick-filter-btn ${activeFilter === 'allTime' ? 'active' : ''}`} onClick={() => applyQuickFilter('allTime')}>All Time</button>
                        <button className={`quick-filter-btn ${activeFilter === 'today' ? 'active' : ''}`} onClick={() => applyQuickFilter('today')}>Today</button>
                        <button className={`quick-filter-btn ${activeFilter === 'yesterday' ? 'active' : ''}`} onClick={() => applyQuickFilter('yesterday')}>Yesterday</button>
                        <button className={`quick-filter-btn ${activeFilter === 'thisWeek' ? 'active' : ''}`} onClick={() => applyQuickFilter('thisWeek')}>This Week</button>
                        <button className={`quick-filter-btn ${activeFilter === 'thisMonth' ? 'active' : ''}`} onClick={() => applyQuickFilter('thisMonth')}>This Month</button>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end' }}>
                    <CustomSelect 
                        icon={TagIcon} 
                        value={activeTag} 
                        onChange={setActiveTag} 
                        options={[{ value: 'ALL', label: 'All Tags' }, ...tags.map(t => ({ value: t, label: t }))]} 
                        containerStyle={{ width: '160px', height: '40px' }} 
                    />
                    <CustomSelect 
                        icon={Clock} 
                        value={activeShift} 
                        onChange={setActiveShift} 
                        options={[{ value: 'ALL', label: 'All Shifts' }, ...shifts.map(s => ({ value: s, label: s }))]} 
                        containerStyle={{ width: '180px', height: '40px' }} 
                    />
                    <CustomSelect 
                        icon={Users} 
                        value={teamCategory} 
                        onChange={setTeamCategory} 
                        options={[{ value: 'ALL', label: 'All Teams' }, ...teams.map(t => ({ value: t, label: t }))]} 
                        containerStyle={{ width: '160px', height: '40px' }} 
                    />
                    <div className="qc-filter-wrapper" style={{ height: '40px' }}>
                        <Calendar size={16} color="var(--text-muted)" />
                        <input type="date" value={startDate} onChange={(e) => handleDateChange(setStartDate, e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none' }} />
                        <span style={{ color: 'var(--text-muted)' }}>to</span>
                        <input type="date" value={endDate} onChange={(e) => handleDateChange(setEndDate, e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none' }} />
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '16px' }}>
                    <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-main)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <button 
                            onClick={() => { setViewMode('BY_PRODUCER'); setSelectedReason(null); setSelectedTask(null); }}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', background: viewMode === 'BY_PRODUCER' ? 'var(--primary)' : 'transparent', color: viewMode === 'BY_PRODUCER' ? '#fff' : 'var(--text-muted)', transition: 'all 0.2s' }}
                        >
                            <User size={14} /> By Producer
                        </button>
                        <button 
                            onClick={() => { setViewMode('BY_REASON'); setSelectedProducer(null); setSelectedTask(null); }}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', background: viewMode === 'BY_REASON' ? 'var(--primary)' : 'transparent', color: viewMode === 'BY_REASON' ? '#fff' : 'var(--text-muted)', transition: 'all 0.2s' }}
                        >
                            <FileWarning size={14} /> By Reason
                        </button>
                        <button 
                            onClick={() => { setViewMode('BY_TASK'); setSelectedProducer(null); setSelectedReason(null); }}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', background: viewMode === 'BY_TASK' ? 'var(--primary)' : 'transparent', color: viewMode === 'BY_TASK' ? '#fff' : 'var(--text-muted)', transition: 'all 0.2s' }}
                        >
                            <ListFilter size={14} /> By Task
                        </button>
                    </div>

                    {/* DYNAMIC DROPDOWN BASED ON VIEW MODE */}
                    {viewMode === 'BY_PRODUCER' && (
                        <div className="custom-dropdown-container" ref={producerRef} style={{ width: '100%', maxWidth: '350px' }}>
                            <div className="custom-dropdown-header" onClick={() => setIsProducerOpen(!isProducerOpen)} style={{ background: 'var(--bg-main)', height: '40px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                                    <User size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {selectedProducer ? selectedProducer.username : '-- Search Specific Producer --'}
                                    </span>
                                </div>
                                <ChevronDown size={16} color="var(--text-muted)" />
                            </div>
                            {isProducerOpen && (
                                <div className="custom-dropdown-menu">
                                    <div className="custom-dropdown-search">
                                        <Search size={14} className="custom-dropdown-search-icon" />
                                        <input type="text" placeholder="Search producers..." value={producerSearch} onChange={(e) => setProducerSearch(e.target.value)} autoFocus />
                                    </div>
                                    <ul className="custom-dropdown-list">
                                        <li className={`custom-dropdown-item ${!selectedProducer ? 'active' : ''}`} onClick={() => { setSelectedProducer(null); setIsProducerOpen(false); setProducerSearch(''); }}>
                                            -- All Producers --
                                        </li>
                                        {filteredProducers.map(p => (
                                            <li key={p.username} className={`custom-dropdown-item ${selectedProducer?.username === p.username ? 'active' : ''}`} onClick={() => { setSelectedProducer(p); setIsProducerOpen(false); setProducerSearch(''); }}>
                                                <div style={{ fontWeight: '600' }}>{p.username}</div>
                                                <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                                                    <span style={{ fontSize: '10px', background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-muted)' }}>{p.teamName}</span>
                                                    {p.tag !== 'N/A' && <span style={{ fontSize: '10px', background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.3)', padding: '2px 6px', borderRadius: '4px', color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: '3px' }}><TagIcon size={10} /> {p.tag}</span>}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    {viewMode === 'BY_REASON' && (
                        <div className="custom-dropdown-container" ref={reasonRef} style={{ width: '100%', maxWidth: '400px' }}>
                            <div className="custom-dropdown-header" onClick={() => setIsReasonOpen(!isReasonOpen)} style={{ background: 'var(--bg-main)', height: '40px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                                    <FileWarning size={16} color="var(--text-muted)" style={{ flexShrink: 0 }}/>
                                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {selectedReason ? selectedReason : '-- Filter by Specific Reason --'}
                                    </span>
                                </div>
                                <ChevronDown size={16} color="var(--text-muted)" />
                            </div>
                            {isReasonOpen && (
                                <div className="custom-dropdown-menu">
                                    <div className="custom-dropdown-search">
                                        <Search size={14} className="custom-dropdown-search-icon" />
                                        <input type="text" placeholder="Search reasons..." value={reasonSearch} onChange={(e) => setReasonSearch(e.target.value)} autoFocus />
                                    </div>
                                    <ul className="custom-dropdown-list">
                                        <li className={`custom-dropdown-item ${!selectedReason ? 'active' : ''}`} onClick={() => { setSelectedReason(null); setIsReasonOpen(false); setReasonSearch(''); }}>
                                            -- All Rejection Reasons --
                                        </li>
                                        {filteredReasons.map(r => (
                                            <li key={r} className={`custom-dropdown-item ${selectedReason === r ? 'active' : ''}`} onClick={() => { setSelectedReason(r); setIsReasonOpen(false); setReasonSearch(''); }}>
                                                {r}
                                            </li>
                                        ))}
                                        {filteredReasons.length === 0 && <li style={{ padding: '10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No reasons found.</li>}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    {viewMode === 'BY_TASK' && (
                        <div className="custom-dropdown-container" ref={taskRef} style={{ width: '100%', maxWidth: '400px' }}>
                            <div className="custom-dropdown-header" onClick={() => setIsTaskOpen(!isTaskOpen)} style={{ background: 'var(--bg-main)', height: '40px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                                    <FolderSearch size={16} color="var(--text-muted)" style={{ flexShrink: 0 }}/>
                                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {selectedTask ? selectedTask.name : '-- Filter by Specific Task --'}
                                    </span>
                                </div>
                                <ChevronDown size={16} color="var(--text-muted)" />
                            </div>
                            {isTaskOpen && (
                                <div className="custom-dropdown-menu">
                                    <div className="custom-dropdown-search">
                                        <Search size={14} className="custom-dropdown-search-icon" />
                                        <input type="text" placeholder="Search task ID or name..." value={taskSearch} onChange={(e) => setTaskSearch(e.target.value)} autoFocus />
                                    </div>
                                    <ul className="custom-dropdown-list">
                                        <li className={`custom-dropdown-item ${!selectedTask ? 'active' : ''}`} onClick={() => { setSelectedTask(null); setIsTaskOpen(false); setTaskSearch(''); }}>
                                            -- All Failed Tasks --
                                        </li>
                                        {filteredTasks.map(t => (
                                            <li key={t.id} className={`custom-dropdown-item ${selectedTask?.id === t.id ? 'active' : ''}`} onClick={() => { setSelectedTask(t); setIsTaskOpen(false); setTaskSearch(''); }}>
                                                {t.name}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="summary-cards" style={{ opacity: isFetching ? 0.5 : 1, transition: 'opacity 0.2s', marginBottom: '40px' }}>
                <div className="summary-card">
                    <span className="card-title">Total Videos</span>
                    <span className="card-value" style={{ color: 'var(--text-main)', marginTop: '8px' }}>{stats.totalVideos.toLocaleString()}</span>
                </div>
                <div className="summary-card">
                    <span className="card-title">Total QC Done</span>
                    <span className="card-value" style={{ color: 'var(--primary)', marginTop: '8px' }}>{stats.qcDone.toLocaleString()}</span>
                </div>
                <div className="summary-card">
                    <span className="card-title">Accepted</span>
                    <span className="card-value" style={{ color: '#10b981', marginTop: '8px' }}>{stats.accepted.toLocaleString()}</span>
                </div>
                <div className="summary-card">
                    <span className="card-title">Rejected</span>
                    <span className="card-value" style={{ color: '#ef4444', marginTop: '8px' }}>{stats.rejected.toLocaleString()}</span>
                </div>
                <div className="summary-card">
                    <span className="card-title">Pending QC</span>
                    <span className="card-value" style={{ color: '#f59e0b', marginTop: '8px' }}>{stats.waiting.toLocaleString()}</span>
                </div>
            </div>

            <h3 style={{ margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
                <ListFilter size={20} color="var(--primary)" />
                {getDynamicHeaderTitle()}
            </h3>

            <div className="qc-tree-container" style={{ opacity: isFetching ? 0.6 : 1, transition: 'opacity 0.2s' }}>
                <div className="qc-tree-header">
                    <div style={{ flex: 1, paddingLeft: '8px' }}>
                        {viewMode === 'BY_PRODUCER' && 'Producer Name'}
                        {viewMode === 'BY_REASON' && 'Rejection Reason'}
                        {viewMode === 'BY_TASK' && 'Task ID & Name'}
                    </div>
                    <div style={{ width: '150px', textAlign: 'right', paddingRight: '8px' }}>Failure Count</div>
                </div>

                {rejectionTree.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        {isFetching ? <Loader2 className="spinning" style={{ margin: '0 auto' }} /> : '🎉 No rejections found for this criteria!'}
                    </div>
                ) : (
                    rejectionTree.map((node, idx) => {
                        const isExpanded = expandedTops.has(node.title);
                        
                        let producerExtra = null;
                        if (viewMode === 'BY_PRODUCER') {
                            const pMap = enrichedProducers.find(p => p.username === node.title);
                            if (pMap) {
                                producerExtra = (
                                    <div style={{ display: 'flex', gap: '6px', marginLeft: '12px' }}>
                                        <span style={{ fontSize: '10px', background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>{pMap.teamName}</span>
                                        {pMap.tag !== 'N/A' && <span style={{ fontSize: '10px', background: 'rgba(139, 92, 246, 0.1)', padding: '2px 6px', borderRadius: '4px', color: '#8b5cf6', border: '1px solid rgba(139, 92, 246, 0.3)' }}><TagIcon size={10} style={{display:'inline', verticalAlign:'middle', marginRight:'2px'}}/>{pMap.tag}</span>}
                                    </div>
                                );
                            }
                        }

                        return (
                            <Fragment key={`top-${idx}`}>
                                <div className="qc-tree-row level-1" onClick={() => toggleTopLevel(node.title)} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <button className="expand-btn" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)' }}>
                                            {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                        </button>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', color: 'var(--text-main)', fontSize: '14px' }}>
                                            {viewMode === 'BY_PRODUCER' && <User size={16} color="var(--text-muted)" />}
                                            {viewMode === 'BY_REASON' && <FileWarning size={16} color="var(--text-muted)" />}
                                            {viewMode === 'BY_TASK' && <FolderSearch size={16} color="var(--text-muted)" />}
                                            {node.title}
                                            {producerExtra}
                                        </div>
                                    </div>
                                    <div className="qc-badge failed">
                                        <AlertCircle size={14} />
                                        {node.totalFailures}
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="qc-tree-children">
                                        {node.tasks.sort((a, b) => b.failCount - a.failCount).map((taskNode, tIdx) => {
                                            const taskKey = `${node.title}-${taskNode.taskName}`;
                                            const isTaskExpanded = expandedTasks.has(taskKey);

                                            return (
                                                <Fragment key={`task-${tIdx}`}>
                                                    <div className="qc-tree-row level-2" onClick={() => toggleTask(taskKey)}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                            <button className="expand-btn" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)' }}>
                                                                {isTaskExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                            </button>
                                                            <div style={{ color: 'var(--text-main)', fontSize: '13px', fontWeight: '500' }}>
                                                                {taskNode.taskName}
                                                            </div>
                                                        </div>
                                                        <div className="qc-badge neutral">
                                                            {taskNode.failCount} failed
                                                        </div>
                                                    </div>

                                                    {isTaskExpanded && (
                                                        <div className="qc-tree-details">
                                                            <table className="qc-inner-table">
                                                                <thead>
                                                                    <tr>
                                                                        <th style={{ width: '40%' }}>Video Details</th>
                                                                        <th>Inspector Feedback</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {taskNode.videos.map((vid, vIdx) => (
                                                                        <tr key={`vid-${vIdx}`}>
                                                                            <td style={{ color: 'var(--primary)', fontWeight: '500' }}>
                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                                    <Video size={14} />
                                                                                    {/* --- FIX 1: Looks for originalName first, falls back to dataName --- */}
                                                                                    {vid.originalName || vid.dataName}
                                                                                </div>
                                                                                {viewMode !== 'BY_PRODUCER' && (
                                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px', marginLeft: '20px' }}>
                                                                                        <User size={10} /> By: {vid.producer}
                                                                                    </div>
                                                                                )}
                                                                            </td>
                                                                            <td style={{ color: 'var(--text-main)', lineHeight: '1.5' }}>
                                                                                {/* --- FIX 2: Looks for English Feedback first, falls back to raw description --- */}
                                                                                {vid.englishFeedback || vid.description || 'No feedback provided'}
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                    {taskNode.failCount > 50 && (
                                                                        <tr>
                                                                            <td colSpan="2" style={{ textAlign: 'center', padding: '10px', fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                                                                Displaying the first 50 results to maintain system performance.
                                                                            </td>
                                                                        </tr>
                                                                    )}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    )}
                                                </Fragment>
                                            );
                                        })}
                                    </div>
                                )}
                            </Fragment>
                        );
                    })
                )}
            </div>
        </div>
    );
}