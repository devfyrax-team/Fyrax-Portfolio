import { Navigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth';
import { AppShell, Brand } from '../../components/AppShell';

export function PlatformShell() {
  const { admin, user, logout } = useAuth();
  const qc = useQueryClient();
  if (user) return <Navigate to="/" replace />; // a company session has no business here
  if (!admin) return <Navigate to="/platform/login" replace />;

  const links = [
    { to: '/platform', label: 'Overview', icon: 'home' as const, end: true },
    { to: '/platform/companies', label: 'Companies', icon: 'building' as const },
    { to: '/platform/billing', label: 'Billing', icon: 'card' as const },
    { to: '/platform/invoices', label: 'Invoices', icon: 'wallet' as const },
    { to: '/platform/admins', label: 'Super admins', icon: 'shield' as const },
    { to: '/platform/audit', label: 'Audit log', icon: 'list' as const },
    { to: '/platform/jobs', label: 'Background jobs', icon: 'clock' as const },
    { to: '/platform/account', label: 'My account', icon: 'user' as const },
  ];

  return (
    <AppShell
      label="Platform"
      brand={<Brand sub="Platform" />}
      links={links}
      account={{ email: admin.email, role: 'super admin', onSignOut: () => { logout(); qc.clear(); } }}
    />
  );
}
