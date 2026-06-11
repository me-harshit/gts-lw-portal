import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { Filter, Calendar, User, Search, ChevronDown, Trophy, Loader2, Tag as TagIcon, Clock, Users } from 'lucide-react';
import { formatDuration } from '../utils/timeFormat';
import './QcLeaderboard.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// --- FIXED CUSTOM SELECT COMPONENT ---
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
        <div className="searchable-dropdown-container" style={containerStyle || { width: '200px' }} ref={dropdownRef}>
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

export default function QcLeaderboard() {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [activeFilterBtn, setActiveFilterBtn] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    
    // Metadata Filters
    const [activeTag, setActiveTag] = useState('ALL');
    const [activeShift, setActiveShift] = useState('ALL');
    const [teamCategory, setTeamCategory] = useState('ALL');

    // Metadata Data
    const [tags, setTags] = useState([]);
    const [shifts, setShifts] = useState([]);
    const [teams, setTeams] = useState([]);
    const [teamConfigs, setTeamConfigs] = useState([]);
    const [userMappings, setUserMappings] = useState([]);

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

    // --- QUICK FILTER LOGIC ---
    const applyQuickFilter = (type) => {
        setActiveFilterBtn(type);
        const today = new Date();
        const formatDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

        if (type === 'today') { setStartDate(formatDate(today)); setEndDate(formatDate(today)); }
        else if (type === 'yesterday') { const y = new Date(today); y.setDate(y.getDate() - 1); setStartDate(formatDate(y)); setEndDate(formatDate(y)); }
        else if (type === 'thisWeek') { const m = new Date(today); m.setDate(m.getDate() - (m.getDay() || 7) + 1); setStartDate(formatDate(m)); setEndDate(formatDate(today)); }
        else if (type === 'thisMonth') { setStartDate(formatDate(new Date(today.getFullYear(), today.getMonth(), 1))); setEndDate(formatDate(today)); }
        else { setStartDate(''); setEndDate(''); }
    };

    const handleManualDateChange = (setter, value) => { setActiveFilterBtn(''); setter(value); };

    const { data: queryResult, isFetching } = useQuery({
        queryKey: ['qcLeaderboard', activeTag, activeShift, teamCategory, startDate, endDate, teamConfigs.length],
        queryFn: async () => {
            // Smart Team Filtering
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

            let url = `${API_URL}/api/leaderboards/qc?teams=${teamQuery}`;
            if (startDate) url += `&startDate=${startDate}`;
            if (endDate) url += `&endDate=${endDate}`;
            
            const res = await axios.get(url);
            return res.data;
        },
        placeholderData: (prev) => prev,
        refetchOnWindowFocus: false,
        enabled: teamConfigs.length > 0
    });

    const getRankColor = (rate) => {
        const r = parseFloat(rate);
        if (r >= 90) return { label: 'Excellent', color: '#10b981' };
        if (r >= 80) return { label: 'Good', color: '#3b82f6' };
        if (r >= 70) return { label: 'Satisfactory', color: '#f59e0b' };
        if (r >= 50) return { label: 'Critical', color: '#f59e0b' };
        return { label: 'Risk', color: '#ef4444' };
    };

    // 1. Calculate ranks, inject Metadata Badges, and sort
    const rankedData = (queryResult || [])
        .map(producer => {
            const mapping = userMappings.find(t => t.username === producer.username);
            const teamName = mapping && mapping.teamName !== 'Unassigned' ? mapping.teamName : 'Unassigned';
            const config = teamConfigs.find(c => c.name === teamName);

            return { 
                ...producer, 
                teamName,
                tag: config ? config.tag : 'N/A',
                shift: config ? config.timingSlot : 'N/A'
            };
        })
        .sort((a, b) => {
            const rateDiff = parseFloat(b.passRate) - parseFloat(a.passRate);
            if (rateDiff !== 0) return rateDiff;
            return b.totalDuration - a.totalDuration; 
        });

    // 2. Client-side Search filter
    const filteredLeaderboard = rankedData.filter(p => {
        return p.username.toLowerCase().includes(searchQuery.toLowerCase());
    });

    return (
        <div className="dashboard-card" style={{ maxWidth: '1400px', margin: '0 auto' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px' }}>
                
                {/* ROW 1: Title & Quick Filters */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <h2 className="dashboard-header" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                        <Trophy color="var(--primary)" size={24} />
                        QC Leaderboard
                    </h2>
                    <div className="quick-filters-container">
                        <button className={`quick-filter-btn ${activeFilterBtn === 'allTime' ? 'active' : ''}`} onClick={() => applyQuickFilter('allTime')}>All Time</button>
                        <button className={`quick-filter-btn ${activeFilterBtn === 'today' ? 'active' : ''}`} onClick={() => applyQuickFilter('today')}>Today</button>
                        <button className={`quick-filter-btn ${activeFilterBtn === 'yesterday' ? 'active' : ''}`} onClick={() => applyQuickFilter('yesterday')}>Yesterday</button>
                        <button className={`quick-filter-btn ${activeFilterBtn === 'thisWeek' ? 'active' : ''}`} onClick={() => applyQuickFilter('thisWeek')}>This Week</button>
                        <button className={`quick-filter-btn ${activeFilterBtn === 'thisMonth' ? 'active' : ''}`} onClick={() => applyQuickFilter('thisMonth')}>This Month</button>
                    </div>
                </div>

                {/* ROW 2: Metadata Dropdowns & Dates */}
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end' }}>
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

                    <div className="qc-filter-wrapper" style={{ height: '40px' }}>
                        <Calendar size={16} color="var(--text-muted)" />
                        <input type="date" value={startDate} onChange={(e) => handleManualDateChange(setStartDate, e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none' }} />
                        <span style={{ color: 'var(--text-muted)' }}>to</span>
                        <input type="date" value={endDate} onChange={(e) => handleManualDateChange(setEndDate, e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none' }} />
                    </div>
                </div>

                {/* ROW 3: Search Bar */}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <div className="qc-filter-wrapper search-wrapper" style={{ height: '40px', width: '100%', maxWidth: '400px' }}>
                        <Search size={16} color="var(--text-muted)" />
                        <input type="text" placeholder="Search producer..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none', fontSize: '13px', width: '100%' }} />
                    </div>
                </div>
            </div>

            <div className="leaderboard-table-container" style={{ opacity: isFetching ? 0.6 : 1, transition: 'opacity 0.2s' }}>
                <table className="leaderboard-table">
                    <thead>
                        <tr>
                            <th>Rank</th>
                            <th>Producer</th>
                            <th>Team Details</th>
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
                                const originalRank = rankedData.findIndex(p => p.username === producer.username) + 1;
                                const rankInfo = getRankColor(producer.passRate);

                                return (
                                    <tr key={producer.username}>
                                        <td>
                                            <span className={`rank-badge rank-${originalRank}`}>{originalRank}</span>
                                        </td>
                                        
                                        <td>
                                            <div className="producer-name">{producer.username}</div>
                                        </td>

                                        {/* --- NEW DETAILS COLUMN --- */}
                                        <td style={{ padding: '12px 16px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-main)' }}>{producer.teamName}</span>
                                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                    {producer.tag !== 'N/A' && (
                                                        <span style={{ fontSize: '10px', background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.3)', padding: '2px 6px', borderRadius: '4px', color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                            <TagIcon size={10} /> {producer.tag}
                                                        </span>
                                                    )}
                                                    {producer.shift !== 'N/A' && (
                                                        <span style={{ fontSize: '10px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '2px 6px', borderRadius: '4px', color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                            <Clock size={10} /> {producer.shift}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        <td>
                                            <div className="stat-primary">{producer.totalVideos.toLocaleString()}</div>
                                            <div className="stat-secondary">{formatDuration(producer.totalDuration)}</div>
                                        </td>

                                        <td>
                                            <div className="stat-primary" style={{ color: '#3b82f6' }}>{producer.checkedVideos.toLocaleString()}</div>
                                            <div className="stat-secondary">{formatDuration(producer.checkedDuration)}</div>
                                        </td>

                                        <td>
                                            <div style={{ fontSize: '16px', fontWeight: '800', color: rankInfo.color }}>
                                                {producer.passRate}%
                                            </div>
                                            <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--text-main)', fontWeight: '600' }}>
                                                {producer.passedVideos.toLocaleString()} vids
                                            </div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                {formatDuration(producer.passedDuration)}
                                            </div>
                                        </td>

                                        <td>
                                            <div style={{ fontSize: '16px', fontWeight: '700', color: '#ef4444' }}>{producer.failRate}%</div>
                                            <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--text-main)', fontWeight: '600' }}>
                                                {producer.failedVideos.toLocaleString()} vids
                                            </div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                {formatDuration(producer.failedDuration)}
                                            </div>
                                        </td>

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
                                <td colSpan="8" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    {isFetching ? <Loader2 className="spinning" style={{ margin: '0 auto' }} /> : 'No data found.'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}