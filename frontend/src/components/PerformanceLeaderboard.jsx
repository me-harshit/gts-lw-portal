import { useState, useEffect } from 'react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { Filter, Calendar, Loader2, Zap, Download } from 'lucide-react';
import { formatDuration } from '../utils/timeFormat';
import { generateLeaderboardPDF } from '../utils/pdfExport'; // <-- IMPORT EXPORT UTILITY
import './TaskDashboard.css'; 
import './PerformanceLeaderboard.css'; 

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Tier Logic Helper
const getTier = (avgSec) => {
    if (!avgSec) return { label: 'No Data', color: 'var(--text-muted)', bg: 'var(--bg-secondary)' };
    if (avgSec >= 9000) return { label: 'Top Tier', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' }; 
    if (avgSec >= 7200) return { label: 'Mid-High', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' }; 
    if (avgSec >= 6300) return { label: 'Mid-Low', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' }; 
    return { label: 'Low', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' }; 
};

export default function PerformanceLeaderboard() {
    const [teamCategory, setTeamCategory] = useState('ALL');
    const [teams, setTeams] = useState([]);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [activeFilterBtn, setActiveFilterBtn] = useState('');

    useEffect(() => {
        const fetchTeams = async () => {
            try {
                const res = await axios.get(`${API_URL}/api/teams`);
                const uniqueTeams = new Set(res.data.map(m => m.teamName));
                setTeams(Array.from(uniqueTeams));
            } catch (error) {
                console.error("Failed to load teams", error);
            }
        };
        fetchTeams();
    }, []);

    // --- QUICK FILTER LOGIC ---
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

    const handleManualDateChange = (setter, value) => {
        setActiveFilterBtn('');
        setter(value);
    };

    const { data: queryResult, isFetching } = useQuery({
        queryKey: ['performanceLeaderboard', teamCategory, startDate, endDate],
        queryFn: async () => {
            let url = `${API_URL}/api/leaderboards/performance?teamName=${teamCategory}`;
            if (startDate && endDate) {
                url += `&startDate=${startDate}&endDate=${endDate}`;
            }
            const res = await axios.get(url);
            return res.data;
        },
        placeholderData: (previousData) => previousData,
        refetchOnWindowFocus: false
    });

    const leaderboardRaw = queryResult?.data || [];
    const leaderboard = [...leaderboardRaw].sort((a, b) => b.dailyAverageSec - a.dailyAverageSec);

    const totalHoursSec = leaderboard.reduce((acc, curr) => acc + (curr.totalSec || 0), 0) || 0;
    const teamAvgSec = leaderboard.length ? (totalHoursSec / leaderboard.length) : 0;
    const topPerformers = leaderboard.filter(p => p.dailyAverageSec >= 9000).length || 0;
    const lowPerformers = leaderboard.filter(p => p.dailyAverageSec < 6300).length || 0;

    // --- EXPORT HANDLER ---
    const handleExportPDF = () => {
        if (leaderboard.length === 0) return;
        
        // Map the data to ensure keys match exactly what pdfExport.js expects
        const mappedData = leaderboard.map(row => ({
            producer: row.producer,
            totalDuration: row.totalSec, 
            dailyAverage: row.dailyAverageSec
        }));

        const displayTeamName = teamCategory === 'ALL' ? 'GTS Inhouse (All Teams)' : teamCategory;
        generateLeaderboardPDF(mappedData, startDate, endDate, displayTeamName);
    };

    return (
        <div className="dashboard-card">
            
            {/* TOP HEADER & FILTERS */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <h2 className="dashboard-header" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                        <Zap color="#3b82f6" size={24} />
                        Performance Analytics
                    </h2>
                    
                    {/* QUICK FILTER PILLS */}
                    <div className="quick-filters-container">
                        <button className={`quick-filter-btn ${activeFilterBtn === 'allTime' ? 'active' : ''}`} onClick={() => applyQuickFilter('allTime')}>All Time</button>
                        <button className={`quick-filter-btn ${activeFilterBtn === 'today' ? 'active' : ''}`} onClick={() => applyQuickFilter('today')}>Today</button>
                        <button className={`quick-filter-btn ${activeFilterBtn === 'yesterday' ? 'active' : ''}`} onClick={() => applyQuickFilter('yesterday')}>Yesterday</button>
                        <button className={`quick-filter-btn ${activeFilterBtn === 'thisWeek' ? 'active' : ''}`} onClick={() => applyQuickFilter('thisWeek')}>This Week</button>
                        <button className={`quick-filter-btn ${activeFilterBtn === 'thisMonth' ? 'active' : ''}`} onClick={() => applyQuickFilter('thisMonth')}>This Month</button>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div className="qc-filter-wrapper">
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

                    <div className="qc-filter-wrapper">
                        <Filter size={16} color="var(--text-muted)" />
                        <select
                            value={teamCategory} onChange={(e) => setTeamCategory(e.target.value)}
                            className="qc-filter-select"
                        >
                            <option value="ALL">All Teams</option>
                            {teams.map(team => <option key={team} value={team}>{team}</option>)}
                        </select>
                    </div>

                    {/* --- NEW PDF EXPORT BUTTON --- */}
                    <button 
                        onClick={handleExportPDF}
                        disabled={leaderboard.length === 0}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            backgroundColor: leaderboard.length === 0 ? 'var(--bg-secondary)' : 'var(--primary)',
                            color: leaderboard.length === 0 ? 'var(--text-muted)' : 'white',
                            border: leaderboard.length === 0 ? '1px solid var(--border-color)' : 'none',
                            padding: '0 16px',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: leaderboard.length === 0 ? 'not-allowed' : 'pointer',
                            boxShadow: leaderboard.length === 0 ? 'none' : '0 2px 4px rgba(59, 130, 246, 0.3)',
                            transition: 'all 0.2s',
                            height: '40px', 
                        }}
                        onMouseEnter={(e) => { if(leaderboard.length > 0) e.currentTarget.style.backgroundColor = '#2563eb' }}
                        onMouseLeave={(e) => { if(leaderboard.length > 0) e.currentTarget.style.backgroundColor = 'var(--primary)' }}
                    >
                        <Download size={16} />
                        Export PDF
                    </button>
                </div>
            </div>

            {/* PERFORMANCE SUMMARY CARDS */}
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

            {/* TABLE */}
            <div className="perf-leaderboard-container" style={{ opacity: isFetching ? 0.6 : 1, transition: 'opacity 0.2s' }}>
                <table className="perf-leaderboard-table">
                    <thead>
                        <tr>
                            <th style={{ width: '80px', textAlign: 'center' }}>Rank</th>
                            <th>Producer</th>
                            <th>Total Production Time</th>
                            <th>Daily Average</th>
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
                                        <td style={{ fontWeight: '600', color: 'var(--text-main)' }}>{row.producer}</td>
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
                                <td colSpan="5" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
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