import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { Filter, Calendar, Loader2, Trophy, ChevronDown } from 'lucide-react';
import { formatDuration } from '../utils/timeFormat';
import './TaskDashboard.css'; 
import './AcceptanceLeaderboard.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// --- CUSTOM DROPDOWN COMPONENT ---
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
        <div className="custom-dropdown-container" style={{ width: 'auto', minWidth: '200px' }} ref={dropdownRef}>
            <div className="custom-dropdown-header" onClick={() => setIsOpen(!isOpen)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {Icon && <Icon size={16} color="var(--text-muted)" />}
                    <span>{selectedLabel}</span>
                </div>
                <ChevronDown size={16} color="var(--text-muted)" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }} />
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
        queryKey: ['acceptanceLeaderboard', teamCategory, startDate, endDate],
        queryFn: async () => {
            let url = `${API_URL}/api/leaderboards/acceptance?teamName=${teamCategory}`;
            if (startDate && endDate) {
                url += `&startDate=${startDate}&endDate=${endDate}`;
            }
            const res = await axios.get(url);
            return res.data;
        },
        placeholderData: (previousData) => previousData,
        refetchOnWindowFocus: false
    });

    const leaderboard = queryResult?.data || [];

    const totals = leaderboard.reduce((acc, curr) => ({
        accepted: acc.accepted + (curr.acceptedSec || 0),
        rejected: acc.rejected + (curr.rejectedSec || 0),
        waiting: acc.waiting + (curr.waitingSec || 0),
    }), { accepted: 0, rejected: 0, waiting: 0 });

    return (
        <div className="dashboard-card" style={{ maxWidth: '1400px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <div className="qc-filter-wrapper">
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

                    {/* NEW CUSTOM SELECT DROPDOWN */}
                    <CustomSelect
                        icon={Filter}
                        value={teamCategory}
                        onChange={setTeamCategory}
                        options={[
                            { value: 'ALL', label: 'All Teams (Global)' },
                            ...teams.map(team => ({ value: team, label: team }))
                        ]}
                    />
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
                                        <td style={{ fontWeight: '600', color: 'var(--text-main)' }}>
                                            {row.producer}
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
                                <td colSpan="5" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
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