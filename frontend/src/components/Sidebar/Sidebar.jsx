import {
  Layers,
  Users,
  Trophy,
  Zap,
  Activity,
  ShieldAlert,
  Settings,
  Database,
  AlertTriangle,
  UserCheck,
  Shield,
  FolderKanban,
  BarChart3,
  ClipboardCheck,
  Cog,
} from 'lucide-react';

import { useNavigate, useLocation } from 'react-router-dom';
import './Sidebar.css';

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  // ==========================================
  // USER DATA
  // ==========================================
  const userString = localStorage.getItem('user');
  const user = userString ? JSON.parse(userString) : null;

  const role = user?.role || 'USER';

  // ==========================================
  // ROLE ACCESS
  // ==========================================
  const isAdmin = role === 'ADMIN';
  const isCoreOrAdmin = role === 'ADMIN' || role === 'CORE_TEAM';

  // ==========================================
  // NAVIGATION HELPER
  // ==========================================
  const isActive = (path) => location.pathname === path;

  return (
    <aside className="sidebar">
      <div className="sidebar-scroll-area">

        {/* ======================================================
            PROJECTS
            ACCESS: EVERYONE
        ====================================================== */}
        <div className="sidebar-section">
          <div className="sidebar-title">
            <FolderKanban size={14} />
            <span>PROJECTS</span>
          </div>

          <button
            className={`nav-button ${isActive('/tasks') ? 'active' : ''}`}
            onClick={() => navigate('/tasks')}
          >
            <Layers size={18} className="nav-icon" />
            <span>Task Directory</span>
          </button>
        </div>

        {/* ======================================================
            REPORTS
            ACCESS: EVERYONE
        ====================================================== */}
        <div className="sidebar-section">
          <div className="sidebar-title">
            <BarChart3 size={14} />
            <span>REPORTS</span>
          </div>

          <button
            className={`nav-button ${isActive('/dashboard') ? 'active' : ''}`}
            onClick={() => navigate('/dashboard')}
          >
            <Activity size={18} className="nav-icon" />
            <span>Project Dashboard</span>
          </button>

          <button
            className={`nav-button ${isActive('/leaderboard') ? 'active' : ''}`}
            onClick={() => navigate('/leaderboard')}
          >
            <Trophy size={18} className="nav-icon" />
            <span>Acceptance Leaderboard</span>
          </button>

          <button
            className={`nav-button ${isActive('/performance') ? 'active' : ''}`}
            onClick={() => navigate('/performance')}
          >
            <Zap size={18} className="nav-icon" />
            <span>Performance Board</span>
          </button>
        </div>

        {/* ======================================================
            QUALITY CONTROL
            ACCESS: CORE TEAM + ADMIN
        ====================================================== */}
        {isCoreOrAdmin && (
          <div className="sidebar-section">
            <div className="sidebar-title">
              <ClipboardCheck size={14} />
              <span>QUALITY CONTROL</span>
            </div>

            <button
              className={`nav-button ${isActive('/qc') ? 'active' : ''}`}
              onClick={() => navigate('/qc')}
            >
              <ShieldAlert size={18} className="nav-icon" />
              <span>QC Hub</span>
            </button>

            <button
              className={`nav-button ${isActive('/qc-leaderboard') ? 'active' : ''}`}
              onClick={() => navigate('/qc-leaderboard')}
            >
              <Trophy size={18} className="nav-icon" />
              <span>QV Leaderboard</span>
            </button>

            <button
              className={`nav-button ${isActive('/anomalies') ? 'active' : ''}`}
              onClick={() => navigate('/anomalies')}
            >
              <AlertTriangle size={18} className="nav-icon" />
              <span>Anomaly Tracker</span>
            </button>
          </div>
        )}

        {/* ======================================================
            MANAGEMENT
            ACCESS: ADMIN
        ====================================================== */}
        {isAdmin && (
          <div className="sidebar-section">
            <div className="sidebar-title">
              <Users size={14} />
              <span>MANAGEMENT</span>
            </div>

            <button
              className={`nav-button ${isActive('/teams') ? 'active' : ''}`}
              onClick={() => navigate('/teams')}
            >
              <Users size={18} className="nav-icon" />
              <span>Team Management</span>
            </button>

            <button
              className={`nav-button ${isActive('/attendance') ? 'active' : ''}`}
              onClick={() => navigate('/attendance')}
            >
              <UserCheck size={18} className="nav-icon" />
              <span>Attendance</span>
            </button>
          </div>
        )}

        {/* ======================================================
            ADMIN
            ACCESS: ADMIN
        ====================================================== */}
        {isAdmin && (
          <div className="sidebar-section">
            <div className="sidebar-title">
              <Cog size={14} />
              <span>ADMIN</span>
            </div>

            <button
              className={`nav-button ${isActive('/sync') ? 'active' : ''}`}
              onClick={() => navigate('/sync')}
            >
              <Database size={18} className="nav-icon" />
              <span>Data Sync</span>
            </button>

            <button
              className={`nav-button ${isActive('/users') ? 'active' : ''}`}
              onClick={() => navigate('/users')}
            >
              <Shield size={18} className="nav-icon" />
              <span>User Management</span>
            </button>

            <button
              className={`nav-button ${isActive('/settings') ? 'active' : ''}`}
              onClick={() => navigate('/settings')}
            >
              <Settings size={18} className="nav-icon" />
              <span>Admin Settings</span>
            </button>
          </div>
        )}

      </div>
    </aside>
  );
}