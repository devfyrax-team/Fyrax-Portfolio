import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell, Brand } from './components/AppShell';
import { useQueryClient } from '@tanstack/react-query';
import { canView, isHR, useAuth } from './auth';
import { Loading } from './components/ui';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Employees } from './pages/Employees';
import { EmployeeProfile } from './pages/EmployeeProfile';
import { Attendance } from './pages/Attendance';
import { Leave } from './pages/Leave';
import { Payroll } from './pages/Payroll';
import { Performance } from './pages/Performance';
import { Settings } from './pages/Settings';
import { Requests } from './pages/Requests';
import { Expenses } from './pages/Expenses';
import { Recruitment } from './pages/Recruitment';
import { Assets } from './pages/Assets';
import { Notifications } from './pages/Notifications';
import { ResetPassword } from './pages/ResetPassword';
import { Account } from './pages/Account';
import { PlatformLogin } from './pages/platform/PlatformLogin';
import { PlatformShell } from './pages/platform/PlatformShell';
import { Overview } from './pages/platform/Overview';
import { Companies } from './pages/platform/Companies';
import { CompanyDetail } from './pages/platform/CompanyDetail';
import { SuperAdmins, PlatformAccount } from './pages/platform/SuperAdmins';
import { AuditLog } from './pages/platform/AuditLog';
import { Billing } from './pages/platform/Billing';
import { Jobs } from './pages/platform/Jobs';
import { Invoices } from './pages/platform/Invoices';
import { useQuery } from '@tanstack/react-query';
import { api } from './api';

function Shell() {
  const { user, admin, logout } = useAuth();
  const qc = useQueryClient();
  // How many requests are waiting for this person: shown as a badge so approvers notice them.
  const waiting = useQuery({
    queryKey: ['inbox-count'],
    queryFn: () => api.get<{ total: number }>('/requests/inbox?pageSize=1'),
    enabled: !!user,
    refetchInterval: 60_000,
  });
  // The bell: how many notifications this person has not read yet.
  const unread = useQuery({
    queryKey: ['notif-count'],
    queryFn: () => api.get<{ unread: number }>('/notifications/unread-count'),
    enabled: !!user,
    refetchInterval: 30_000,
  });
  // Performance reviews waiting for this person: their own self-assessments and results, and appraisals to review.
  const perf = useQuery({
    queryKey: ['perf-count'],
    queryFn: () => api.get<{ total: number }>('/performance/pending-count'),
    enabled: !!user,
    refetchInterval: 60_000,
  });
  if (!user) return <Navigate to={admin ? '/platform' : '/login'} replace />; // a super admin has their own console

  const links = [
    { to: '/', label: 'Today', icon: 'home' as const, show: true },
    { to: '/attendance', label: 'Attendance', icon: 'clock' as const, show: true },
    { to: '/leave', label: 'Leave', icon: 'calendar' as const, show: true },
    { to: '/requests', label: 'Requests', icon: 'inbox' as const, show: true, badge: waiting.data?.total },
    { to: '/notifications', label: 'Notifications', icon: 'bell' as const, show: true, badge: unread.data?.unread },
    { to: '/expenses', label: 'Expenses', icon: 'card' as const, show: true },
    { to: '/payroll', label: 'Payroll', icon: 'wallet' as const, show: true },
    { to: '/performance', label: 'Performance', icon: 'star' as const, show: true, badge: perf.data?.total },
    { to: '/profile', label: 'My profile', icon: 'user' as const, show: true },
    { to: '/recruitment', label: 'Recruitment', icon: 'users' as const, show: canView(user.role) },
    { to: '/employees', label: isHR(user.role) ? 'Employees' : 'My team', icon: 'users' as const, show: canView(user.role) },
    { to: '/assets', label: 'Assets', icon: 'list' as const, show: isHR(user.role) },
    { to: '/settings', label: 'Settings', icon: 'settings' as const, show: isHR(user.role) },
  ];

  return (
    <AppShell
      label="Main"
      brand={<Brand />}
      links={links.filter((l) => l.show).map((l) => ({ to: l.to, label: l.label, icon: l.icon, end: l.to === '/', badge: l.badge }))}
      account={{
        email: user.email,
        role: user.role === 'HR' ? 'HR' : user.role.toLowerCase(),
        accountTo: '/account',
        onSignOut: () => {
          logout();
          qc.clear(); // never show the previous user's cached data to the next login
        },
      }}
    />
  );
}

export function App() {
  const { loading } = useAuth();
  if (loading) return <div className="auth"><Loading /></div>;
  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/platform/login" element={<PlatformLogin />} />
      <Route path="/platform" element={<PlatformShell />}>
        <Route index element={<Overview />} />
        <Route path="companies" element={<Companies />} />
        <Route path="companies/:id" element={<CompanyDetail />} />
        <Route path="billing" element={<Billing />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="admins" element={<SuperAdmins />} />
        <Route path="audit" element={<AuditLog />} />
        <Route path="jobs" element={<Jobs />} />
        <Route path="account" element={<PlatformAccount />} />
      </Route>
      <Route element={<Shell />}>
        <Route index element={<Dashboard />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="leave" element={<Leave />} />
        <Route path="requests" element={<Requests />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="account" element={<Account />} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="recruitment" element={<Recruitment />} />
        <Route path="assets" element={<Assets />} />
        <Route path="payroll" element={<Payroll />} />
        <Route path="performance" element={<Performance />} />
        <Route path="employees" element={<Employees />} />
        <Route path="employees/:id" element={<EmployeeProfile />} />
        <Route path="profile" element={<EmployeeProfile own />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
