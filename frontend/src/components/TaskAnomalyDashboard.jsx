import { useState, useEffect, Fragment } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { History, Search, ChevronDown, ChevronRight, Target, Clock } from 'lucide-react';
import { useProjects } from '../hooks/useProjects';
import { getProjectIcon } from '../config/projectIcons';
import './TaskDashboard.css';
import './TaskAnomalyDashboard.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const formatDate = (dateVal) => {
    if (!dateVal) return 'Unknown';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return 'Unknown';
    return d.toLocaleString('en-US', {
        timeZone: 'Asia/Shanghai',
        dateStyle: 'medium',
        timeStyle: 'short'
    });
};

export default function TaskAnomalyDashboard() {
    const [activeTab, setActiveTab] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedRows, setExpandedRows] = useState(new Set());

    const { enabledProjects } = useProjects();

    const { data, isLoading, isError } = useQuery({
        queryKey: ['task-anomalies'],
        queryFn: async () => {
            const res = await axios.get(`${API_URL}/api/tasks/goal-anomalies`);
            return res.data.tasks;
        },
        staleTime: 0,
        refetchOnWindowFocus: false
    });

    const allTasks = data || [];

    // Keep the active tab valid as the project registry loads / changes.
    useEffect(() => {
        if (enabledProjects.length > 0 && !enabledProjects.some(p => p.key === activeTab)) {
            setActiveTab(enabledProjects[0].key);
        }
    }, [enabledProjects, activeTab]);

    const toggleRow = (uuid) => {
        const newExpanded = new Set(expandedRows);
        if (newExpanded.has(uuid)) newExpanded.delete(uuid);
        else newExpanded.add(uuid);
        setExpandedRows(newExpanded);
    };

    const stats = {};
    enabledProjects.forEach(p => {
        stats[p.key] = allTasks.filter(t => t.category === p.key).length;
    });

    const tabTasks = allTasks.filter(t => t.category === activeTab);

    const filteredTasks = tabTasks.filter(task => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return task.taskName.toLowerCase().includes(q) || task.taskId.includes(q);
    }).sort((a, b) => {
        const aLatest = Math.max(...(a.goalVersions || []).map(v => new Date(v.changedAt).getTime()), 0);
        const bLatest = Math.max(...(b.goalVersions || []).map(v => new Date(v.changedAt).getTime()), 0);
        return bLatest - aLatest;
    });

    if (isLoading) return <div style={{ color: 'var(--text-main)', padding: '20px' }}>Loading task anomalies...</div>;
    if (isError) return <div style={{ color: 'var(--text-main)', padding: '20px' }}>Error fetching task anomalies.</div>;

    return (
        <div className="dashboard-card">
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="ta-header-icon">
                        <History size={20} />
                    </div>
                    <div>
                        <h2 className="dashboard-header" style={{ margin: 0, color: '#f59e0b' }}>Task Goal Anomalies</h2>
                        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Tasks whose goal has changed since last sync — {allTasks.length} total
                        </p>
                    </div>
                </div>
                <div className="search-wrapper" style={{ width: '260px', flexShrink: 0 }}>
                    <Search className="search-icon" size={18} />
                    <input
                        type="text"
                        className="search-input"
                        placeholder="Search by ID or Name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Category tabs */}
            <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '24px', marginTop: '24px' }}>
                {enabledProjects.map((proj) => {
                    const key = proj.key;
                    const Icon = getProjectIcon(proj.icon);
                    return (
                        <button
                            key={key}
                            onClick={() => { setActiveTab(key); setSearchQuery(''); setExpandedRows(new Set()); }}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                padding: '10px 20px', borderRadius: '8px', border: 'none',
                                cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s',
                                background: activeTab === key ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
                                color: activeTab === key ? '#f59e0b' : 'var(--text-muted)'
                            }}
                        >
                            <Icon size={18} /> {proj.name}
                            {stats[key] > 0 && (
                                <span className="ta-count-badge">{stats[key]}</span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Table */}
            <table className="task-table">
                <thead>
                    <tr>
                        <th style={{ width: '40px' }}></th>
                        <th>Task ID</th>
                        <th>Task Name</th>
                        <th>Current Goal</th>
                        <th>Changes</th>
                        <th>Last Changed</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredTasks.length === 0 ? (
                        <tr>
                            <td colSpan="6" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                    <History size={32} style={{ opacity: 0.3 }} />
                                    <span>No goal changes detected for {(activeTab || '').toLowerCase()} tasks.</span>
                                    <span style={{ fontSize: '12px' }}>Goal changes are recorded automatically during Task Sync.</span>
                                </div>
                            </td>
                        </tr>
                    ) : (
                        filteredTasks.map((task) => {
                            const isExpanded = expandedRows.has(task._id || task.uuid);
                            const rowKey = task._id || task.uuid;
                            const sortedVersions = [...(task.goalVersions || [])].sort(
                                (a, b) => new Date(b.changedAt) - new Date(a.changedAt)
                            );
                            const lastChanged = sortedVersions[0]?.changedAt;

                            return (
                                <Fragment key={rowKey}>
                                    <tr
                                        style={{
                                            borderBottom: isExpanded ? 'none' : '1px solid var(--border-color)',
                                            cursor: 'pointer'
                                        }}
                                        onClick={() => toggleRow(rowKey)}
                                    >
                                        <td onClick={(e) => e.stopPropagation()}>
                                            <button className="expand-btn" onClick={() => toggleRow(rowKey)}>
                                                {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                            </button>
                                        </td>
                                        <td style={{ fontWeight: '600' }}>{task.taskId}</td>
                                        <td>
                                            <span className="task-name">{task.taskName}</span>
                                        </td>
                                        <td>
                                            <span style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                {task.goalData}
                                            </span>
                                        </td>
                                        <td>
                                            <span className="ta-change-count">{task.goalVersions?.length || 0}</span>
                                        </td>
                                        <td>
                                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Clock size={13} />
                                                {formatDate(lastChanged)}
                                            </span>
                                        </td>
                                    </tr>

                                    <tr className="expanded-content-row">
                                        <td colSpan="6" style={{ padding: 0, border: 'none' }}>
                                            <div className={`expand-wrapper ${isExpanded ? 'open' : ''}`}>
                                                <div className="expand-inner">
                                                    <div style={{ padding: '16px 24px 24px 70px' }}>
                                                        <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px', marginTop: '8px' }}>
                                                            Goal History
                                                        </p>

                                                        {/* Current goal */}
                                                        <div className="ta-timeline-entry">
                                                            <div className="ta-timeline-dot ta-timeline-dot--current" />
                                                            <div className="ta-timeline-content">
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                                                    <div className="ta-timeline-icon">
                                                                        <Target size={14} />
                                                                    </div>
                                                                    <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Current Goal</span>
                                                                    <span className="ta-current-badge">CURRENT</span>
                                                                </div>
                                                                <p className="ta-goal-text">{task.goalData}</p>
                                                            </div>
                                                        </div>

                                                        {/* Previous versions */}
                                                        {sortedVersions.map((ver, idx) => (
                                                            <div key={idx} className="ta-timeline-entry">
                                                                <div className="ta-timeline-dot ta-timeline-dot--old" />
                                                                <div className="ta-timeline-content">
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                                                        <div className="ta-timeline-icon ta-timeline-icon--old">
                                                                            <Clock size={14} />
                                                                        </div>
                                                                        <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                                            Previous #{sortedVersions.length - idx}
                                                                        </span>
                                                                        <span className="ta-changed-badge">CHANGED</span>
                                                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                                                                            {formatDate(ver.changedAt)}
                                                                        </span>
                                                                    </div>
                                                                    <p className="ta-goal-text ta-goal-text--old">{ver.value}</p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                </Fragment>
                            );
                        })
                    )}
                </tbody>
            </table>
        </div>
    );
}
