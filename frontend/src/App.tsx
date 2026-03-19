import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './stores/authStore';

import Login from './pages/Authentication/Login';
import Signup from './pages/Authentication/Signup';
import LandingPage from './pages/Landing/LandingPage';
import Dashboard from './pages/Dashboard/Dashboard';
import OnboardingWizard from './pages/Onboarding/OnboardingWizard';
import ChecklistView from './pages/Checklist/ChecklistView';
import MeterManagementView from './pages/Meters/MeterManagementView';
import DataEntryView from './pages/DataEntry/DataEntryView';
import UserManagementView from './pages/Users/UserManagementView';
import DeveloperAdminView from './pages/DeveloperAdmin/DeveloperAdminView';
import MagicLinkVerify from './pages/Authentication/MagicLinkVerify';
import SetupAccount from './pages/Authentication/SetupAccount';
import SettingsView from './pages/Settings/SettingsView';
import ReportsView from './pages/Reports/ReportsView';
import HelpCenterView from './pages/Help/HelpCenterView';
import AccessDenied from './components/ui/AccessDenied';
import { canAccessPage } from './config/rbac';

const queryClient = new QueryClient();

function GlobalShortcuts() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ctrl + shift + d
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        navigate('/developer-admin');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, user]);

  return null;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, fetchUser, user } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    // If we have a token from persist but no user, fetch the user!
    if (useAuthStore.getState().accessToken && !user) {
      fetchUser();
    }
  }, [user, fetchUser]);

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 1. If they MUST reset their password, force them to /setup-account (unless already there)
  if (user && user.profile?.must_reset_password && location.pathname !== '/setup-account') {
    return <Navigate to="/setup-account" replace />;
  }

  // 2. If they don't have a company, force them to onboarding (unless they are resetting password or already onboarding)
  const allowedWithoutCompany = ['/onboarding', '/setup-account'];
  if (user && !user.profile?.company_id && !user.profile?.must_reset_password && !allowedWithoutCompany.includes(location.pathname)) {
    return <Navigate to="/onboarding" replace />;
  }

  // If user is not yet loaded but we are authenticated, wait!
  if (!user && isAuthenticated) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading profile...</span>
      </div>
    );
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function RequireRole({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const location = useLocation();

  if (!canAccessPage(user?.profile?.role, location.pathname)) {
    return (
      <AccessDenied 
        showLayout 
        title="Access Restricted" 
        message="You do not have the required permissions to view this page. If you believe this is an error, please contact your administrator." 
      />
    );
  }

  return <>{children}</>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <GlobalShortcuts />
        <Routes>
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />
          <Route
            path="/signup"
            element={
              <PublicRoute>
                <Signup />
              </PublicRoute>
            }
          />
          <Route
            path="/magic-link/:token"
            element={<MagicLinkVerify />}
          />
          <Route
            path="/setup-account"
            element={
              <RequireAuth>
                <SetupAccount />
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <RequireRole>
                  <Dashboard />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/onboarding"
            element={
              <RequireAuth>
                <RequireRole>
                  <OnboardingWizard />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/checklist"
            element={
              <RequireAuth>
                <RequireRole>
                  <ChecklistView />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/meters"
            element={
              <RequireAuth>
                <RequireRole>
                  <MeterManagementView />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/data-entry"
            element={
              <RequireAuth>
                <RequireRole>
                  <DataEntryView />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/users"
            element={
              <RequireAuth>
                <RequireRole>
                  <UserManagementView />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/settings"
            element={
              <RequireAuth>
                <RequireRole>
                  <SettingsView />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/reports"
            element={
              <RequireAuth>
                <RequireRole>
                  <ReportsView />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/help"
            element={
              <RequireAuth>
                <RequireRole>
                  <HelpCenterView />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/developer-admin"
            element={
              <RequireAuth>
                <RequireRole>
                  <DeveloperAdminView />
                </RequireRole>
              </RequireAuth>
            }
          />
          {/* Default redirect to dashboard (which handles auth redirect) */}
          {/* Default entry point */}
          <Route path="/" element={<LandingPage />} />

          {/* Catch all 404 */}
          <Route path="*" element={<div className="p-8 text-center text-xl text-gray-500">404 - Not Found</div>} />
        </Routes>
      </HashRouter>
    </QueryClientProvider>
  );
}

export default App;
