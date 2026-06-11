import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { Filter, Calendar, Loader2, Zap, Download, ChevronDown, Tag as TagIcon, Clock, Users } from 'lucide-react';
import { formatDuration } from '../utils/timeFormat';
import { generateLeaderboardPDF } from '../utils/pdfExport';
import './TaskDashboard.css';
import './PerformanceLeaderboard.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const getTier = (avgSec) => {
    if (!avgSec) return { label: 'No Data', color: 'var(--text-muted)', bg: 'var(--bg-secondary)' };
    if (avgSec >= 9000) return { label: 'Top Tier', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' };
    if (avgSec >= 7200) return { label: 'Mid-High', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' };
    if (avgSec >= 6300) return { label: 'Mid-Low', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' };
    return { label: 'Low', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' };
};

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

export default function PerformanceLeaderboard() {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [activeFilterBtn, setActiveFilterBtn] = useState('');
    const [isExporting, setIsExporting] = useState(false);
    
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

    const applyQuickFilter = (type) => {
        setActiveFilterBtn(type);
        const today = new Date();

        const formatDate = (date) => {
            const yyyy = date.getFullYear();
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const dd = String(date.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
        };

        if (type === 'today') {
            setStartDate(formatDate(today)); setEndDate(formatDate(today));
        } else if (type === 'yesterday') {
            const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
            setStartDate(formatDate(yesterday)); setEndDate(formatDate(yesterday));
        } else if (type === 'thisWeek') {
            const monday = new Date(today); const day = monday.getDay() || 7;
            monday.setDate(monday.getDate() - (day - 1));
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

    const { data: filteredResult, isFetching: isFetchingFiltered } = useQuery({
        queryKey: ['perfFiltered', activeTag, activeShift, teamCategory, startDate, endDate, teamConfigs.length],
        queryFn: async () => {
            let url = `${API_URL}/api/leaderboards/performance?teams=${teamQuery}`;
            if (startDate && endDate) {
                url += `&startDate=${startDate}&endDate=${endDate}`;
            }
            const res = await axios.get(url);
            return res.data;
        },
        placeholderData: (previousData) => previousData,
        refetchOnWindowFocus: false,
        enabled: teamConfigs.length > 0 
    });

    const { data: allTimeResult, isFetching: isFetchingAllTime } = useQuery({
        queryKey: ['perfAllTime', activeTag, activeShift, teamCategory, teamConfigs.length],
        queryFn: async () => {
            const url = `${API_URL}/api/leaderboards/performance?teams=${teamQuery}`;
            const res = await axios.get(url);
            return res.data;
        },
        placeholderData: (previousData) => previousData,
        refetchOnWindowFocus: false,
        enabled: teamConfigs.length > 0 
    });

    const isFetching = isFetchingFiltered || isFetchingAllTime;
    const filteredRaw = filteredResult || [];
    const allTimeRaw = allTimeResult || [];

    const leaderboard = filteredRaw.map(row => {
        const allTimeMatch = allTimeRaw.find(a => a.producer === row.producer);
        const mapping = userMappings.find(m => m.username === row.producer);
        const teamName = mapping && mapping.teamName !== 'Unassigned' ? mapping.teamName : 'Unassigned';
        const config = teamConfigs.find(c => c.name === teamName);

        return {
            ...row,
            teamName,
            tag: config ? config.tag : 'N/A',
            shift: config ? config.timingSlot : 'N/A',
            dailyAverageSec: allTimeMatch ? allTimeMatch.dailyAverageSec : row.dailyAverageSec
        };
    }).sort((a, b) => b.dailyAverageSec - a.dailyAverageSec);

    const totalHoursSec = leaderboard.reduce((acc, curr) => acc + (curr.totalSec || 0), 0);
    const teamAvgSec = leaderboard.length ? leaderboard.reduce((acc, curr) => acc + (curr.dailyAverageSec || 0), 0) / leaderboard.length : 0;
    const topPerformers = leaderboard.filter(p => p.dailyAverageSec >= 9000).length;
    const lowPerformers = leaderboard.filter(p => p.dailyAverageSec < 6300).length;

    const handleExportPDF = async () => {
        if (leaderboard.length === 0) return;
        setIsExporting(true);
        try {
            const mappedData = leaderboard.map(row => ({
                producer: row.producer,
                totalDuration: row.totalSec,
                dailyAverage: row.dailyAverageSec 
            }));

            const displayTeamName = teamCategory === 'ALL' ? 'Global (All Teams)' : teamCategory;
            await generateLeaderboardPDF(mappedData, startDate, endDate, displayTeamName);
        } catch (error) {
            console.error("Export failed", error);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="dashboard-card" style={{ maxWidth: '1400px', margin: '0 auto' }}>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                        <h2 className="dashboard-header" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                            <Zap color="#3b82f6" size={24} />
                            Performance Board
                        </h2>

                        <div className="quick-filters-container" style={{ margin: 0 }}>
                            <button className={`quick-filter-btn ${activeFilterBtn === 'allTime' ? 'active' : ''}`} onClick={() => applyQuickFilter('allTime')}>All Time</button>
                            <button className={`quick-filter-btn ${activeFilterBtn === 'today' ? 'active' : ''}`} onClick={() => applyQuickFilter('today')}>Today</button>
                            <button className={`quick-filter-btn ${activeFilterBtn === 'yesterday' ? 'active' : ''}`} onClick={() => applyQuickFilter('yesterday')}>Yesterday</button>
                            <button className={`quick-filter-btn ${activeFilterBtn === 'thisWeek' ? 'active' : ''}`} onClick={() => applyQuickFilter('thisWeek')}>This Week</button>
                            <button className={`quick-filter-btn ${activeFilterBtn === 'thisMonth' ? 'active' : ''}`} onClick={() => applyQuickFilter('thisMonth')}>This Month</button>
                        </div>
                    </div>

                    <button
                        onClick={handleExportPDF}
                        disabled={leaderboard.length === 0 || isExporting}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            backgroundColor: leaderboard.length === 0 ? 'var(--bg-secondary)' : 'var(--primary)',
                            color: leaderboard.length === 0 ? 'var(--text-muted)' : 'white',
                            border: leaderboard.length === 0 ? '1px solid var(--border-color)' : 'none',
                            padding: '0 16px', borderRadius: '8px', fontSize: '14px', fontWeight: '600',
                            cursor: leaderboard.length === 0 ? 'not-allowed' : 'pointer',
                            boxShadow: leaderboard.length === 0 ? 'none' : '0 2px 4px rgba(59, 130, 246, 0.3)',
                            transition: 'all 0.2s', height: '40px', flexShrink: 0
                        }}
                    >
                        <Download size={16} />
                        {isExporting ? 'Generating...' : 'Export PDF'}
                    </button>
                </div>

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
                            type="date" value={startDate} onChange={(e) => handleManualDateChange(setStartDate, e.target.value)}
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none' }}
                        />
                        <span style={{ color: 'var(--text-muted)' }}>to</span>
                        <input
                            type="date" value={endDate} onChange={(e) => handleManualDateChange(setEndDate, e.target.value)}
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none' }}
                        />
                    </div>
                </div>
            </div>

            <div className="summary-cards" style={{ opacity: isFetching ? 0.6 : 1, transition: 'opacity 0.2s', marginBottom: '40px' }}>
                <div className="summary-card">
                    <span className="card-title">Grand Total Hours</span>
                    <span className="card-value" style={{ color: 'var(--primary)', marginTop: '8px' }}>
                        {leaderboard.length > 0 ? formatDuration(totalHoursSec) : '-'}
                    </span>
                </div>
                <div className="summary-card">
                    <span className="card-title">Team Daily Average</span>
                    <span className="card-value" style={{ color: '#3b82f6', marginTop: '8px' }}>
                        {leaderboard.length > 0 ? formatDuration(teamAvgSec) : '-'}
                    </span>
                </div>
                <div className="summary-card">
                    <span className="card-title">Top Tier Producers</span>
                    <span className="card-value" style={{ color: '#10b981', marginTop: '8px' }}>
                        {leaderboard.length > 0 ? topPerformers : '-'}
                    </span>
                </div>
                <div className="summary-card">
                    <span className="card-title">Low Tier Attention</span>
                    <span className="card-value" style={{ color: '#ef4444', marginTop: '8px' }}>
                        {leaderboard.length > 0 ? lowPerformers : '-'}
                    </span>
                </div>
            </div>

            <div className="perf-leaderboard-container" style={{ opacity: isFetching ? 0.6 : 1, transition: 'opacity 0.2s' }}>
                <table className="perf-leaderboard-table">
                    <thead>
                        <tr>
                            <th style={{ width: '80px', textAlign: 'center' }}>Rank</th>
                            <th>Producer</th>
                            <th>Team Details</th>
                            <th>Total Production Time</th>
                            <th>Daily Average (All-Time)</th>
                            <th>Performance Category</th>
                        </tr>
                    </thead>
                    <tbody>
                        {leaderboard.length > 0 ? (
                            leaderboard.map((row, index) => {
                                const tier = getTier(row.dailyAverageSec);
                                return (
                                    <tr key={row.producer}>
                                        <td style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--text-muted)' }}>
                                            #{index + 1}
                                        </td>
                                        <td style={{ fontWeight: '600', color: 'var(--text-main)' }}>
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

                                        <td style={{ fontWeight: '600' }}>{formatDuration(row.totalSec)}</td>
                                        <td style={{ fontWeight: '600', color: 'var(--text-muted)' }}>{formatDuration(row.dailyAverageSec)}</td>
                                        <td>
                                            <span style={{
                                                backgroundColor: tier.bg,
                                                color: tier.color,
                                                padding: '4px 10px',
                                                borderRadius: '12px',
                                                fontSize: '12px',
                                                fontWeight: '700'
                                            }}>
                                                {tier.label}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
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