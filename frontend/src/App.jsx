import { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import './index.css';

import Topbar from './components/Topbar/Topbar';
import Sidebar from './components/Sidebar/Sidebar';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './components/Login';

import { SyncProvider } from './context/SyncContext';

// =========================
// PROJECTS
// =========================
import TaskDashboard from './components/TaskDashboard';

// =========================
// REPORTS
// =========================
import ProjectDashboard from './components/ProjectDashboard';
import AcceptanceLeaderboard from './components/AcceptanceLeaderboard';
import PerformanceLeaderboard from './components/PerformanceLeaderboard';

// =========================
// QUALITY CONTROL
// =========================
import QcDashboard from './components/QcDashboard';
import QcLeaderboard from './components/QcLeaderboard';
import AnomalyDashboard from './components/AnomalyDashboard';

// =========================
// MANAGEMENT
// =========================
import TeamManagement from './components/TeamManagement';
import AttendanceDashboard from './components/AttendanceDashboard';

// =========================
// ADMIN
// =========================
import SyncDataPage from './components/SyncDataPage';
import AdminSettings from './components/AdminSettings';
import UserManagement from './components/UserManagement';

const queryClient = new QueryClient();

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(
    () => localStorage.getItem('theme') === 'dark'
  );

  useEffect(() => {
    document.body.classList.toggle('dark-mode', isDarkMode);
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <SyncProvider>
        <BrowserRouter>
          <Routes>

            {/* =========================
                PUBLIC ROUTES
            ========================= */}
            <Route path="/login" element={<Login />} />

            {/* =========================
                PROTECTED APP
            ========================= */}
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <div className="app-container">
                    <Topbar
                      isDarkMode={isDarkMode}
                      toggleTheme={toggleTheme}
                    />

                    <Sidebar />

                    <main className="main-content">
                      <Routes>

                        {/* DEFAULT REDIRECT */}
                        <Route
                          path="/"
                          element={<Navigate to="/tasks" replace />}
                        />

                        {/* =====================================================
                            PROJECTS
                            ACCESS: EVERYONE
                        ===================================================== */}
                        <Route
                          path="/tasks"
                          element={<TaskDashboard />}
                        />

                        {/* =====================================================
                            REPORTS
                            ACCESS: EVERYONE
                        ===================================================== */}
                        <Route
                          path="/dashboard"
                          element={<ProjectDashboard />}
                        />

                        <Route
                          path="/leaderboard"
                          element={<AcceptanceLeaderboard />}
                        />

                        <Route
                          path="/performance"
                          element={<PerformanceLeaderboard />}
                        />

                        {/* =====================================================
                            QUALITY CONTROL
                            ACCESS: CORE TEAM + ADMIN
                        ===================================================== */}
                        <Route
                          path="/qc"
                          element={
                            <ProtectedRoute
                              allowedRoles={['ADMIN', 'CORE_TEAM']}
                            >
                              <QcDashboard />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/qc-leaderboard"
                          element={
                            <ProtectedRoute
                              allowedRoles={['ADMIN', 'CORE_TEAM']}
                            >
                              <QcLeaderboard />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/anomalies"
                          element={
                            <ProtectedRoute
                              allowedRoles={['ADMIN', 'CORE_TEAM']}
                            >
                              <AnomalyDashboard />
                            </ProtectedRoute>
                          }
                        />

                        {/* =====================================================
                            MANAGEMENT
                            ACCESS: ADMIN
                        ===================================================== */}
                        <Route
                          path="/teams"
                          element={
                            <ProtectedRoute
                              allowedRoles={['ADMIN']}
                            >
                              <TeamManagement />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/attendance"
                          element={
                            <ProtectedRoute
                              allowedRoles={['ADMIN']}
                            >
                              <AttendanceDashboard />
                            </ProtectedRoute>
                          }
                        />

                        {/* =====================================================
                            ADMIN
                            ACCESS: ADMIN
                        ===================================================== */}
                        <Route
                          path="/sync"
                          element={
                            <ProtectedRoute
                              allowedRoles={['ADMIN']}
                            >
                              <SyncDataPage />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/settings"
                          element={
                            <ProtectedRoute
                              allowedRoles={['ADMIN']}
                            >
                              <AdminSettings />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/users"
                          element={
                            <ProtectedRoute
                              allowedRoles={['ADMIN']}
                            >
                              <UserManagement />
                            </ProtectedRoute>
                          }
                        />

                      </Routes>
                    </main>
                  </div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </SyncProvider>
    </QueryClientProvider>
  );
}