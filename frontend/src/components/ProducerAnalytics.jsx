import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { Filter, Calendar, User, ListChecks, Search, ChevronDown, Loader2 } from 'lucide-react';
import { formatDuration } from '../utils/timeFormat';
import { useProjects } from '../hooks/useProjects';
import './TaskDashboard.css';
import './ProjectDashboard.css'; // Inherit layout styles
import './ProducerAnalytics.css';

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

export default function ProducerAnalytics() {
    const [viewCategory, setViewCategory] = useState('ALL');
    const { enabledProjects } = useProjects();
    const [prodStartDate, setProdStartDate] = useState('');
    const [prodEndDate, setProdEndDate] = useState('');
    const [activeProdFilter, setActiveProdFilter] = useState('allTime');

    const [userMappings, setUserMappings] = useState([]);
    const [selectedProducer, setSelectedProducer] = useState(null);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [producerSearch, setProducerSearch] = useState('');
    const dropdownRef = useRef(null);

    const applyQuickFilter = (type) => {
        setActiveProdFilter(type);
        const today = new Date();
        const formatDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

        if (type === 'today') { setProdStartDate(formatDate(today)); setProdEndDate(formatDate(today)); } 
        else if (type === 'yesterday') { const y = new Date(today); y.setDate(y.getDate() - 1); setProdStartDate(formatDate(y)); setProdEndDate(formatDate(y)); } 
        else if (type === 'thisWeek') { const m = new Date(today); m.setDate(m.getDate() - (m.getDay() || 7) + 1); setProdStartDate(formatDate(m)); setProdEndDate(formatDate(today)); } 
        else if (type === 'thisMonth') { setProdStartDate(formatDate(new Date(today.getFullYear(), today.getMonth(), 1))); setProdEndDate(formatDate(today)); } 
        else { setProdStartDate(''); setProdEndDate(''); }
    };

    const handleDateChange = (value, isStart) => {
        setActiveProdFilter('');
        isStart ? setProdStartDate(value) : setProdEndDate(value);
    };

    useEffect(() => {
        const fetchMeta = async () => {
            try {
                const res = await axios.get(`${API_URL}/api/teams`);
                setUserMappings(res.data);
            } catch (error) { console.error("Failed to load metadata", error); }
        };
        fetchMeta();
    }, []);

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

    const filteredProducers = userMappings.filter(p => p.username.toLowerCase().includes(producerSearch.toLowerCase()));

    return (
        <div className="dashboard-card pd-container producer-analytics-container">
            <div className="pd-header-section">
                <div className="pd-header-row">
                    <h2 className="dashboard-header pd-title">
                        <ListChecks className="pd-icon-primary" size={24} />
                        Producer Analytics
                    </h2>
                    <div className="quick-filters-container pd-no-margin">
                        <button className={`quick-filter-btn ${activeProdFilter === 'allTime' ? 'active' : ''}`} onClick={() => applyQuickFilter('allTime')}>All Time</button>
                        <button className={`quick-filter-btn ${activeProdFilter === 'today' ? 'active' : ''}`} onClick={() => applyQuickFilter('today')}>Today</button>
                        <button className={`quick-filter-btn ${activeProdFilter === 'yesterday' ? 'active' : ''}`} onClick={() => applyQuickFilter('yesterday')}>Yesterday</button>
                        <button className={`quick-filter-btn ${activeProdFilter === 'thisWeek' ? 'active' : ''}`} onClick={() => applyQuickFilter('thisWeek')}>This Week</button>
                        <button className={`quick-filter-btn ${activeProdFilter === 'thisMonth' ? 'active' : ''}`} onClick={() => applyQuickFilter('thisMonth')}>This Month</button>
                    </div>
                </div>

                {/* --- ALL FILTERS ON ONE LINE --- */}
                <div className="pd-filter-row">
                    <CustomSelect 
                        className="pd-select-sm" 
                        icon={Filter} 
                        value={viewCategory} 
                        onChange={setViewCategory} 
                        options={[
                            { value: 'ALL', label: 'All Projects' },
                            ...enabledProjects.map(p => ({ value: p.key, label: p.name }))
                        ]}
                    />

                    <div className="pd-date-wrapper">
                        <Calendar size={16} className="pd-icon-muted" />
                        <input type="date" className="pd-date-input" value={prodStartDate} onChange={(e) => handleDateChange(e.target.value, true)} />
                        <span className="pd-date-separator">to</span>
                        <input type="date" className="pd-date-input" value={prodEndDate} onChange={(e) => handleDateChange(e.target.value, false)} />
                    </div>

                    <div className="searchable-dropdown-container pd-producer-select" ref={dropdownRef}>
                        <div className="searchable-dropdown-header" onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
                            <div className="searchable-dropdown-header-content">
                                <User size={16} className="searchable-dropdown-icon" />
                                <span className="searchable-dropdown-text">
                                    {selectedProducer ? selectedProducer.username : '-- Search Specific Producer --'}
                                </span>
                            </div>
                            <ChevronDown size={16} className={`searchable-dropdown-caret ${isDropdownOpen ? 'open' : ''}`} />
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
                                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>Team: {p.teamName}</div>
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

            {!selectedProducer ? (
                <div className="empty-producer-state">
                    <User size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
                    <h3>Select a Producer</h3>
                    <p>Use the dropdown above to view an individual producer's full production history and success rates.</p>
                </div>
            ) : (
                <div className="producer-content">
                    {producerData && (
                        <div className="producer-stats-banner">
                            <div className="producer-stat-block"><div className="stat-label">Team</div><div className="stat-primary-val">{producerData.teamName}</div></div>
                            <div className="producer-stat-block"><div className="stat-label">Total Volume</div><div className="stat-primary-val" style={{color: 'var(--primary)'}}>{formatDuration(producerData.stats.totalSec)}</div></div>
                            <div className="producer-stat-block"><div className="stat-label">Accepted</div><div className="stat-primary-val" style={{color: '#10b981'}}>{formatDuration(producerData.stats.acceptedSec)}</div></div>
                            <div className="producer-stat-block"><div className="stat-label">Rejected</div><div className="stat-primary-val" style={{color: '#ef4444'}}>{formatDuration(producerData.stats.rejectedSec)}</div></div>
                            <div className="producer-stat-block"><div className="stat-label">Pending</div><div className="stat-primary-val" style={{color: '#f59e0b'}}>{formatDuration(producerData.stats.waitingSec)}</div></div>
                        </div>
                    )}

                    <div className={`pd-table-wrapper ${isFetchingProducer ? 'pd-is-fetching' : ''}`}>
                        <table className="pd-table">
                            <thead>
                                <tr>
                                    <th>Task ID & Name</th>
                                    <th className="pd-text-center">Total Volume</th>
                                    <th className="pd-text-center pd-th-success">Passed</th>
                                    <th className="pd-text-center pd-th-danger">Failed</th>
                                    <th className="pd-text-center pd-th-warning">Waiting</th>
                                </tr>
                            </thead>
                            <tbody>
                                {producerData?.tasks?.map(task => {
                                    const totalSec = Number(task.totalSec) || 0;
                                    const safePassedSec = Number(task.passedSec) || Number(task.acceptedSec) || 0;
                                    const safeFailedSec = Number(task.failedSec) || Number(task.rejectedSec) || 0;
                                    const safeWaitingSec = Number(task.waitingSec) || 0;

                                    const safeTotalVideos = Number(task.totalVideos) || 0;
                                    const safePassedVideos = Number(task.passedVideos) || Number(task.acceptedVideos) || 0;
                                    const safeFailedVideos = Number(task.failedVideos) || Number(task.rejectedVideos) || 0;
                                    const safeWaitingVideos = Number(task.waitingVideos) || 0;

                                    const passedPct = totalSec > 0 ? Math.round((safePassedSec / totalSec) * 100) : 0;
                                    const failedPct = totalSec > 0 ? Math.round((safeFailedSec / totalSec) * 100) : 0;
                                    const waitingPct = totalSec > 0 ? Math.round((safeWaitingSec / totalSec) * 100) : 0;

                                    return (
                                        <tr key={task._id}>
                                            <td>
                                                <div className="pd-table-val">{task._id || 'Unknown'}</div>
                                                <div className="pd-table-subtext">{task.taskName}</div>
                                            </td>
                                            <td className="pd-text-center">
                                                <div className="pd-table-val">{formatDuration(totalSec)}</div>
                                                <div className="pd-table-subtext">{safeTotalVideos} clips</div>
                                            </td>
                                            <td className="pd-text-center">
                                                <div className="pd-table-val-success">{formatDuration(safePassedSec)}</div>
                                                <div className="pd-table-subtext">{safePassedVideos} clips ({passedPct}%)</div>
                                            </td>
                                            <td className="pd-text-center">
                                                <div className="pd-table-val-danger">{formatDuration(safeFailedSec)}</div>
                                                <div className="pd-table-subtext">{safeFailedVideos} clips ({failedPct}%)</div>
                                            </td>
                                            <td className="pd-text-center">
                                                <div className="pd-table-val-warning">{formatDuration(safeWaitingSec)}</div>
                                                <div className="pd-table-subtext">{safeWaitingVideos} clips ({waitingPct}%)</div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}