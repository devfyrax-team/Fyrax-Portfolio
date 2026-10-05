import { useEffect, useState, type ReactNode } from 'react'
import Checkout from './pages/Checkout'
import Products from './pages/Products'
import Reports from './pages/Reports'
import SettingsPage from './pages/SettingsPage'
import Bills from './pages/Bills'
import Login from './pages/Login'
import Purchasing from './pages/Purchasing'
import Activate from './pages/Activate'
import type { AuthState, LicenseStatus, Product, Role, Settings } from './types'
import { BrandMark, IconBag, IconBox, IconChart, IconChevronUp, IconLock, IconMonitor, IconMoon, IconReceipt, IconSettings, IconStack, IconSun, IconTag } from './icons'
import { applyTheme, getTheme, onThemeChange, type Theme } from './theme'

type Tab = 'Checkout' | 'Bills' | 'Products' | 'Purchasing' | 'Reports' | 'Settings'

const RANK: Record<Role, number> = { cashier: 1, manager: 2, owner: 3 }

const THEMES: { id: Theme; label: string; icon: ReactNode }[] = [
  { id: 'light', label: 'Light', icon: <IconSun size="sm" /> },
  { id: 'dark', label: 'Dark', icon: <IconMoon size="sm" /> },
  { id: 'system', label: 'Auto', icon: <IconMonitor size="sm" /> }
]

const MAIN_NAV: { id: Tab; label: string; icon: ReactNode; min: Role }[] = [
  { id: 'Checkout', label: 'Checkout', icon: <IconBag />, min: 'cashier' },
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
  const [products, setProducts] = useState<Product[]>([])
  const [category, setCategory] = useState<string>('All')
  const [catsOpen, setCatsOpen] = useState(true)
  const [theme, setTheme] = useState<Theme>(getTheme())
  useEffect(() => onThemeChange(setTheme), [])

  const reload = () => window.api.getSettings().then(setSettings)
  useEffect(() => {
    reload()
  }, [])
  useEffect(() => {
    window.api.searchProducts('').then(setProducts)
  }, [tab])

  const counts = new Map<string, number>()
  for (const p of products) {
    const c = p.category?.trim() || 'Uncategorised'
    counts.set(c, (counts.get(c) ?? 0) + 1)
  }
  const categories = [...counts.keys()].sort((a, b) => a.localeCompare(b))

  const openCategory = (c: string) => {
    setCategory(c)
    setTab('Checkout')
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <BrandMark />
          <div>
            <div className="brand-name" title={settings.shop_name}>{settings.shop_name || 'Hardware POS'}</div>
            <div className="brand-sub">Your POS assistant</div>
          </div>
        </div>

        <nav className="nav" aria-label="Main">
          {MAIN_NAV.filter((n) => RANK[user.role] >= RANK[n.min]).map((n) => (
            <button
              key={n.id}
              className={n.id === tab ? 'nav-item active' : 'nav-item'}
              aria-current={n.id === tab ? 'page' : undefined}
              onClick={() => setTab(n.id)}
            >
              {n.icon}
              {n.label}
            </button>
          ))}
        </nav>

        <nav className="nav" aria-label="Categories">
          <button className="nav-item nav-group-head" aria-expanded={catsOpen} onClick={() => setCatsOpen((o) => !o)}>
            <IconTag />
            Categories
            <IconChevronUp size="sm" className="icon sm chev" />
          </button>
          {catsOpen && (
            <div className="nav-sub">
              {categories.map((c) => (
                <button
                  key={c}
                  className={tab === 'Checkout' && category === c ? 'nav-item on' : 'nav-item'}
                  onClick={() => openCategory(c)}
                >
                  {c}
                  <span className="count">{counts.get(c)}</span>
                </button>
              ))}
              {!categories.length && <span className="muted" style={{ padding: '8px 10px', fontSize: 13 }}>No categories yet</span>}
            </div>
          )}
        </nav>

        <nav className="nav nav-foot" aria-label="System">
          {user.role === 'owner' && (
            <button
              className={tab === 'Settings' ? 'nav-item active' : 'nav-item'}
              aria-current={tab === 'Settings' ? 'page' : undefined}
              onClick={() => setTab('Settings')}
            >
              <IconSettings />
              Settings
            </button>
          )}
          <button className="nav-item user-chip" onClick={onLock} title="Lock and switch user">
            <IconLock />
            <span className="user-meta"><b>{user.name}</b><small>{user.role}</small></span>
            <span className="lock-label">Lock</span>
          </button>
          <div className="theme-switch" role="radiogroup" aria-label="Theme">
            {THEMES.map((t) => (
              <button
                key={t.id}
                role="radio"
                aria-checked={theme === t.id}
                title={t.id === 'system' ? 'Match Windows setting' : `${t.label} theme`}
                onClick={() => applyTheme(t.id)}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
        </nav>
      </aside>

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
