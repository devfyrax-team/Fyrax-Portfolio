import { useEffect, useState } from 'react'
import type { BackupInfo, LicenseStatus, Role, Settings, UserRow } from '../types'
import { LicensePanel } from './Activate'
import { applyTheme, getTheme, onThemeChange, type Theme } from '../theme'
import { testReceiptHtml } from '../util'
import { IconEdit, IconPlus, IconPrinter } from '../icons'

export default function SettingsPage({ settings, onSaved, meId, lic, onLicense }: { settings: Settings; onSaved: () => void; meId: number; lic: LicenseStatus; onLicense: (s: LicenseStatus) => void }) {
  const [s, setS] = useState<Settings>(settings)
  const [saved, setSaved] = useState(false)
  const [theme, setTheme] = useState<Theme>(getTheme())
  const [printers, setPrinters] = useState<{ name: string; label: string }[]>([])
  const [testMsg, setTestMsg] = useState('')
  const [sec, setSec] = useState<'Shop' | 'Printing' | 'Staff' | 'Backup' | 'Licence' | 'Appearance'>('Shop')
  useEffect(() => setS(settings), [settings])
  useEffect(() => onThemeChange(setTheme), [])
  useEffect(() => {
    window.api.listPrinters().then(setPrinters).catch(() => setPrinters([]))
  }, [])

  const set = (k: string, v: string) => {
    setSaved(false)
    setS((x) => ({ ...x, [k]: v }))
  }
  const save = async () => {
    await window.api.setSettings(s)
    setSaved(true)
    onSaved()
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Settings</h1>
          <div className="page-sub">Pick a section on the left</div>
        </div>
      </div>
      <div className="page-body settings">
        <nav className="set-nav" aria-label="Settings sections">
          {(['Shop', 'Printing', 'Staff', 'Backup', 'Licence', 'Appearance'] as const).map((t) => (
            <button key={t} className={t === sec ? 'set-item on' : 'set-item'} aria-current={t === sec ? 'page' : undefined} onClick={() => setSec(t)}>
              {t === 'Shop' ? 'Shop details' : t === 'Printing' ? 'Receipt printer' : t === 'Backup' ? 'Backup & restore' : t}
            </button>
          ))}
        </nav>
        <div className="set-body">
        {sec === 'Appearance' && <div className="card card-pad">
          <h3 className="card-title">Appearance</h3>
          <label className="field">Theme
            <select value={theme} onChange={(e) => applyTheme(e.target.value as Theme)}>
              <option value="system">Match Windows setting</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
        </div>}

        {sec === 'Shop' && <div className="card card-pad">
          <h3 className="card-title">Shop details</h3>
          <div className="form">
            <label className="field full">Shop name<input value={s.shop_name ?? ''} onChange={(e) => set('shop_name', e.target.value)} /></label>
            <label className="field full">Address<input value={s.shop_address ?? ''} onChange={(e) => set('shop_address', e.target.value)} /></label>
            <label className="field">Phone<input value={s.shop_phone ?? ''} onChange={(e) => set('shop_phone', e.target.value)} /></label>
            <label className="field">VAT rate (%) <span className="hint">0 if not VAT registered</span>
              <input type="number" min="0" step="0.01" value={s.vat_rate ?? '0'} onChange={(e) => set('vat_rate', e.target.value)} />
            </label>
            <label className="check full">
              <input type="checkbox" checked={s.vat_inclusive === '1'} onChange={(e) => set('vat_inclusive', e.target.checked ? '1' : '0')} />
              Prices already include VAT
            </label>
            <label className="field full">Receipt footer<input value={s.receipt_footer ?? ''} onChange={(e) => set('receipt_footer', e.target.value)} /></label>
          </div>
        </div>}

        {sec === 'Printing' && <div className="card card-pad">
          <h3 className="card-title">Receipt printer</h3>
          <div className="form">
            <label className="field full">Printer
              <select value={s.printer_name ?? ''} onChange={(e) => set('printer_name', e.target.value)}>
                <option value="">Windows default printer</option>
                {printers.map((p) => <option key={p.name} value={p.name}>{p.label}</option>)}
              </select>
            </label>
            <label className="field">Paper width
              <select value={s.paper_width ?? '80'} onChange={(e) => set('paper_width', e.target.value)}>
                <option value="80">80 mm</option>
                <option value="58">58 mm</option>
              </select>
            </label>
            <div />
            <label className="check full"><input type="checkbox" checked={s.auto_print !== '0'} onChange={(e) => set('auto_print', e.target.checked ? '1' : '0')} />Print the receipt automatically when a sale is completed</label>
            <label className="check full"><input type="checkbox" checked={s.print_silent !== '0'} onChange={(e) => set('print_silent', e.target.checked ? '1' : '0')} />Print without asking (skip the Windows print dialog)</label>
          </div>
          <div className="form-actions" style={{ marginTop: 16 }}>
            <button
              className="btn outline"
              onClick={async () => {
                await window.api.setSettings(s) // test with what is on screen
                onSaved()
                const r = await window.api.printReceipt(testReceiptHtml(s))
                setTestMsg(r.ok ? 'Test page sent to the printer.' : `Could not print: ${r.reason || 'unknown error'}`)
              }}
            >
              <IconPrinter /> Print test receipt
            </button>
            {testMsg && <span className="muted" role="status">{testMsg}</span>}
          </div>
          <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
            To open a cash drawer connected to the printer, turn on “open drawer” in the printer’s Windows driver settings.
          </p>
        </div>}

        {(sec === 'Shop' || sec === 'Printing') && <div className="form-actions">
          <button className="btn primary" onClick={save}>Save changes</button>
          {saved && <span className="ok-text" role="status">Saved</span>}
        </div>}

        {sec === 'Licence' && <div className="card card-pad">
          <h3 className="card-title">Licence</h3>
          {lic.state === 'licensed' ? (
            <>
              <div className="trow" style={{ marginBottom: 12 }}>
                <span>Licensed to <b>{lic.shop}</b></span>
                <span className="pill ok">Active{lic.expires ? ` until ${lic.expires}` : ''}</span>
              </div>
              <div className="field">Machine ID<code className="path machine-id">{lic.machineId}</code></div>
            </>
          ) : (
            <LicensePanel lic={lic} onDone={onLicense} />
          )}
        </div>}

        {sec === 'Staff' && <Staff meId={meId} />}
        {sec === 'Backup' && <Backup />}
        </div>
      </div>
    </div>
  )
}

const ROLE_LABEL: Record<Role, string> = { owner: 'Owner', manager: 'Manager', cashier: 'Cashier' }
const ROLE_HELP: Record<Role, string> = {
  owner: 'Everything, including settings, staff and backups',
  manager: 'Products, purchasing, reports and returns',
  cashier: 'Selling, bills and returns only. Cannot see costs or profit.'
}

function Staff({ meId }: { meId: number }) {
  const [users, setUsers] = useState<UserRow[]>([])
  const [edit, setEdit] = useState<{ id?: number; name: string; role: Role; pin: string; active: number } | null>(null)
  const [error, setError] = useState('')
  const load = () => window.api.listUsers().then(setUsers)
  useEffect(() => {
    load()
  }, [])

  const save = async () => {
    if (!edit) return
    try {
      await window.api.saveUser({ id: edit.id, name: edit.name, role: edit.role, pin: edit.pin || undefined, active: edit.active })
      setEdit(null)
      setError('')
      load()
    } catch (e: any) {
      setError(e.message)
    }
  }

  return (
    <div className="card card-pad">
      <div className="row-between">
        <h3 className="card-title">Staff</h3>
        <button className="btn sm outline" onClick={() => { setEdit({ name: '', role: 'cashier', pin: '', active: 1 }); setError('') }}><IconPlus size="sm" /> Add staff</button>
      </div>
      <table className="tbl plain">
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className={u.active ? '' : 'inactive'}>
              <td className="name">{u.name}{u.id === meId && <span className="muted"> (you)</span>}</td>
              <td><span className="pill info">{ROLE_LABEL[u.role]}</span></td>
              <td>{!u.active && <span className="pill warn">Inactive</span>}</td>
              <td className="r"><button className="icon-btn" aria-label={`Edit ${u.name}`} onClick={() => { setEdit({ id: u.id, name: u.name, role: u.role, pin: '', active: u.active }); setError('') }}><IconEdit /></button></td>
            </tr>
          ))}
        </tbody>
      </table>

      {edit && (
        <div className="overlay" onClick={() => setEdit(null)}>
          <div className="dialog small" role="dialog" aria-modal="true" aria-label={edit.id ? 'Edit staff' : 'Add staff'} onClick={(e) => e.stopPropagation()}>
            <h3>{edit.id ? 'Edit staff' : 'Add staff'}</h3>
            <div className="form" style={{ gridTemplateColumns: '1fr' }}>
              <label className="field">Name<input autoFocus value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></label>
              <label className="field">Role
                <select value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value as Role })}>
                  {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </select>
                <span className="hint">{ROLE_HELP[edit.role]}</span>
              </label>
              <label className="field">{edit.id ? 'New PIN' : 'PIN'} <span className="hint">{edit.id ? 'leave blank to keep the current PIN' : '4–6 digits'}</span>
                <input type="password" inputMode="numeric" maxLength={6} value={edit.pin} onChange={(e) => setEdit({ ...edit, pin: e.target.value.replace(/\D/g, '') })} />
              </label>
              {edit.id && edit.id !== meId && (
                <label className="check"><input type="checkbox" checked={!!edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked ? 1 : 0 })} />Can sign in</label>
              )}
            </div>
            {error && <p className="err" style={{ marginTop: 12 }} role="alert">{error}</p>}
            <div className="dialog-actions">
              <button className="btn" onClick={() => setEdit(null)}>Cancel</button>
              <button className="btn primary" onClick={save}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const fmtSize = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)

function Backup() {
  const [info, setInfo] = useState<BackupInfo | null>(null)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<string | null | undefined>(undefined) // undefined = closed, null = choose file
  const load = () => window.api.backupInfo().then(setInfo)
  useEffect(() => {
    load()
  }, [])

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setMsg('')
    setErr('')
    try {
      await fn()
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (!info) return null
  const last = info.last ? new Date(info.last) : null
  const stale = !last || Date.now() - last.getTime() > 3 * 86400_000

  return (
    <div className="card card-pad">
      <h3 className="card-title">Backup and restore</h3>
      <p className="muted" style={{ marginTop: 0 }}>
        Your sales and stock live only on this computer. Backups are saved automatically every day and when you close the app. Add a USB drive as a second location so a PC failure cannot lose your data.
      </p>
      <div className="trow" style={{ margin: '12px 0' }}>
        <span>Last backup</span>
        {last ? <span className={stale ? 'pill warn' : 'pill ok'}>{last.toLocaleString()}</span> : <span className="pill warn">Never</span>}
      </div>

      <div className="form" style={{ gridTemplateColumns: '1fr' }}>
        <div className="field">Main backup folder
          <div className="form-actions"><code className="path">{info.dirs[0]}</code>
            <button className="btn sm" onClick={() => run(async () => { await window.api.backupChooseDir(1); await load() })}>Change…</button></div>
        </div>
        <div className="field">Second location (USB drive or another disk)
          <div className="form-actions">
            <code className="path">{info.dirs[1] ?? 'Not set'}</code>
            <button className="btn sm" onClick={() => run(async () => { await window.api.backupChooseDir(2); await load() })}>{info.dirs[1] ? 'Change…' : 'Choose…'}</button>
            {info.dirs[1] && <button className="btn sm ghost" onClick={() => run(async () => { await window.api.backupClearDir2(); await load() })}>Remove</button>}
          </div>
        </div>
      </div>

      <div className="form-actions" style={{ marginTop: 16, flexWrap: 'wrap' }}>
        <button className="btn primary" disabled={busy} onClick={() => run(async () => {
          const r = await window.api.backupNow()
          if (r.failed.length) setErr(`Could not write to: ${r.failed.map((f) => f.dir).join(', ')}`)
          if (r.ok.length) setMsg(`Backed up to ${r.ok.length} location${r.ok.length > 1 ? 's' : ''}.`)
          await load()
        })}>Back up now</button>
        <button className="btn outline" disabled={busy} onClick={() => setConfirm(null)}>Restore from file…</button>
        {msg && <span className="ok-text" role="status">{msg}</span>}
      </div>
      {err && <p className="err" style={{ marginTop: 8 }} role="alert">{err}</p>}

      {info.backups.length > 0 && (
        <>
          <h4 className="sub-title">Recent backups</h4>
          <table className="tbl plain">
            <tbody>
              {info.backups.slice(0, 8).map((b) => (
                <tr key={b.path}>
                  <td className="name">{new Date(b.mtime).toLocaleString()}</td>
                  <td className="muted">{fmtSize(b.size)}</td>
                  <td className="muted path-cell" title={b.dir}>{b.dir}</td>
                  <td className="r"><button className="btn sm outline" onClick={() => setConfirm(b.path)}>Restore</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {confirm !== undefined && (
        <div className="overlay" onClick={() => setConfirm(undefined)}>
          <div className="dialog small" role="alertdialog" aria-modal="true" aria-label="Restore backup" onClick={(e) => e.stopPropagation()}>
            <h3>Restore this backup?</h3>
            <p className="muted">
              Everything entered after that backup will be replaced, and the app will restart. A copy of your current data is saved first, so you can undo this.
            </p>
            <div className="dialog-actions">
              <button className="btn" autoFocus onClick={() => setConfirm(undefined)}>Keep current data</button>
              <button className="btn danger" onClick={() => { const f = confirm; setConfirm(undefined); run(async () => { await window.api.backupRestore(f) }) }}>Restore and restart</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
