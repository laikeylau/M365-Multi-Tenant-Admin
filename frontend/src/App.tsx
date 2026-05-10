import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import UsersPage from './pages/Users';
import TenantsPage from './pages/Tenants';
import LicensesPage from './pages/Licenses';
import GroupsPage from './pages/Groups';
import DomainsPage from './pages/Domains';
import AuditPage from './pages/Audit';
import HealthPage from './pages/Health';
import ReportsPage from './pages/Reports';
import StoragePage from './pages/Storage';
import SettingsPage from './pages/Settings';
import LoginPage from './pages/Login';
import HealthReportPage from './pages/HealthReport';
import ReportCenterPage from './pages/ReportCenter';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            retry: 1,
        },
    },
});

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isAuthenticated } = useAuth();
    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }
    return <>{children}</>;
};

const AppRoutes: React.FC = () => {
    const { isAuthenticated, loading } = useAuth();

    if (loading) {
        return (
            <div style={{
                height: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--gray-100)'
            }}>
                <div className="spinner" style={{ width: '40px', height: '40px' }}></div>
            </div>
        );
    }

    return (
        <Routes>
            <Route path="/login" element={
                isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />
            } />
            <Route path="/" element={
                <ProtectedRoute>
                    <Layout />
                </ProtectedRoute>
            }>
                <Route index element={<Dashboard />} />
                <Route path="users" element={<UsersPage />} />
                <Route path="users/invite" element={<UsersPage />} />
                <Route path="users/import" element={<UsersPage />} />
                <Route path="tenants" element={<TenantsPage />} />
                <Route path="licenses" element={<LicensesPage />} />
                <Route path="groups" element={<GroupsPage />} />
                <Route path="domains" element={<DomainsPage />} />
                <Route path="audit" element={<AuditPage />} />
                <Route path="health" element={<HealthPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="storage" element={<StoragePage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="health-report" element={<HealthReportPage />} />
                <Route path="report-center" element={<ReportCenterPage />} />
            </Route>
        </Routes>
    );
};

const App: React.FC = () => {
    return (
        <QueryClientProvider client={queryClient}>
            <BrowserRouter>
                <AuthProvider>
                    <AppRoutes />
                </AuthProvider>
            </BrowserRouter>
        </QueryClientProvider>
    );
};

export default App;
