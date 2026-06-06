import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { Filter, Calendar, User, ListChecks, Search, ChevronDown, Loader2 } from 'lucide-react';
import { formatDuration } from '../utils/timeFormat';
import './TaskDashboard.css';
import './ProjectDashboard.css'; // Inherit layout styles

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
        <div className="dashboard-card" style={{ maxWidth: '1400px', margin: '0 auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '32px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <h2 className="dashboard-header" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, color: 'var(--primary)' }}>
                        <ListChecks size={28} /> Producer Analytics
                    </h2>
                    <div className="quick-filters-container" style={{ margin: 0 }}>
                        <button className={`quick-filter-btn ${activeProdFilter === 'allTime' ? 'active' : ''}`} onClick={() => applyQuickFilter('allTime')}>All Time</button>
                        <button className={`quick-filter-btn ${activeProdFilter === 'today' ? 'active' : ''}`} onClick={() => applyQuickFilter('today')}>Today</button>
                        <button className={`quick-filter-btn ${activeProdFilter === 'yesterday' ? 'active' : ''}`} onClick={() => applyQuickFilter('yesterday')}>Yesterday</button>
                        <button className={`quick-filter-btn ${activeProdFilter === 'thisWeek' ? 'active' : ''}`} onClick={() => applyQuickFilter('thisWeek')}>This Week</button>
                        <button className={`quick-filter-btn ${activeProdFilter === 'thisMonth' ? 'active' : ''}`} onClick={() => applyQuickFilter('thisMonth')}>This Month</button>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
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
                        <input type="date" value={prodStartDate} onChange={(e) => handleDateChange(e.target.value, true)} style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none', paddingLeft: '8px' }} />
                        <span style={{ color: 'var(--text-muted)', margin: '0 8px' }}>to</span>
                        <input type="date" value={prodEndDate} onChange={(e) => handleDateChange(e.target.value, false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none' }} />
                    </div>

                    <div className="searchable-dropdown-container" style={{ width: '100%', maxWidth: '350px' }} ref={dropdownRef}>
                        <div className="searchable-dropdown-header" onClick={() => setIsDropdownOpen(!isDropdownOpen)} style={{ height: '40px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                                <User size={16} color="var(--text-muted)" style={{ flexShrink: 0 }}/>
                                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {selectedProducer ? selectedProducer.username : '-- Search Specific Producer --'}
                                </span>
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
                <div style={{ padding: '60px', textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: '12px', background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                    <User size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
                    <h3 style={{ margin: 0, color: 'var(--text-main)' }}>Select a Producer</h3>
                    <p style={{ margin: '8px 0 0 0', fontSize: '14px' }}>Use the dropdown above to view an individual producer's full production history and success rates.</p>
                </div>
            ) : (
                <div style={{ opacity: isFetchingProducer ? 0.6 : 1, transition: 'opacity 0.2s' }}>
                    {producerData && (
                        <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
                            {(() => {
                                const totalVids = producerData.tasks?.reduce((acc, t) => acc + t.totalVideos, 0) || 0;
                                const passedVids = producerData.tasks?.reduce((acc, t) => acc + (t.passedVideos || t.acceptedVideos || 0), 0) || 0;
                                const failedVids = producerData.tasks?.reduce((acc, t) => acc + (t.failedVideos || t.rejectedVideos || 0), 0) || 0;
                                const waitingVids = producerData.tasks?.reduce((acc, t) => acc + (t.waitingVideos || 0), 0) || 0;

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
                                        const safePassedSec = task.passedSec || task.acceptedSec || 0;
                                        const safeFailedSec = task.failedSec || task.rejectedSec || 0;
                                        const safeWaitingSec = task.waitingSec || 0;
                                        const totalSec = task.totalSec || 1; 

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