import { Layers, Users, Trophy, Zap, Activity, ShieldAlert, Settings, Database } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import './Sidebar.css';

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get role to secure the sidebar UI
  const userString = localStorage.getItem('user');
  const user = userString ? JSON.parse(userString) : null;
  const isAdmin = user?.role === 'ADMIN';

  return (
    <aside className="sidebar">
      
      <div className="sidebar-section">
        <div className="sidebar-title">Projects</div>
        
        <button
          className={`nav-button ${location.pathname === '/tasks' ? 'active' : ''}`}
          onClick={() => navigate('/tasks')}
        >
          <Layers size={18} className="nav-icon" />
          <span>Task Directory</span>
        </button>
      </div>
      
      <div className="sidebar-section" style={{ marginTop: '32px' }}>
        <div className="sidebar-title">Reports</div>
        
        <button
          className={`nav-button ${location.pathname === '/dashboard' ? 'active' : ''}`}
          onClick={() => navigate('/dashboard')}
        >
          <Activity size={18} className="nav-icon" />
          <span>Project Dashboard</span>
        </button>

        <button
          className={`nav-button ${location.pathname === '/leaderboard' ? 'active' : ''}`}
          onClick={() => navigate('/leaderboard')}
        >
          <Trophy size={18} className="nav-icon" />
          <span>Leaderboard</span>
        </button>

        <button
          className={`nav-button ${location.pathname === '/performance' ? 'active' : ''}`}
          onClick={() => navigate('/performance')}
        >
          <Zap size={18} className="nav-icon" />
          <span>Performance Board</span>
        </button>

        <button
          className={`nav-button ${location.pathname === '/qc' ? 'active' : ''}`}
          onClick={() => navigate('/qc')}
        >
          <ShieldAlert size={18} className="nav-icon" />
          <span>QC Hub</span>
        </button>

        <button
          className={`nav-button ${location.pathname === '/qc-leaderboard' ? 'active' : ''}`}
          onClick={() => navigate('/qc-leaderboard')}
        >
          <Zap size={18} className="nav-icon" />
          <span>QC Leaderboard</span>
        </button>
      </div>

      {/* --- MANAGEMENT SECTION: ONLY FOR ADMINS --- */}
      {isAdmin && (
        <div className="sidebar-section" style={{ marginTop: '32px' }}>
          <div className="sidebar-title">Management</div>
          
          <button
            className={`nav-button ${location.pathname === '/teams' ? 'active' : ''}`}
            onClick={() => navigate('/teams')}
          >
            <Users size={18} className="nav-icon" />
            <span>Team Management</span>
          </button>

          <button
            className={`nav-button ${location.pathname === '/sync' ? 'active' : ''}`}
            onClick={() => navigate('/sync')}
          >
            <Database size={18} className="nav-icon" />
            <span>Data Sync</span>
          </button>

          <button
            className={`nav-button ${location.pathname === '/settings' ? 'active' : ''}`}
            onClick={() => navigate('/settings')}
          >
            <Settings size={18} className="nav-icon" />
            <span>Admin Settings</span>
          </button>
        </div>
      )}

    </aside>
  );
}