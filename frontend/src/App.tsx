import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginPage } from './pages/Login';
import { RegisterPage } from './pages/Register';
import { DashboardPage } from './pages/Dashboard';
import { MediaLibraryPage } from './pages/MediaLibrary';
import { AnalyticsPage } from './pages/Analytics';
import { EditorsPage } from './pages/Editors';
import { AdminPage } from './pages/Admin';
import { ActivityLogsPage } from './pages/ActivityLogs';
import { MetadataManagement } from './pages/MetadataManagement';
import { TeamsPage } from './pages/TeamsPage';

function PrivateRoute({ children }: { children: React.ReactElement }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return user ? children : <Navigate to="/login" />;
}

function PublicRoute({ children }: { children: React.ReactElement }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return !user ? children : <Navigate to="/" />;
}

function AdminRoute({ children }: { children: React.ReactElement }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (user.role !== 'admin') {
    return <Navigate to="/" />;
  }

  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <RegisterPage />
          </PublicRoute>
        }
      />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <DashboardPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/media"
        element={
          <PrivateRoute>
            <MediaLibraryPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/analytics"
        element={
          <AdminRoute>
            <AnalyticsPage />
          </AdminRoute>
        }
      />
      <Route
        path="/editors"
        element={
          <AdminRoute>
            <EditorsPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminPage />
          </AdminRoute>
        }
      />
      <Route
        path="/activity-logs"
        element={
          <AdminRoute>
            <ActivityLogsPage />
          </AdminRoute>
        }
      />
      <Route
        path="/metadata"
        element={
          <AdminRoute>
            <MetadataManagement />
          </AdminRoute>
        }
      />
      <Route
        path="/teams"
        element={
          <PrivateRoute>
            <TeamsPage />
          </PrivateRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
