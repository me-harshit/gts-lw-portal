import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { Filter, Calendar, Users, ChevronDown, Activity, Loader2, Tag as TagIcon, Clock, TrendingUp, BarChart2 } from 'lucide-react';
import './TaskDashboard.css';
import './ProjectDashboard.css';

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

function BarLineChart({ data, todayStr }) {
    const [tooltip, setTooltip] = useState(null);

    if (!data || data.length === 0) return (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
            No trend data available.
        </div>
    );

    const W = 960, H = 320;
    const PL = 58, PR = 70, PT = 20, PB = 42;
    const plotW = W - PL - PR;
    const plotH = H - PT - PB;
    const n = data.length;
    const slotW = plotW / n;
    const barW = Math.max(slotW * 0.56, 3);

    const maxColl = Math.max(...data.map(d => d.activeProducers || 0), 1);
    const maxHrs  = Math.max(...data.map(d => d.total?.hours    || 0), 1);
    const collMax = Math.ceil(maxColl / 10) * 10 || 10;
    const hrsMax  = Math.ceil(maxHrs  / 20) * 20 || 20;
    const INTERVALS = 9;

    const cx   = i => PL + slotW * i + slotW / 2;
    const yCol = v => PT + plotH - (v / collMax) * plotH;
    const yHrs = v => PT + plotH - (v / hrsMax)  * plotH;

    const ticks = Array.from({ length: INTERVALS + 1 }, (_, i) => i);
    const linePath = data.map((d, i) =>
        `${i === 0 ? 'M' : 'L'}${cx(i).toFixed(1)},${yHrs(d.total?.hours || 0).toFixed(1)}`
    ).join(' ');

    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const fmtDate = s => {
        const parts = (s || '').split('-');
        return parts.length === 3 ? `${MONTHS[+parts[1] - 1]} ${+parts[2]}` : '';
    };
    const fmtHrs = h => {
        const hrs = Math.floor(h);
        const mins = Math.round((h - hrs) * 60);
        return `${hrs}h ${mins}m`;
    };

    // Thin out x-axis labels for dense charts
    const labelEvery = n <= 14 ? 1 : n <= 20 ? 2 : 5;

    return (
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', overflow: 'visible' }}>

            {/* Gridlines + dual Y-axis tick labels */}
            {ticks.map(i => {
                const y       = (PT + plotH - (i / INTERVALS) * plotH).toFixed(1);
                const leftVal = Math.round((collMax / INTERVALS) * i);
                const rgtVal  = Math.round((hrsMax  / INTERVALS) * i);
                return (
                    <g key={i}>
                        <line x1={PL} y1={y} x2={PL + plotW} y2={y}
                            stroke="var(--border-color)"
                            strokeWidth={i === 0 ? '1.5' : '1'}
                            strokeDasharray={i === 0 ? undefined : '4 4'}
                            opacity="0.7" />
                        <text x={PL - 8} y={y} textAnchor="end" dominantBaseline="middle"
                            fill="var(--text-muted)" fontSize="11">
                            {leftVal}
                        </text>
                        <text x={PL + plotW + 8} y={y} textAnchor="start" dominantBaseline="middle"
                            fill="var(--text-muted)" fontSize="11">
                            {rgtVal}h
                        </text>
                    </g>
                );
            })}

            {/* Blue bars — Active Collectors */}
            {data.map((d, i) => {
                const v  = d.activeProducers || 0;
                const bx = cx(i) - barW / 2;
                const by = yCol(v);
                const bh = Math.max(yCol(0) - yCol(v), 0);
                return (
                    <rect key={i} x={bx.toFixed(1)} y={by.toFixed(1)}
                        width={barW.toFixed(1)} height={bh.toFixed(1)}
                        fill="#3b82f6" rx="3" opacity="0.82"
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={() => setTooltip({ i, d })}
                        onMouseLeave={() => setTooltip(null)} />
                );
            })}

            {/* Green line — Hrs Collected */}
            <path d={linePath} fill="none" stroke="#10b981" strokeWidth="2.5"
                strokeLinejoin="round" strokeLinecap="round" />

            {/* Dots on line */}
            {data.map((d, i) => (
                <circle key={i} cx={cx(i).toFixed(1)} cy={yHrs(d.total?.hours || 0).toFixed(1)}
                    r="5" fill="#10b981" stroke="var(--bg-sidebar)" strokeWidth="2.5"
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setTooltip({ i, d })}
                    onMouseLeave={() => setTooltip(null)} />
            ))}

            {/* X-axis date labels */}
            {data.map((d, i) => {
                if (i % labelEvery !== 0 && i !== n - 1) return null;
                const isToday = d.date === todayStr;
                return (
                    <text key={i} x={cx(i).toFixed(1)} y={PT + plotH + 22}
                        textAnchor="middle" fontSize="11"
                        fill={isToday ? 'var(--text-main)' : 'var(--text-muted)'}
                        fontWeight={isToday ? '700' : '400'}>
                        {fmtDate(d.date)}{isToday ? '*' : ''}
                    </text>
                );
            })}

            {/* Rotated Y-axis titles */}
            <text transform="rotate(-90)" x={-(PT + plotH / 2)} y={15}
                textAnchor="middle" fill="var(--text-muted)" fontSize="11" fontWeight="600">
                Collectors
            </text>
            <text transform="rotate(90)" x={PT + plotH / 2} y={15 - W}
                textAnchor="middle" fill="var(--text-muted)" fontSize="11" fontWeight="600">
                Hrs collected
            </text>

            {/* Hover Tooltip */}
            {tooltip && (() => {
                const { i, d } = tooltip;
                const ttW = 152, ttH = 70;
                let tx = cx(i) + 12;
                let ty = Math.max(yCol(d.activeProducers || 0) - ttH - 8, PT + 4);
                if (tx + ttW > PL + plotW) tx = cx(i) - ttW - 12;
                if (tx < PL) tx = PL;
                return (
                    <g pointerEvents="none">
                        <rect x={tx} y={ty} width={ttW} height={ttH} rx="6"
                            fill="var(--bg-main)" stroke="var(--border-color)" strokeWidth="1" opacity="0.97" />
                        <text x={tx + 10} y={ty + 18} fontSize="11" fontWeight="700" fill="var(--text-main)">
                            {d.date}
                        </text>
                        <text x={tx + 10} y={ty + 37} fontSize="11" fill="var(--text-muted)">
                            {'Collectors: '}
                            <tspan fill="var(--text-main)" fontWeight="600">{d.activeProducers || 0}</tspan>
                        </text>
                        <text x={tx + 10} y={ty + 56} fontSize="11" fill="var(--text-muted)">
                            {'Prod Time: '}
                            <tspan fill="var(--text-main)" fontWeight="600">{fmtHrs(d.total?.hours || 0)}</tspan>
                        </text>
                    </g>
                );
            })()}
        </svg>
    );
}

export default function ProjectDashboard() {
    const [viewCategory, setViewCategory] = useState('ALL');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [activeGlobalFilter, setActiveGlobalFilter] = useState('thisMonth');

    const [activeTag, setActiveTag] = useState('ALL');
    const [activeShift, setActiveShift] = useState('ALL');
    const [teamCategory, setTeamCategory] = useState('ALL');
    const [chartFilter, setChartFilter] = useState('week');

    const [tags, setTags] = useState([]);
    const [shifts, setShifts] = useState([]);
    const [teams, setTeams] = useState([]);
    const [teamConfigs, setTeamConfigs] = useState([]);

    const formatDecimalHours = (decimalHours) => {
        if (!decimalHours || isNaN(decimalHours) || decimalHours === 0) return '0h 0m';

        const hrs = Math.floor(decimalHours);
        const mins = Math.round((decimalHours - hrs) * 60);

        if (mins === 60) return `${hrs + 1}h 0m`;

        return `${hrs}h ${mins}m`;
    };

    const applyQuickFilter = (type) => {
        setActiveGlobalFilter(type);
        const today = new Date();
        const formatDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

        if (type === 'today') { setStartDate(formatDate(today)); setEndDate(formatDate(today)); }
        else if (type === 'yesterday') { const y = new Date(today); y.setDate(y.getDate() - 1); setStartDate(formatDate(y)); setEndDate(formatDate(y)); }
        else if (type === 'thisWeek') { const m = new Date(today); m.setDate(m.getDate() - (m.getDay() || 7) + 1); setStartDate(formatDate(m)); setEndDate(formatDate(today)); }
        else if (type === 'thisMonth') { setStartDate(formatDate(new Date(today.getFullYear(), today.getMonth(), 1))); setEndDate(formatDate(today)); }
        else { setStartDate(''); setEndDate(''); }
    };

    useEffect(() => {
        applyQuickFilter('thisMonth');
    }, []);

    const handleDateChange = (value, isStart) => {
        setActiveGlobalFilter('');
        isStart ? setStartDate(value) : setEndDate(value);
    };

    useEffect(() => {
        const fetchMetadata = async () => {
            try {
                const [configsRes, tagsRes, shiftsRes] = await Promise.all([
                    axios.get(`${API_URL}/api/teams/configs`),
                    axios.get(`${API_URL}/api/teams/tags`),
                    axios.get(`${API_URL}/api/teams/shifts`)
                ]);
                setTeamConfigs(configsRes.data);
                setTags(tagsRes.data.map(t => t.name));
                setShifts(shiftsRes.data.map(s => s.name));
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
    if ((activeTag !== 'ALL' || activeShift !== 'ALL' || teamCategory !== 'ALL') && matchingTeams.length === 0) teamQuery = '___NONE___';
    else if (activeTag !== 'ALL' || activeShift !== 'ALL' || teamCategory !== 'ALL') teamQuery = matchingTeams.map(t => t.name).join(',');

    const trendDaysMap = { week: 14, '10days': 20, month: 62 };
    const trendDays = trendDaysMap[chartFilter] || 14;

    const { data: summary, isFetching } = useQuery({
        queryKey: ['projectSummary', viewCategory, teamQuery, startDate, endDate, teamConfigs.length, trendDays],
        queryFn: async () => {
            let url = `${API_URL}/api/dashboard/stats/summary?category=${viewCategory}&teams=${teamQuery}&trendDays=${trendDays}`;
            if (startDate && endDate) url += `&startDate=${startDate}&endDate=${endDate}`;
            const res = await axios.get(url);
            return res.data;
        },
        placeholderData: (prev) => prev,
        refetchOnWindowFocus: false,
        enabled: teamConfigs.length > 0
    });

    // === CHART & KPI COMPUTATION ===
    const chartData = summary?.trend ? [...summary.trend].reverse() : [];

    const bjgNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
    const pad2   = n => String(n).padStart(2, '0');
    const todayStr = `${bjgNow.getFullYear()}-${pad2(bjgNow.getMonth() + 1)}-${pad2(bjgNow.getDate())}`;

    // Week boundaries
    const dayOfWk = bjgNow.getDay() || 7;
    const thisMon = new Date(bjgNow); thisMon.setDate(bjgNow.getDate() - dayOfWk + 1);
    const thisMondayStr = `${thisMon.getFullYear()}-${pad2(thisMon.getMonth() + 1)}-${pad2(thisMon.getDate())}`;
    const lastSun = new Date(thisMon); lastSun.setDate(thisMon.getDate() - 1);
    const lastMon = new Date(thisMon); lastMon.setDate(thisMon.getDate() - 7);
    const lastMondayStr = `${lastMon.getFullYear()}-${pad2(lastMon.getMonth() + 1)}-${pad2(lastMon.getDate())}`;
    const lastSundayStr = `${lastSun.getFullYear()}-${pad2(lastSun.getMonth() + 1)}-${pad2(lastSun.getDate())}`;

    // 10-day boundaries
    const tenStart = new Date(bjgNow); tenStart.setDate(bjgNow.getDate() - 9);
    const tenStartStr = `${tenStart.getFullYear()}-${pad2(tenStart.getMonth() + 1)}-${pad2(tenStart.getDate())}`;
    const prevTenEnd = new Date(bjgNow); prevTenEnd.setDate(bjgNow.getDate() - 10);
    const prevTenStart = new Date(bjgNow); prevTenStart.setDate(bjgNow.getDate() - 19);
    const prevTenEndStr = `${prevTenEnd.getFullYear()}-${pad2(prevTenEnd.getMonth() + 1)}-${pad2(prevTenEnd.getDate())}`;
    const prevTenStartStr = `${prevTenStart.getFullYear()}-${pad2(prevTenStart.getMonth() + 1)}-${pad2(prevTenStart.getDate())}`;

    // Month boundaries
    const thisMonStart = new Date(bjgNow.getFullYear(), bjgNow.getMonth(), 1);
    const thisMonStartStr = `${thisMonStart.getFullYear()}-${pad2(thisMonStart.getMonth() + 1)}-01`;
    const lastMonEnd = new Date(bjgNow.getFullYear(), bjgNow.getMonth(), 0);
    const lastMonStart = new Date(bjgNow.getFullYear(), bjgNow.getMonth() - 1, 1);
    const lastMonEndStr = `${lastMonEnd.getFullYear()}-${pad2(lastMonEnd.getMonth() + 1)}-${pad2(lastMonEnd.getDate())}`;
    const lastMonStartStr = `${lastMonStart.getFullYear()}-${pad2(lastMonStart.getMonth() + 1)}-01`;

    let currentPeriodDays, prevPeriodDays;
    if (chartFilter === '10days') {
        currentPeriodDays = chartData.filter(d => d.date >= tenStartStr    && d.date <= todayStr);
        prevPeriodDays    = chartData.filter(d => d.date >= prevTenStartStr && d.date <= prevTenEndStr);
    } else if (chartFilter === 'month') {
        currentPeriodDays = chartData.filter(d => d.date >= thisMonStartStr && d.date <= todayStr);
        prevPeriodDays    = chartData.filter(d => d.date >= lastMonStartStr  && d.date <= lastMonEndStr);
    } else {
        currentPeriodDays = chartData.filter(d => d.date >= thisMondayStr && d.date <= todayStr);
        prevPeriodDays    = chartData.filter(d => d.date >= lastMondayStr  && d.date <= lastSundayStr);
    }

    const currentAvgColl  = currentPeriodDays.length ? currentPeriodDays.reduce((s, d) => s + (d.activeProducers || 0), 0) / currentPeriodDays.length : 0;
    const prevAvgColl     = prevPeriodDays.length    ? prevPeriodDays.reduce((s, d) => s + (d.activeProducers || 0), 0) / prevPeriodDays.length : 0;
    const currentTotalHrs = currentPeriodDays.reduce((s, d) => s + (d.total?.hours || 0), 0);
    const prevTotalHrs    = prevPeriodDays.reduce((s, d) => s + (d.total?.hours || 0), 0);
    const outputChange    = prevTotalHrs > 0 ? (currentTotalHrs - prevTotalHrs) / prevTotalHrs * 100 : null;

    const periodLabels = {
        week:     { current: 'This Week',    prev: 'Last Week'     },
        '10days': { current: 'This 10 Days', prev: 'Prev 10 Days'  },
        month:    { current: 'This Month',   prev: 'Last Month'    }
    };
    const pLabel = periodLabels[chartFilter] || periodLabels.week;

    const totalCount = summary?.total?.count || 0;
    const acceptedCount = summary?.accepted?.count || 0;
    const rejectedCount = summary?.rejected?.count || 0;
    const pendingCount = summary?.pending?.count || 0;

    const totalHours = summary?.total?.hours || 0;
    const acceptedHours = summary?.accepted?.hours || 0;
    const rejectedHours = summary?.rejected?.hours || 0;
    const pendingHours = summary?.pending?.hours || 0;

    const inspectedCount = acceptedCount + rejectedCount;
    const inspectedHours = acceptedHours + rejectedHours;

    const acceptanceRate = inspectedHours > 0 ? ((acceptedHours / inspectedHours) * 100).toFixed(1) : '0.0';
    const rejectionRate = inspectedHours > 0 ? ((rejectedHours / inspectedHours) * 100).toFixed(1) : '0.0';
    const pendingRate = totalHours > 0 ? ((pendingHours / totalHours) * 100).toFixed(1) : '0.0';
    const inspectedRate = totalHours > 0 ? ((inspectedHours / totalHours) * 100).toFixed(1) : '0.0';

    return (
        <div className="dashboard-card pd-container">

            <div className="pd-header-section">
                <div className="pd-header-row">
                    <h2 className="dashboard-header pd-title">
                        <Activity className="pd-icon-primary" size={24} />
                        Project Overview
                    </h2>
                    <div className="quick-filters-container pd-no-margin">
                        <button className={`quick-filter-btn ${activeGlobalFilter === 'allTime' ? 'active' : ''}`} onClick={() => applyQuickFilter('allTime')}>All Time</button>
                        <button className={`quick-filter-btn ${activeGlobalFilter === 'today' ? 'active' : ''}`} onClick={() => applyQuickFilter('today')}>Today</button>
                        <button className={`quick-filter-btn ${activeGlobalFilter === 'yesterday' ? 'active' : ''}`} onClick={() => applyQuickFilter('yesterday')}>Yesterday</button>
                        <button className={`quick-filter-btn ${activeGlobalFilter === 'thisWeek' ? 'active' : ''}`} onClick={() => applyQuickFilter('thisWeek')}>This Week</button>
                        <button className={`quick-filter-btn ${activeGlobalFilter === 'thisMonth' ? 'active' : ''}`} onClick={() => applyQuickFilter('thisMonth')}>This Month</button>
                    </div>
                </div>

                <div className="pd-filter-row">
                    <CustomSelect className="pd-select-sm" icon={TagIcon} value={activeTag} onChange={setActiveTag} options={[{ value: 'ALL', label: 'All Tags' }, ...tags.map(t => ({ value: t, label: t }))]} />
                    <CustomSelect className="pd-select-md" icon={Clock} value={activeShift} onChange={setActiveShift} options={[{ value: 'ALL', label: 'All Shifts' }, ...shifts.map(s => ({ value: s, label: s }))]} />
                    <CustomSelect className="pd-select-sm" icon={Users} value={teamCategory} onChange={setTeamCategory} options={[{ value: 'ALL', label: 'All Teams' }, ...teams.map(t => ({ value: t, label: t }))]} />
                    <CustomSelect className="pd-select-sm" icon={Filter} value={viewCategory} onChange={setViewCategory} options={[{ value: 'ALL', label: 'All Projects' }, { value: 'OFFICE', label: 'Office Tasks' }, { value: 'HOUSE', label: 'House Tasks' }, { value: 'GYM', label: 'Gym Tasks' }]} />

                    <div className="pd-date-wrapper">
                        <Calendar size={16} className="pd-icon-muted" />
                        <input type="date" className="pd-date-input" value={startDate} onChange={(e) => handleDateChange(e.target.value, true)} />
                        <span className="pd-date-separator">to</span>
                        <input type="date" className="pd-date-input" value={endDate} onChange={(e) => handleDateChange(e.target.value, false)} />
                    </div>
                </div>
            </div>

            <div className={`summary-cards pd-summary-wrap ${isFetching ? 'pd-is-fetching' : ''}`}>
                <div className="summary-card">
                    <span className="card-title">Total Volume</span>
                    <div className="pd-summary-content">
                        <span className="card-value pd-text-primary">{formatDecimalHours(totalHours)}</span>
                        <span className="pd-summary-subtext">{totalCount.toLocaleString()} clips</span>
                    </div>
                </div>
                <div className="summary-card">
                    <span className="card-title">Total Accepted</span>
                    <div className="pd-summary-content">
                        <span className="card-value pd-text-success">{formatDecimalHours(acceptedHours)}</span>
                        <span className="pd-summary-subtext">{acceptedCount.toLocaleString()} clips</span>
                        {inspectedCount > 0 && <span className="pd-summary-subtext-bold">Acceptance Rate - {acceptanceRate}%</span>}
                    </div>
                </div>
                <div className="summary-card">
                    <span className="card-title">Total Rejected</span>
                    <div className="pd-summary-content">
                        <span className="card-value pd-text-danger">{formatDecimalHours(rejectedHours)}</span>
                        <span className="pd-summary-subtext">{rejectedCount.toLocaleString()} clips</span>
                        {inspectedCount > 0 && <span className="pd-summary-subtext-bold">Rejection Rate - {rejectionRate}%</span>}
                    </div>
                </div>
                <div className="summary-card">
                    <span className="card-title">QC Done</span>
                    <div className="pd-summary-content">
                        <span className="card-value pd-text-info">{formatDecimalHours(inspectedHours)}</span>
                        <span className="pd-summary-subtext">{inspectedCount.toLocaleString()} clips</span>
                        {totalCount > 0 && <span className="pd-summary-subtext-bold">QC Completed - {inspectedRate}%</span>}
                    </div>
                </div>
                <div className="summary-card">
                    <span className="card-title">Pending QC</span>
                    <div className="pd-summary-content">
                        <span className="card-value pd-text-warning">{formatDecimalHours(pendingHours)}</span>
                        <span className="pd-summary-subtext">{pendingCount.toLocaleString()} clips</span>
                        {totalCount > 0 && <span className="pd-summary-subtext-bold">QC Pending - {pendingRate}%</span>}
                    </div>
                </div>
            </div>

            <hr className="pd-divider" />

            <div className="pd-section-header">
                <h3 className="pd-section-title">
                    <TrendingUp size={20} className="pd-icon-primary" />
                    Daily Production Summary
                </h3>
            </div>

            <div className={`pd-table-wrapper ${isFetching ? 'pd-is-fetching' : ''}`}>
                <table className="pd-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th className="pd-text-center">Active Collectors</th>
                            <th className="pd-text-center">Hrs Collected</th>
                            <th className="pd-text-center pd-th-success">QC Pass</th>
                            <th className="pd-text-center pd-th-danger">QC Fail</th>
                            <th className="pd-text-center pd-th-warning">QC Pending</th>
                            <th className="pd-text-center pd-th-main">Pass Rate</th>
                        </tr>
                    </thead>
                    <tbody>
                        {summary?.trend?.length > 0 ? (
                            summary.trend.map(day => {
                                const passRate = day.accepted.hours > 0
                                    ? ((day.accepted.hours / (day.accepted.hours + day.rejected.hours)) * 100).toFixed(1)
                                    : '0.0';

                                return (
                                    <tr key={day.date}>
                                        <td>
                                            <div className="pd-table-val">{day.date}</div>
                                        </td>
                                        <td className="pd-text-center">
                                            <div className="pd-table-val">{day.activeProducers}</div>
                                        </td>
                                        <td className="pd-text-center">
                                            <div className="pd-table-val">{formatDecimalHours(day.total.hours)}</div>
                                            <div className="pd-table-subtext">{day.total.count.toLocaleString()} clips</div>
                                        </td>
                                        <td className="pd-text-center">
                                            <div className="pd-table-val-success">{formatDecimalHours(day.accepted.hours)}</div>
                                            <div className="pd-table-subtext">{day.accepted.count.toLocaleString()} clips</div>
                                        </td>
                                        <td className="pd-text-center">
                                            <div className="pd-table-val-danger">{formatDecimalHours(day.rejected.hours)}</div>
                                            <div className="pd-table-subtext">{day.rejected.count.toLocaleString()} clips</div>
                                        </td>
                                        <td className="pd-text-center">
                                            <div className="pd-table-val-warning">{formatDecimalHours(day.pending.hours)}</div>
                                            <div className="pd-table-subtext">{day.pending.count.toLocaleString()} clips</div>
                                        </td>
                                        <td className="pd-text-center">
                                            <div className="pd-table-val-primary">{passRate}%</div>
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan="7" className="pd-empty-state">
                                    {isFetching ? <Loader2 className="spinning pd-icon-center" size={24} /> : 'No data found for the selected filters.'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <hr className="pd-divider" />

            {/* ====== ACTIVE COLLECTORS VS PRODUCTION HOURS ====== */}
            <div className="pd-section-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
                <h3 className="pd-section-title" style={{ textTransform: 'uppercase', fontSize: '13px', letterSpacing: '1px', fontWeight: '700' }}>
                    <BarChart2 size={20} className="pd-icon-primary" />
                    Active Collectors vs Production Hours
                </h3>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Period filter pills */}
                    <div style={{ display: 'flex', gap: '6px' }}>
                        {[['week', 'Week'], ['10days', '10 Days'], ['month', 'Month']].map(([val, lbl]) => (
                            <button key={val} onClick={() => setChartFilter(val)} style={{
                                padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
                                border: '1px solid var(--border-color)', cursor: 'pointer', transition: 'all 0.2s',
                                background: chartFilter === val ? 'var(--primary)' : 'transparent',
                                color: chartFilter === val ? 'white' : 'var(--text-muted)'
                            }}>{lbl}</button>
                        ))}
                    </div>
                    {/* Legend */}
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '14px', height: '14px', borderRadius: '3px', background: '#3b82f6', flexShrink: 0 }} />
                            <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>Active collectors</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '20px', height: '3px', background: '#10b981', borderRadius: '2px', flexShrink: 0 }} />
                            <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>Hrs collected</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="summary-cards pd-summary-wrap" style={{ marginBottom: '24px' }}>
                <div className="summary-card">
                    <span className="card-title">{pLabel.current} Avg Collectors</span>
                    <div className="pd-summary-content">
                        <span className="card-value pd-text-primary">
                            {chartData.length > 0 ? Math.round(currentAvgColl) : '-'}
                        </span>
                    </div>
                </div>
                <div className="summary-card">
                    <span className="card-title">{pLabel.prev} Avg Collectors</span>
                    <div className="pd-summary-content">
                        <span className="card-value" style={{ color: 'var(--text-main)', lineHeight: 1 }}>
                            {chartData.length > 0 ? prevAvgColl.toFixed(1) : '-'}
                        </span>
                    </div>
                </div>
                <div className="summary-card">
                    <span className="card-title">{pLabel.current} Total Hrs</span>
                    <div className="pd-summary-content">
                        <span className="card-value pd-text-info">
                            {chartData.length > 0 ? formatDecimalHours(currentTotalHrs) : '-'}
                        </span>
                    </div>
                </div>
                <div className="summary-card">
                    <span className="card-title">{pLabel.prev} Total Hrs</span>
                    <div className="pd-summary-content">
                        <span className="card-value" style={{ color: 'var(--text-main)', lineHeight: 1 }}>
                            {chartData.length > 0 ? formatDecimalHours(prevTotalHrs) : '-'}
                        </span>
                    </div>
                </div>
                <div className="summary-card">
                    <span className="card-title">Output Change (Hrs)</span>
                    <div className="pd-summary-content">
                        <span className="card-value" style={{
                            lineHeight: 1,
                            color: outputChange === null ? 'var(--text-muted)' : outputChange >= 0 ? '#10b981' : '#ef4444'
                        }}>
                            {outputChange === null
                                ? '-'
                                : `${outputChange >= 0 ? '↑' : '↓'} ${Math.abs(outputChange).toFixed(1)}%`}
                        </span>
                    </div>
                </div>
            </div>

            {/* Chart */}
            <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '20px 20px 12px', border: '1px solid var(--border-color)' }}>
                <BarLineChart data={chartData} todayStr={todayStr} />
            </div>

        </div>
    );
}