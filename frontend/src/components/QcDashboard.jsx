import { useState, useEffect, useRef, Fragment } from 'react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import {
    Calendar, User, Search, ChevronDown, ChevronRight, 
    FileWarning, ShieldAlert, Users, ListFilter, AlertCircle, Video
} from 'lucide-react';
import './TaskDashboard.css';
import './ProjectDashboard.css';
import './QcDashboard.css';

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
        <div className="searchable-dropdown-container" style={{ width: 'auto', minWidth: '160px' }} ref={dropdownRef}>
            <div className="searchable-dropdown-header" onClick={() => setIsOpen(!isOpen)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {Icon && <Icon size={16} color="var(--text-muted)" />}
                    <span>{selectedLabel}</span>
                </div>
                <ChevronDown size={16} color="var(--text-muted)" />
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

export default function QcDashboard() {
    // Mode State
    const [viewMode, setViewMode] = useState('BY_PRODUCER'); 

    // Filters
    const [teamCategory, setTeamCategory] = useState('ALL');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [activeFilter, setActiveFilter] = useState('allTime');
    
    // Selections
    const [teams, setTeams] = useState([]);
    const [producers, setProducers] = useState([]);
    
    // Producer Dropdown State
    const [selectedProducer, setSelectedProducer] = useState(null);
    const [isProducerOpen, setIsProducerOpen] = useState(false);
    const [producerSearch, setProducerSearch] = useState('');
    const producerRef = useRef(null);

    // Reason Dropdown State
    const [selectedReason, setSelectedReason] = useState(null);
    const [isReasonOpen, setIsReasonOpen] = useState(false);
    const [reasonSearch, setReasonSearch] = useState('');
    const reasonRef = useRef(null);

    // Nested Accordion State
    const [expandedTops, setExpandedTops] = useState(new Set());
    const [expandedTasks, setExpandedTasks] = useState(new Set());

    const applyQuickFilter = (type) => {
        setActiveFilter(type);
        const today = new Date();
        const formatDate = (date) => {
            const yyyy = date.getFullYear();
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const dd = String(date.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
        };

        if (type === 'today') {
            setStartDate(formatDate(today));
            setEndDate(formatDate(today));
        } else if (type === 'yesterday') {
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            setStartDate(formatDate(yesterday));
            setEndDate(formatDate(yesterday));
        } else if (type === 'thisWeek') {
            const monday = new Date(today);
            const day = monday.getDay() || 7; 
            monday.setDate(monday.getDate() - (day - 1));
            setStartDate(formatDate(monday));
            setEndDate(formatDate(today));
        } else if (type === 'thisMonth') {
            const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
            setStartDate(formatDate(firstDay));
            setEndDate(formatDate(today));
        } else if (type === 'allTime') {
            setStartDate('');
            setEndDate('');
        }
    };

    const handleDateChange = (setter, value) => {
        setActiveFilter('');
        setter(value);
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (producerRef.current && !producerRef.current.contains(event.target)) setIsProducerOpen(false);
            if (reasonRef.current && !reasonRef.current.contains(event.target)) setIsReasonOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const fetchMeta = async () => {
            try {
                const res = await axios.get(`${API_URL}/api/teams`);
                const mappings = res.data;
                const uniqueTeams = new Set(mappings.map(m => m.teamName));
                setTeams(Array.from(uniqueTeams));
                setProducers(mappings);
            } catch (error) {
                console.error("Failed to load meta data", error);
            }
        };
        fetchMeta();
    }, []);

    // --- FETCH QC DETAILS ---
    const { data: qcData, isFetching } = useQuery({
        queryKey: ['qcDetails', startDate, endDate, teamCategory, viewMode, selectedProducer?.username, selectedReason],
        queryFn: async () => {
            let url = `${API_URL}/api/dashboard/stats/qc-details?teamName=${teamCategory}&viewMode=${viewMode}`;
            if (startDate && endDate) url += `&startDate=${startDate}&endDate=${endDate}`;
            
            if (viewMode === 'BY_PRODUCER' && selectedProducer) {
                url += `&producer=${selectedProducer.username}`;
            } else if (viewMode === 'BY_REASON' && selectedReason) {
                url += `&reason=${encodeURIComponent(selectedReason)}`;
            }
            
            const res = await axios.get(url);
            return res.data;
        },
        refetchOnWindowFocus: false
    });

    const filteredProducers = producers.filter(p => {
        const matchesTeam = teamCategory === 'ALL' || p.teamName === teamCategory;
        const matchesSearch = p.username.toLowerCase().includes(producerSearch.toLowerCase());
        return matchesTeam && matchesSearch;
    });

    const dynamicReasons = qcData?.dynamicReasons || [];
    const filteredReasons = dynamicReasons.filter(r => r.toLowerCase().includes(reasonSearch.toLowerCase()));

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

    return (
        <div className="dashboard-card">
            
            {/* TOP BAR & FILTERS */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <h2 className="dashboard-header" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                        <ShieldAlert color="var(--primary)" size={24} />
                        Quality Control Hub
                    </h2>
                    <div className="quick-filters-container">
                        <button className={`quick-filter-btn ${activeFilter === 'allTime' ? 'active' : ''}`} onClick={() => applyQuickFilter('allTime')}>All Time</button>
                        <button className={`quick-filter-btn ${activeFilter === 'today' ? 'active' : ''}`} onClick={() => applyQuickFilter('today')}>Today</button>
                        <button className={`quick-filter-btn ${activeFilter === 'yesterday' ? 'active' : ''}`} onClick={() => applyQuickFilter('yesterday')}>Yesterday</button>
                        <button className={`quick-filter-btn ${activeFilter === 'thisWeek' ? 'active' : ''}`} onClick={() => applyQuickFilter('thisWeek')}>This Week</button>
                        <button className={`quick-filter-btn ${activeFilter === 'thisMonth' ? 'active' : ''}`} onClick={() => applyQuickFilter('thisMonth')}>This Month</button>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <div className="searchable-dropdown-header" style={{ cursor: 'default', height: '40px' }}>
                        <Calendar size={16} color="var(--text-muted)" />
                        <input type="date" value={startDate} onChange={(e) => handleDateChange(setStartDate, e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none', paddingLeft: '8px' }} />
                        <span style={{ color: 'var(--text-muted)', margin: '0 8px' }}>to</span>
                        <input type="date" value={endDate} onChange={(e) => handleDateChange(setEndDate, e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none' }} />
                    </div>

                    <CustomSelect 
                        icon={Users}
                        value={teamCategory}
                        onChange={setTeamCategory}
                        options={[{ value: 'ALL', label: 'All Teams' }, ...teams.map(t => ({ value: t, label: t }))]}
                    />
                </div>
            </div>

            {/* VIEW MODE TOGGLE & DYNAMIC DROPDOWN */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
                
                <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-main)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <button 
                        onClick={() => { setViewMode('BY_PRODUCER'); setSelectedReason(null); }}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', background: viewMode === 'BY_PRODUCER' ? 'var(--primary)' : 'transparent', color: viewMode === 'BY_PRODUCER' ? '#fff' : 'var(--text-muted)', transition: 'all 0.2s' }}
                    >
                        <User size={14} /> By Reason
                    </button>
                    <button 
                        onClick={() => { setViewMode('BY_REASON'); setSelectedProducer(null); }}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', background: viewMode === 'BY_REASON' ? 'var(--primary)' : 'transparent', color: viewMode === 'BY_REASON' ? '#fff' : 'var(--text-muted)', transition: 'all 0.2s' }}
                    >
                        <ListFilter size={14} /> By Producer
                    </button>
                </div>

                {viewMode === 'BY_PRODUCER' ? (
                    <div className="searchable-dropdown-container" ref={producerRef}>
                        <div className="searchable-dropdown-header" onClick={() => setIsProducerOpen(!isProducerOpen)} style={{ background: 'var(--bg-main)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <User size={16} color="var(--text-muted)" />
                                <span>{selectedProducer ? selectedProducer.username : '-- Global Producers --'}</span>
                            </div>
                            <ChevronDown size={16} color="var(--text-muted)" />
                        </div>
                        {isProducerOpen && (
                            <div className="searchable-dropdown-menu">
                                <div className="searchable-dropdown-search">
                                    <Search size={14} className="searchable-dropdown-search-icon" />
                                    <input type="text" placeholder="Search producers..." value={producerSearch} onChange={(e) => setProducerSearch(e.target.value)} autoFocus />
                                </div>
                                <ul className="searchable-dropdown-list">
                                    <li className={`searchable-dropdown-item ${!selectedProducer ? 'active' : ''}`} onClick={() => { setSelectedProducer(null); setIsProducerOpen(false); setProducerSearch(''); }}>
                                        -- Global Producers --
                                    </li>
                                    {filteredProducers.map(p => (
                                        <li key={p.username} className={`searchable-dropdown-item ${selectedProducer?.username === p.username ? 'active' : ''}`} onClick={() => { setSelectedProducer(p); setIsProducerOpen(false); setProducerSearch(''); }}>
                                            {p.username} <span className="searchable-dropdown-item-team">{p.teamName}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="searchable-dropdown-container" ref={reasonRef}>
                        <div className="searchable-dropdown-header" onClick={() => setIsReasonOpen(!isReasonOpen)} style={{ background: 'var(--bg-main)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FileWarning size={16} color="var(--text-muted)" />
                                <span>{selectedReason ? selectedReason : '-- Global Rejection Reasons --'}</span>
                            </div>
                            <ChevronDown size={16} color="var(--text-muted)" />
                        </div>
                        {isReasonOpen && (
                            <div className="searchable-dropdown-menu">
                                <div className="searchable-dropdown-search">
                                    <Search size={14} className="searchable-dropdown-search-icon" />
                                    <input type="text" placeholder="Search reasons..." value={reasonSearch} onChange={(e) => setReasonSearch(e.target.value)} autoFocus />
                                </div>
                                <ul className="searchable-dropdown-list">
                                    <li className={`searchable-dropdown-item ${!selectedReason ? 'active' : ''}`} onClick={() => { setSelectedReason(null); setIsReasonOpen(false); setReasonSearch(''); }}>
                                        -- Global Rejection Reasons --
                                    </li>
                                    {filteredReasons.map(r => (
                                        <li key={r} className={`searchable-dropdown-item ${selectedReason === r ? 'active' : ''}`} onClick={() => { setSelectedReason(r); setIsReasonOpen(false); setReasonSearch(''); }}>
                                            {r}
                                        </li>
                                    ))}
                                    {filteredReasons.length === 0 && <li style={{ padding: '10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No reasons found.</li>}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* SUMMARY CARDS */}
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

            {/* --- NEW TREE DATA GRID --- */}
            <h3 style={{ margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
                <ListFilter size={20} color="var(--primary)" />
                {viewMode === 'BY_PRODUCER' ? 'Failure Analysis by Reason' : 'Failure Analysis by Producer'}
            </h3>

            <div className="qc-tree-container" style={{ opacity: isFetching ? 0.6 : 1, transition: 'opacity 0.2s' }}>
                
                {/* Master Header */}
                <div className="qc-tree-header">
                    <div style={{ flex: 1, paddingLeft: '8px' }}>{viewMode === 'BY_PRODUCER' ? 'Rejection Reason' : 'Producer Name'}</div>
                    <div style={{ width: '150px', textAlign: 'right', paddingRight: '8px' }}>Failure Count</div>
                </div>

                {rejectionTree.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        {isFetching ? 'Crunching the data...' : '🎉 No rejections found for this criteria!'}
                    </div>
                ) : (
                    rejectionTree.map((node, idx) => {
                        const isExpanded = expandedTops.has(node.title);
                        
                        return (
                            <Fragment key={`top-${idx}`}>
                                {/* LEVEL 1 */}
                                <div 
                                    className="qc-tree-row level-1" 
                                    onClick={() => toggleTopLevel(node.title)}
                                    style={{ borderBottom: isExpanded ? '1px solid var(--border-color)' : '1px solid var(--border-color)' }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <button className="expand-btn" style={{ background: 'transparent' }}>
                                            {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                        </button>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', color: 'var(--text-main)', fontSize: '14px' }}>
                                            {viewMode === 'BY_PRODUCER' ? <FileWarning size={16} color="var(--text-muted)" /> : <User size={16} color="var(--text-muted)" />}
                                            {node.title}
                                        </div>
                                    </div>
                                    <div className="qc-badge failed">
                                        <AlertCircle size={14} />
                                        {node.totalFailures}
                                    </div>
                                </div>

                                {/* LEVEL 2: TASKS */}
                                {isExpanded && (
                                    <div className="qc-tree-children">
                                        {node.tasks.map((taskNode, tIdx) => {
                                            const taskKey = `${node.title}-${taskNode.taskName}`;
                                            const isTaskExpanded = expandedTasks.has(taskKey);

                                            return (
                                                <Fragment key={`task-${tIdx}`}>
                                                    <div 
                                                        className="qc-tree-row level-2"
                                                        onClick={() => toggleTask(taskKey)}
                                                    >
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                            <button className="expand-btn" style={{ background: 'transparent' }}>
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

                                                    {/* LEVEL 3: VIDEOS & FEEDBACK TABLE */}
                                                    {isTaskExpanded && (
                                                        <div className="qc-tree-details">
                                                            <table className="qc-inner-table">
                                                                <thead>
                                                                    <tr>
                                                                        <th style={{ width: '35%' }}>Video ID / Data Name</th>
                                                                        <th>Inspector Feedback</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {taskNode.videos.map((vid, vIdx) => (
                                                                        <tr key={`vid-${vIdx}`}>
                                                                            <td style={{ color: 'var(--primary)', fontWeight: '500' }}>
                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                                    <Video size={14} />
                                                                                    {vid.dataName}
                                                                                </div>
                                                                            </td>
                                                                            <td style={{ color: 'var(--text-main)', lineHeight: '1.5' }}>
                                                                                {vid.description}
                                                                            </td>
                                                                        </tr>
                                                                    ))}
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