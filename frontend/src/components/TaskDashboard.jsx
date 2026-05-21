import { useState, Fragment } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Search, ChevronDown, ChevronRight, Flag, Target, Building2, Home } from 'lucide-react';
import './TaskDashboard.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const ProgressBar = ({ pulled, total }) => {
  const percentage = total > 0 ? Math.round((pulled / total) * 100) : 0;
  const barColor = percentage >= 100 ? '#10b981' : '#3b82f6';

  return (
    <div style={{ minWidth: '150px' }}>
      <div className="progress-track">
        <div style={{ 
          width: `${Math.min(percentage, 100)}%`,
          backgroundColor: barColor, 
          height: '100%',
          transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
        }} />
      </div>
      <small className="progress-text">
        {percentage}% ({pulled} / {total})
      </small>
    </div>
  );
};

export default function TaskDashboard() {
  const [activeTab, setActiveTab] = useState('OFFICE'); 
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRows, setExpandedRows] = useState(new Set());

  // Fetch from our local MongoDB API
  const { data: allTasks = [], isLoading, isError } = useQuery({
    queryKey: ['tasks'], 
    queryFn: async () => {
        const res = await axios.get(`${API_URL}/api/tasks`);
        return res.data;
    },
    refetchOnWindowFocus: false 
  });

  if (isLoading) return <div style={{ color: 'var(--text-main)', padding: '20px' }}>Loading tasks...</div>;
  if (isError) return <div style={{ color: 'var(--text-main)', padding: '20px' }}>Error fetching tasks.</div>;

  const toggleRow = (uuid) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(uuid)) newExpanded.delete(uuid);
    else newExpanded.add(uuid);
    setExpandedRows(newExpanded);
  };

  // 1. First filter by the Active Tab (OFFICE vs HOUSE)
  const tabTasks = allTasks.filter(t => t.category === activeTab);

  // 2. Calculate Stats based ONLY on the active tab
  const stats = {
    total: tabTasks.length,
    notStarted: tabTasks.filter(t => t.pulledNum === 0).length,
    ongoing: tabTasks.filter(t => t.pulledNum > 0 && t.pulledNum < t.totalNum).length,
    completed: tabTasks.filter(t => t.pulledNum >= t.totalNum).length
  };

  // 3. Apply Status & Search Filters
  const filteredTasks = tabTasks.filter(task => {
    let passesFilter = true;
    if (activeFilter === 'NOT_STARTED') passesFilter = task.pulledNum === 0;
    if (activeFilter === 'ONGOING') passesFilter = task.pulledNum > 0 && task.pulledNum < task.totalNum;
    if (activeFilter === 'COMPLETED') passesFilter = task.pulledNum >= task.totalNum;

    let passesSearch = true;
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      passesSearch = task.taskName.toLowerCase().includes(query) || task.taskId.includes(query);
    }
    return passesFilter && passesSearch;
  });

  return (
    <div className="dashboard-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 className="dashboard-header" style={{ margin: 0 }}>Task Management</h2>
      </div>

      {/* --- UNIFIED TABS --- */}
      <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '24px' }}>
          <button 
              onClick={() => { setActiveTab('OFFICE'); setActiveFilter('ALL'); setSearchQuery(''); }}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s', background: activeTab === 'OFFICE' ? 'rgba(59, 130, 246, 0.1)' : 'transparent', color: activeTab === 'OFFICE' ? 'var(--primary)' : 'var(--text-muted)' }}
          >
              <Building2 size={18} />
              Office Tasks
          </button>
          <button 
              onClick={() => { setActiveTab('HOUSE'); setActiveFilter('ALL'); setSearchQuery(''); }}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s', background: activeTab === 'HOUSE' ? 'rgba(59, 130, 246, 0.1)' : 'transparent', color: activeTab === 'HOUSE' ? 'var(--primary)' : 'var(--text-muted)' }}
          >
              <Home size={18} />
              House Tasks
          </button>
      </div>

      <div className="summary-cards">
        <div className={`summary-card ${activeFilter === 'ALL' ? 'active' : ''}`} onClick={() => setActiveFilter('ALL')}>
          <span className="card-title">Total Tasks</span>
          <span className="card-value">{stats.total}</span>
        </div>
        <div className={`summary-card ${activeFilter === 'NOT_STARTED' ? 'active' : ''}`} onClick={() => setActiveFilter('NOT_STARTED')}>
          <span className="card-title">Not Started</span>
          <span className="card-value">{stats.notStarted}</span>
        </div>
        <div className={`summary-card ${activeFilter === 'ONGOING' ? 'active' : ''}`} onClick={() => setActiveFilter('ONGOING')}>
          <span className="card-title">Ongoing</span>
          <span className="card-value">{stats.ongoing}</span>
        </div>
        <div className={`summary-card ${activeFilter === 'COMPLETED' ? 'active' : ''}`} onClick={() => setActiveFilter('COMPLETED')}>
          <span className="card-title">Completed</span>
          <span className="card-value">{stats.completed}</span>
        </div>
      </div>

      <div className="dashboard-controls">
        <div className="search-wrapper">
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
      
      <table className="task-table">
        <thead>
          <tr>
            <th style={{ width: '40px' }}></th>
            <th>Task ID</th>
            <th>Name & Details</th>
            <th>Progress</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {filteredTasks.length === 0 ? (
              <tr><td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No tasks found in database. Update configuration in Admin Settings and run Data Sync.</td></tr>
          ) : (
              filteredTasks.map((task) => {
                const isExpanded = expandedRows.has(task.uuid);

                return (
                  <Fragment key={task.uuid}>
                    <tr style={{ borderBottom: isExpanded ? 'none' : '1px solid var(--border-color)' }}>
                      <td>
                        <button className="expand-btn" onClick={() => toggleRow(task.uuid)}>
                          {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                        </button>
                      </td>
                      <td style={{ fontWeight: '600' }}>{task.taskId}</td>
                      <td>
                        <span className="task-name" style={{ color: 'var(--text-main)' }}>{task.taskName}</span>
                        <span className="task-desc" style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{task.description}</span>
                      </td>
                      <td><ProgressBar pulled={task.pulledNum} total={task.totalNum} /></td>
                      <td><span className="status-badge" style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '12px', background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>{task.status}</span></td>
                    </tr>

                    <tr className="expanded-content-row">
                      <td colSpan="5" style={{ padding: 0, border: 'none' }}>
                        <div className={`expand-wrapper ${isExpanded ? 'open' : ''}`}>
                          <div className="expand-inner">
                            <div className="expand-layout">
                              
                              <div className="meta-box">
                                <div className="meta-box-header">
                                  <div className="meta-icon-wrapper"><Flag size={18} /></div>
                                  Initial Status
                                </div>
                                <div className="meta-box-text">{task.initialData}</div>
                              </div>

                              <div className="meta-box">
                                <div className="meta-box-header">
                                  <div className="meta-icon-wrapper"><Target size={18} /></div>
                                  Goal
                                </div>
                                <div className="meta-box-text">{task.goalData}</div>
                              </div>

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