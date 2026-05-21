import { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';
import Topbar from './components/Topbar/Topbar';
import Sidebar from './components/Sidebar/Sidebar';
import TaskDashboard from './components/TaskDashboard';
import ProjectDashboard from './components/ProjectDashboard';
import TeamManagement from './components/TeamManagement';
import AcceptanceLeaderboard from './components/AcceptanceLeaderboard';
import PerformanceLeaderboard from './components/PerformanceLeaderboard';
import QcDashboard from './components/QcDashboard';
import AdminSettings from './components/AdminSettings';

import { SyncProvider } from './context/SyncContext';
import SyncDataPage from './components/SyncDataPage';

const queryClient = new QueryClient();

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark-mode');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.classList.remove('dark-mode');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  return (
    <QueryClientProvider client={queryClient}>
      <SyncProvider>
        <BrowserRouter>
          <div className="app-container">
            <Topbar isDarkMode={isDarkMode} toggleTheme={toggleTheme} />
            <Sidebar />
            <main className="main-content">
              <Routes>
                <Route path="/" element={<Navigate to="/tasks" replace />} />
                <Route path="/tasks" element={<TaskDashboard />} />
                <Route path="/dashboard" element={<ProjectDashboard />} />
                <Route path="/leaderboard" element={<AcceptanceLeaderboard />} />
                <Route path="/performance" element={<PerformanceLeaderboard />} />
                <Route path="/qc" element={<QcDashboard />} />
                <Route path="/teams" element={<TeamManagement />} />

                {/* Add Settings & Sync Routes */}
                <Route path="/settings" element={<AdminSettings />} />
                <Route path="/sync" element={<SyncDataPage />} />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </SyncProvider>
    </QueryClientProvider>
  );
}