import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { Filter, Calendar, Loader2, Trophy, ChevronDown, Tag as TagIcon, Clock, Users } from 'lucide-react';
import { formatDuration } from '../utils/timeFormat';
import './TaskDashboard.css'; 
import './AcceptanceLeaderboard.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// --- CUSTOM DROPDOWN COMPONENT ---
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

export default function AcceptanceLeaderboard() {
    // Filter State
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [activeFilterBtn, setActiveFilterBtn] = useState('thisMonth');
    
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

        if (type === 'today') {
            setStartDate(formatDate(today)); setEndDate(formatDate(today));
        } else if (type === 'yesterday') {
            const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
            setStartDate(formatDate(yesterday)); setEndDate(formatDate(yesterday));
        } else if (type === 'thisWeek') {
            const monday = new Date(today); const day = monday.getDay() || 7; monday.setDate(monday.getDate() - (day - 1));
            setStartDate(formatDate(monday)); setEndDate(formatDate(today));
        } else if (type === 'thisMonth') {
            const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
            setStartDate(formatDate(firstDay)); setEndDate(formatDate(today));
        } else if (type === 'allTime') {
            setStartDate(''); setEndDate('');
        }
    };

    const handleManualDateChange = (setter, value) => {
        setActiveFilterBtn(''); setter(value);
    };

    const { data: queryResult, isFetching } = useQuery({
        queryKey: ['acceptanceLeaderboard', activeTag, activeShift, teamCategory, startDate, endDate, teamConfigs.length],
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

            let url = `${API_URL}/api/leaderboards/acceptance?teams=${teamQuery}`;
            if (startDate && endDate) url += `&startDate=${startDate}&endDate=${endDate}`;
            
            const res = await axios.get(url);
            return res.data;
        },
        placeholderData: (previousData) => previousData,
        refetchOnWindowFocus: false,
        enabled: teamConfigs.length > 0 // Wait for metadata to load first
    });

    const rawLeaderboard = queryResult || [];

    // Enrich the leaderboard data with Team, Tag, and Shift info
    const leaderboard = rawLeaderboard.map(row => {
        const mapping = userMappings.find(m => m.username === row.producer);
        const teamName = mapping ? mapping.teamName : 'Unassigned';
        const config = teamConfigs.find(c => c.name === teamName);
        return {
            ...row,
            teamName,
            tag: config ? config.tag : 'N/A',
            shift: config ? config.timingSlot : 'N/A'
        };
    });

    const totals = leaderboard.reduce((acc, curr) => ({
        accepted: acc.accepted + (curr.acceptedSec || 0),
        rejected: acc.rejected + (curr.rejectedSec || 0),
        waiting: acc.waiting + (curr.waitingSec || 0),
    }), { accepted: 0, rejected: 0, waiting: 0 });

    return (
        <div className="dashboard-card" style={{ maxWidth: '1400px', margin: '0 auto' }}>
            
            {/* ============================== */}
            {/* HEADER & NEW CLEAN ROW LAYOUT */}
            {/* ============================== */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px' }}>
                
                {/* Title & Quick Filters */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <h2 className="dashboard-header" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                        <Trophy color="var(--primary)" size={24} />
                        Acceptance Leaderboard
                    </h2>
                    <div className="quick-filters-container">
                        <button className={`quick-filter-btn ${activeFilterBtn === 'allTime' ? 'active' : ''}`} onClick={() => applyQuickFilter('allTime')}>All Time</button>
                        <button className={`quick-filter-btn ${activeFilterBtn === 'today' ? 'active' : ''}`} onClick={() => applyQuickFilter('today')}>Today</button>
                        <button className={`quick-filter-btn ${activeFilterBtn === 'yesterday' ? 'active' : ''}`} onClick={() => applyQuickFilter('yesterday')}>Yesterday</button>
                        <button className={`quick-filter-btn ${activeFilterBtn === 'thisWeek' ? 'active' : ''}`} onClick={() => applyQuickFilter('thisWeek')}>This Week</button>
                        <button className={`quick-filter-btn ${activeFilterBtn === 'thisMonth' ? 'active' : ''}`} onClick={() => applyQuickFilter('thisMonth')}>This Month</button>
                    </div>
                </div>

                {/* Dropdowns & Date Picker */}
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
                        <input 
                            type="date" 
                            value={startDate} 
                            onChange={(e) => handleManualDateChange(setStartDate, e.target.value)}
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none' }}
                        />
                        <span style={{ color: 'var(--text-muted)' }}>to</span>
                        <input 
                            type="date" 
                            value={endDate} 
                            onChange={(e) => handleManualDateChange(setEndDate, e.target.value)}
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none' }}
                        />
                    </div>
                </div>
            </div>

            {/* --- SUMMARY CARDS --- */}
            <div className="summary-cards" style={{ opacity: isFetching ? 0.6 : 1, transition: 'opacity 0.2s', marginBottom: '40px' }}>
                <div className="summary-card">
                    <span className="card-title">Total Accepted</span>
                    <span className="card-value" style={{ color: '#10b981', marginTop: '8px' }}>
                        {leaderboard.length > 0 ? formatDuration(totals.accepted) : '-'}
                    </span>
                </div>
                <div className="summary-card">
                    <span className="card-title">Total Rejected</span>
                    <span className="card-value" style={{ color: '#ef4444', marginTop: '8px' }}>
                        {leaderboard.length > 0 ? formatDuration(totals.rejected) : '-'}
                    </span>
                </div>
                <div className="summary-card">
                    <span className="card-title">Total Waiting</span>
                    <span className="card-value" style={{ color: '#f59e0b', marginTop: '8px' }}>
                        {leaderboard.length > 0 ? formatDuration(totals.waiting) : '-'}
                    </span>
                </div>
                <div className="summary-card">
                    <span className="card-title">Total Pipeline</span>
                    <span className="card-value" style={{ color: 'var(--primary)', marginTop: '8px' }}>
                        {leaderboard.length > 0 ? formatDuration(totals.accepted + totals.rejected + totals.waiting) : '-'}
                    </span>
                </div>
            </div>

            <div className="leaderboard-container" style={{ opacity: isFetching ? 0.6 : 1, transition: 'opacity 0.2s' }}>
                <table className="leaderboard-table">
                    <thead>
                        <tr>
                            <th style={{ width: '80px', textAlign: 'center' }}>Rank</th>
                            <th>Producer</th>
                            <th>Team Details</th>
                            <th>Accepted Time</th>
                            <th>Rejected Time</th>
                            <th>Waiting Time</th>
                        </tr>
                    </thead>
                    <tbody>
                        {leaderboard.length > 0 ? (
                            leaderboard.map((row, index) => {
                                let badgeClass = "rank-other";
                                if (index === 0) badgeClass = "rank-1";
                                else if (index === 1) badgeClass = "rank-2";
                                else if (index === 2) badgeClass = "rank-3";

                                return (
                                    <tr key={row.producer}>
                                        <td style={{ textAlign: 'center' }}>
                                            <span className={`rank-badge ${badgeClass}`}>
                                                {index < 3 ? index + 1 : `#${index + 1}`}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px 16px', fontWeight: '600', color: 'var(--text-main)' }}>
                                            {row.producer}
                                        </td>
                                        
                                        {/* --- NEW DETAILS COLUMN --- */}
                                        <td style={{ padding: '12px 16px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-main)' }}>{row.teamName}</span>
                                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                    {row.tag !== 'N/A' && (
                                                        <span style={{ fontSize: '10px', background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.3)', padding: '2px 6px', borderRadius: '4px', color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                            <TagIcon size={10} /> {row.tag}
                                                        </span>
                                                    )}
                                                    {row.shift !== 'N/A' && (
                                                        <span style={{ fontSize: '10px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '2px 6px', borderRadius: '4px', color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                            <Clock size={10} /> {row.shift}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        <td style={{ color: '#10b981', fontWeight: '600' }}>
                                            {formatDuration(row.acceptedSec)}
                                        </td>
                                        <td style={{ color: '#ef4444' }}>
                                            {formatDuration(row.rejectedSec)}
                                        </td>
                                        <td style={{ color: '#f59e0b' }}>
                                            {formatDuration(row.waitingSec)}
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    {isFetching ? <Loader2 className="spinning" style={{ margin: '0 auto' }} /> : 'No data found for this range/team.'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}