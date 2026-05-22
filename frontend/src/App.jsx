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
import QcLeaderboard from './components/QcLeaderboard';
import AdminSettings from './components/AdminSettings';
import SyncDataPage from './components/SyncDataPage';
import Login from './components/Login'; 
import ProtectedRoute from './components/ProtectedRoute'; 
import { SyncProvider } from './context/SyncContext';

const queryClient = new QueryClient();

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    document.body.classList.toggle('dark-mode', isDarkMode);
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  return (
    <QueryClientProvider client={queryClient}>
      <SyncProvider>
        <BrowserRouter>
          <Routes>
            {/* PUBLIC ROUTE */}
            <Route path="/login" element={<Login />} />

            {/* PROTECTED APP LAYOUT */}
            <Route path="/*" element={
              <ProtectedRoute>
                <div className="app-container">
                  <Topbar isDarkMode={isDarkMode} toggleTheme={toggleTheme} />
                  <Sidebar />
                  <main className="main-content">
                    <Routes>
                      <Route path="/" element={<Navigate to="/tasks" replace />} />
                      
                      {/* STANDARD USER ROUTES */}
                      <Route path="/tasks" element={<TaskDashboard />} />
                      <Route path="/dashboard" element={<ProjectDashboard />} />
                      <Route path="/leaderboard" element={<AcceptanceLeaderboard />} />
                      <Route path="/performance" element={<PerformanceLeaderboard />} />
                      <Route path="/qc" element={<QcDashboard />} />
                      <Route path="/qc-leaderboard" element={<QcLeaderboard />} />

                      {/* ADMIN ONLY ROUTES */}
                      <Route path="/teams" element={<ProtectedRoute adminOnly><TeamManagement /></ProtectedRoute>} />
                      <Route path="/settings" element={<ProtectedRoute adminOnly><AdminSettings /></ProtectedRoute>} />
                      <Route path="/sync" element={<ProtectedRoute adminOnly><SyncDataPage /></ProtectedRoute>} />
                    </Routes>
                  </main>
                </div>
              </ProtectedRoute>
            } />
          </Routes>
        </BrowserRouter>
      </SyncProvider>
    </QueryClientProvider>
  );
}