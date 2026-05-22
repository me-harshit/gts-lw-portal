import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { Filter, Calendar, User, Search, ChevronDown, Activity, Trophy, Loader2 } from 'lucide-react';
import { formatDuration } from '../utils/timeFormat';
import './QcLeaderboard.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// --- CUSTOM DROPDOWN (Reused from your Dashboard) ---
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

export default function QcLeaderboard() {
    const [teamCategory, setTeamCategory] = useState('ALL');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [activeGlobalFilter, setActiveGlobalFilter] = useState('allTime');
    const [searchQuery, setSearchQuery] = useState('');
    const [teams, setTeams] = useState([]);
    const [teamMappings, setTeamMappings] = useState([]);

    // --- QUICK FILTER LOGIC ---
    const applyQuickFilter = (type, setStart, setEnd, setActiveBtn) => {
        setActiveBtn(type);
        const today = new Date();
        const formatDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

        if (type === 'today') { setStart(formatDate(today)); setEnd(formatDate(today)); }
        else if (type === 'yesterday') { const y = new Date(today); y.setDate(y.getDate() - 1); setStart(formatDate(y)); setEnd(formatDate(y)); }
        else if (type === 'thisWeek') { const m = new Date(today); m.setDate(m.getDate() - (m.getDay() || 7) + 1); setStart(formatDate(m)); setEnd(formatDate(today)); }
        else if (type === 'thisMonth') { setStart(formatDate(new Date(today.getFullYear(), today.getMonth(), 1))); setEnd(formatDate(today)); }
        else { setStart(''); setEnd(''); }
    };

    const handleDateChange = (setter, value) => { setActiveGlobalFilter(''); setter(value); };

    useEffect(() => {
        const fetchTeams = async () => {
            try {
                const res = await axios.get(`${API_URL}/api/teams`);
                setTeamMappings(res.data);
                const uniqueTeams = Array.from(new Set(res.data.map(m => m.teamName)));
                setTeams(uniqueTeams);
            } catch (error) {
                console.error("Failed to fetch teams", error);
            }
        };
        fetchTeams();
    }, []);

    const { data: rawLeaderboard, isFetching } = useQuery({
        queryKey: ['qcLeaderboard', startDate, endDate],
        queryFn: async () => {
            let url = `${API_URL}/api/leaderboards/qc?`;
            if (startDate) url += `startDate=${startDate}&`;
            if (endDate) url += `endDate=${endDate}`;
            const res = await axios.get(url);
            return res.data;
        },
        placeholderData: (prev) => prev,
        refetchOnWindowFocus: false
    });

    const getRankColor = (rate) => {
        const r = parseFloat(rate);
        if (r >= 90) return { label: 'Excellent', color: '#10b981' };
        if (r >= 80) return { label: 'Good', color: '#3b82f6' };
        if (r >= 70) return { label: 'Satisfactory', color: '#f59e0b' };
        if (r >= 50) return { label: 'Critical', color: '#f59e0b' };
        return { label: 'Risk', color: '#ef4444' };
    };

    // 1. Calculate ranks based on the WHOLE data set first
    const rankedData = (rawLeaderboard || [])
        .map(producer => {
            const teamInfo = teamMappings.find(t => t.username === producer.username);
            return { ...producer, teamName: teamInfo ? teamInfo.teamName : 'Unknown' };
        })
        .sort((a, b) => {
            const rateDiff = parseFloat(b.passRate) - parseFloat(a.passRate);
            if (rateDiff !== 0) return rateDiff;
            return b.totalDuration - a.totalDuration; // Secondary sort
        });

    // 2. Now filter that ranked data
    const filteredLeaderboard = rankedData.filter(p => {
        const matchesTeam = teamCategory === 'ALL' || p.teamName === teamCategory;
        const matchesSearch = p.username.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesTeam && matchesSearch;
    });

    return (
        <div className="dashboard-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <h2 className="dashboard-header" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                        <Trophy color="var(--primary)" size={24} />
                        QC Leaderboard
                    </h2>
                    <div className="quick-filters-container">
                        <button className={`quick-filter-btn ${activeGlobalFilter === 'allTime' ? 'active' : ''}`} onClick={() => applyQuickFilter('allTime', setStartDate, setEndDate, setActiveGlobalFilter)}>All Time</button>
                        <button className={`quick-filter-btn ${activeGlobalFilter === 'today' ? 'active' : ''}`} onClick={() => applyQuickFilter('today', setStartDate, setEndDate, setActiveGlobalFilter)}>Today</button>
                        <button className={`quick-filter-btn ${activeGlobalFilter === 'yesterday' ? 'active' : ''}`} onClick={() => applyQuickFilter('yesterday', setStartDate, setEndDate, setActiveGlobalFilter)}>Yesterday</button>
                        <button className={`quick-filter-btn ${activeGlobalFilter === 'thisWeek' ? 'active' : ''}`} onClick={() => applyQuickFilter('thisWeek', setStartDate, setEndDate, setActiveGlobalFilter)}>This Week</button>
                        <button className={`quick-filter-btn ${activeGlobalFilter === 'thisMonth' ? 'active' : ''}`} onClick={() => applyQuickFilter('thisMonth', setStartDate, setEndDate, setActiveGlobalFilter)}>This Month</button>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <div className="searchable-dropdown-header" style={{ cursor: 'default', height: '40px' }}>
                        <Calendar size={16} color="var(--text-muted)" />
                        <input type="date" value={startDate} onChange={(e) => handleDateChange(setStartDate, e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none', paddingLeft: '8px' }} />
                        <span style={{ color: 'var(--text-muted)', margin: '0 8px' }}>to</span>
                        <input type="date" value={endDate} onChange={(e) => handleDateChange(setEndDate, e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none' }} />
                    </div>

                    <CustomSelect icon={User} value={teamCategory} onChange={setTeamCategory} options={[{ value: 'ALL', label: 'All Teams' }, ...teams.map(t => ({ value: t, label: t }))]} />

                    <div className="qc-filter-wrapper search-wrapper">
                        <Search size={16} color="var(--text-muted)" />
                        <input type="text" placeholder="Search producer..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="table-search-input" />
                    </div>
                </div>
            </div>

            <div className="leaderboard-table-container" style={{ opacity: isFetching ? 0.6 : 1, transition: 'opacity 0.2s' }}>
                <table className="leaderboard-table">
                    <thead>
                        <tr>
                            <th>Rank</th>
                            <th>Producer</th>
                            <th>Total Volume</th>
                            <th>QC Done</th>
                            <th>Accepted</th>
                            <th>Rejected</th>
                            <th>Waiting</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredLeaderboard.length > 0 ? (
                            filteredLeaderboard.map((producer) => {
                                // Find the permanent rank from the full ranked list
                                const originalRank = rankedData.findIndex(p => p.username === producer.username) + 1;
                                const rankInfo = getRankColor(producer.passRate);

                                return (
                                    <tr key={producer.username}>
                                        {/* RANK */}
                                        <td>
                                            <span className={`rank-badge rank-${originalRank}`}>{originalRank}</span>
                                        </td>

                                        {/* PRODUCER INFO */}
                                        <td>
                                            <div className="producer-name">{producer.username}</div>
                                            <div className="producer-team">{producer.teamName}</div>
                                        </td>

                                        {/* TOTAL VOLUME */}
                                        <td>
                                            <div className="stat-primary">{producer.totalVideos.toLocaleString()}</div>
                                            <div className="stat-secondary">{formatDuration(producer.totalDuration)}</div>
                                        </td>

                                        {/* QC DONE */}
                                        <td>
                                            <div className="stat-primary" style={{ color: '#3b82f6' }}>{producer.checkedVideos.toLocaleString()}</div>
                                            <div className="stat-secondary">{formatDuration(producer.checkedDuration)}</div>
                                        </td>

                                        {/* ACCEPTED (PRIMARY METRIC) */}
                                        <td>
                                            <div style={{ fontSize: '16px', fontWeight: '800', color: rankInfo.color }}>
                                                {producer.passRate}%
                                            </div>
                                            {/* <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>
                                                {rankInfo.label}
                                            </div> */}
                                            <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--text-main)', fontWeight: '600' }}>
                                                {producer.passedVideos.toLocaleString()} vids
                                            </div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                {formatDuration(producer.passedDuration)}
                                            </div>
                                        </td>

                                        {/* REJECTED */}
                                        <td>
                                            <div style={{ fontSize: '16px', fontWeight: '700', color: '#ef4444' }}>{producer.failRate}%</div>
                                            <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--text-main)', fontWeight: '600' }}>
                                                {producer.failedVideos.toLocaleString()} vids
                                            </div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                {formatDuration(producer.failedDuration)}
                                            </div>
                                        </td>

                                        {/* WAITING */}
                                        <td>
                                            <div style={{ fontSize: '16px', fontWeight: '700', color: '#f59e0b' }}>{producer.waitRate}%</div>
                                            <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--text-main)', fontWeight: '600' }}>
                                                {producer.waitingVideos.toLocaleString()} vids
                                            </div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                {formatDuration(producer.waitingDuration)}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan="7" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    {isFetching ? <Loader2 className="spinning" style={{ margin: '0 auto' }} /> : 'No data found for this period.'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}