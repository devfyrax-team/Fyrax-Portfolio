import { useEffect, useState, type ReactNode } from 'react'
import Checkout from './pages/Checkout'
import Products from './pages/Products'
import Reports from './pages/Reports'
import SettingsPage from './pages/SettingsPage'
import Bills from './pages/Bills'
import Login from './pages/Login'
import Purchasing from './pages/Purchasing'
import Activate from './pages/Activate'
import type { AuthState, LicenseStatus, Role, Settings } from './types'
import { BrandMark, IconBag, IconBox, IconChart, IconLock, IconMonitor, IconMoon, IconReceipt, IconStack, IconSun } from './icons'
import { applyTheme, getTheme, onThemeChange, type Theme } from './theme'

type Tab = 'Checkout' | 'Bills' | 'Products' | 'Purchasing' | 'Reports' | 'Settings'

const RANK: Record<Role, number> = { cashier: 1, manager: 2, owner: 3 }

const THEMES: { id: Theme; label: string; icon: ReactNode }[] = [
  { id: 'light', label: 'Light', icon: <IconSun size="sm" /> },
  { id: 'dark', label: 'Dark', icon: <IconMoon size="sm" /> },
  { id: 'system', label: 'Auto', icon: <IconMonitor size="sm" /> }
]

const MAIN_NAV: { id: Tab; label: string; icon: ReactNode; min: Role }[] = [
  { id: 'Checkout', label: 'Sell', icon: <IconBag />, min: 'cashier' },
  { id: 'Bills', label: 'Bills & returns', icon: <IconReceipt />, min: 'cashier' },
  { id: 'Products', label: 'Products', icon: <IconBox />, min: 'manager' },
  { id: 'Purchasing', label: 'Purchasing', icon: <IconStack />, min: 'manager' },
  { id: 'Reports', label: 'Reports', icon: <IconChart />, min: 'manager' }
]

export default function App() {
  const [lic, setLic] = useState<LicenseStatus | null>(null)
  const [auth, setAuth] = useState<AuthState | null>(null)
  const refreshAuth = () => window.api.authState().then(setAuth)
  const usable = lic?.state === 'licensed' || lic?.state === 'trial'
  useEffect(() => {
    window.api.licenseStatus().then(setLic)
  }, [])
  useEffect(() => {
    if (usable) refreshAuth()
  }, [usable])

  if (!lic) return null
  if (!usable) return <Activate lic={lic} onDone={setLic} />
  if (!auth) return null
  if (!auth.user) return <Login state={auth} onDone={refreshAuth} />
  return (
    <Shell
      lic={lic}
      onLicense={setLic}
      user={auth.user}
      onLock={async () => {
        await window.api.logout()
        refreshAuth()
      }}
    />
  )
}

function Shell({ user, onLock, lic, onLicense }: { user: NonNullable<AuthState['user']>; onLock: () => void; lic: LicenseStatus; onLicense: (s: LicenseStatus) => void }) {
  const [tab, setTab] = useState<Tab>('Checkout')
  const [settings, setSettings] = useState<Settings>({})
  const [category, setCategory] = useState<string>('All')
  const [theme, setTheme] = useState<Theme>(getTheme())
  useEffect(() => onThemeChange(setTheme), [])

  const reload = () => window.api.getSettings().then(setSettings)
  useEffect(() => {
    reload()
  }, [])
  const nextTheme: Record<Theme, Theme> = { light: 'dark', dark: 'system', system: 'light' }
  const cur = THEMES.find((t) => t.id === theme)!
  const initial = (user.name || '?').trim().charAt(0).toUpperCase()

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <BrandMark />
          <div className="brand-name" title={settings.shop_name}>{settings.shop_name || 'Hardware POS'}</div>
        </div>

        <nav className="topnav" aria-label="Main">
          {MAIN_NAV.filter((n) => RANK[user.role] >= RANK[n.min]).map((n) => (
            <button key={n.id} className={n.id === tab ? 'topnav-item active' : 'topnav-item'} aria-current={n.id === tab ? 'page' : undefined} onClick={() => setTab(n.id)}>
              {n.label}
            </button>
          ))}
          {user.role === 'owner' && (
            <button className={tab === 'Settings' ? 'topnav-item active' : 'topnav-item'} aria-current={tab === 'Settings' ? 'page' : undefined} onClick={() => setTab('Settings')}>
              Settings
            </button>
          )}
        </nav>

        <button className="btn sm theme-btn" title={`Theme: ${cur.label}. Click to change.`} aria-label={`Theme: ${cur.label}. Click to change.`} onClick={() => applyTheme(nextTheme[theme])}>
          {cur.icon}
          {cur.label}
        </button>
        <button className="user-pill" onClick={onLock} title="Lock and switch user">
          <span className="avatar">{initial}</span>
          <span className="user-meta"><b>{user.name}</b><small>{user.role}</small></span>
          <IconLock size="sm" />
        </button>
      </header>

      <main className="content">
        {lic.state === 'trial' && (
          <div className="trial-bar" role="status">
            <span>Free trial: <b>{lic.daysLeft} {lic.daysLeft === 1 ? 'day' : 'days'} left</b>.</span>
            {user.role === 'owner' ? (
              <button className="btn sm" onClick={() => setTab('Settings')}>Enter activation key</button>
            ) : (
              <span className="muted">Ask the owner to activate.</span>
            )}
          </div>
        )}
        {tab === 'Checkout' && <Checkout settings={settings} category={category} onCategory={setCategory} />}
        {tab === 'Bills' && <Bills settings={settings} />}
        {tab === 'Products' && RANK[user.role] >= 2 && <Products />}
        {tab === 'Purchasing' && RANK[user.role] >= 2 && <Purchasing />}
        {tab === 'Reports' && RANK[user.role] >= 2 && <Reports />}
        {tab === 'Settings' && user.role === 'owner' && <SettingsPage settings={settings} onSaved={reload} meId={user.id} lic={lic} onLicense={onLicense} />}
      </main>
    </div>
  )
}
