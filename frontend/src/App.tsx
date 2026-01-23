import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PermissionsProvider } from './contexts/PermissionsContext';
import { LoginPage } from './pages/Login';
import { RegisterPage } from './pages/Register';
import { DashboardPage } from './pages/Dashboard';
import { MediaLibraryPage } from './pages/MediaLibrary';
import { FileDetailRedirectPage } from './pages/FileDetailRedirectPage';
import { AnalyticsPage } from './pages/Analytics';
import { EditorsPage } from './pages/Editors';
import { AdminPage } from './pages/Admin';
import { RBACAdminPanel } from './pages/RBACAdminPanel';
import { ActivityLogsPage } from './pages/ActivityLogs';
import { MetadataExtraction } from './pages/MetadataExtraction';
import { TeamsPageEnhanced as TeamsPage } from './pages/TeamsPageEnhanced';
import { StarredPage } from './pages/StarredPage';
import { DeletedFilesPage } from './pages/DeletedFilesPage';
import { RecentsPage } from './pages/RecentsPage';
import { SharedByMePage } from './pages/SharedByMePage';
import { SharedWithMePage } from './pages/SharedWithMePage';
import { SmartCollectionsPage } from './pages/SmartCollectionsPage';
import { PublicLinkPage } from './pages/PublicLinkPage';
import { FileRequestsPage } from './pages/FileRequestsPage';
import { PublicFileRequestPage } from './pages/PublicFileRequestPage';
import { UserSettingsPage } from './pages/UserSettings';
import { ActivityLogExportPage } from './pages/ActivityLogExport';
import { WorkloadDashboardPage } from './pages/WorkloadDashboardPage';
import { AccessRequestsPage } from './pages/AccessRequestsPage';
import { UploadStatusSidebar } from './components/UploadStatusSidebar';
import { UploadNotifications } from './components/UploadNotifications';

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
      {/* Public link routes - no auth required */}
      <Route path="/s/:token" element={<PublicLinkPage />} />
      <Route path="/request/:token" element={<PublicFileRequestPage />} />

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
      {/* Deep link route for Slack file sharing - must come before /media */}
      <Route
        path="/media/:fileId"
        element={
          <PrivateRoute>
            <FileDetailRedirectPage />
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
        path="/starred"
        element={
          <PrivateRoute>
            <StarredPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/recents"
        element={
          <PrivateRoute>
            <RecentsPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/trash"
        element={
          <PrivateRoute>
            <DeletedFilesPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/shared-by-me"
        element={
          <PrivateRoute>
            <SharedByMePage />
          </PrivateRoute>
        }
      />
      <Route
        path="/shared-with-me"
        element={
          <PrivateRoute>
            <SharedWithMePage />
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
        path="/rbac-admin"
        element={
          <AdminRoute>
            <RBACAdminPanel />
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
        path="/activity-log-export"
        element={
          <AdminRoute>
            <ActivityLogExportPage />
          </AdminRoute>
        }
      />
      <Route
        path="/workload"
        element={
          <AdminRoute>
            <WorkloadDashboardPage />
          </AdminRoute>
        }
      />
      <Route
        path="/metadata"
        element={
          <AdminRoute>
            <MetadataExtraction />
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
      <Route
        path="/collections"
        element={
          <PrivateRoute>
            <SmartCollectionsPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/file-requests"
        element={
          <PrivateRoute>
            <FileRequestsPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/access-requests"
        element={
          <PrivateRoute>
            <AccessRequestsPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <PrivateRoute>
            <UserSettingsPage />
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
        <PermissionsProvider>
          <AppRoutes />
          <UploadStatusSidebar />
          <UploadNotifications />
        </PermissionsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
