import { useState } from 'react'
import type { LicenseStatus } from '../types'
import { BrandMark } from '../icons'

/** Machine ID + activation key box. Used on the blocking Activate screen and inside Settings. */
export function LicensePanel({ lic, onDone }: { lic: LicenseStatus; onDone: (s: LicenseStatus) => void }) {
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(lic.machineId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* the ID is also shown on screen to copy by hand */
    }
  }

  const activate = async () => {
    setError('')
    setBusy(true)
    try {
      onDone(await window.api.activateLicense(token))
      setToken('')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="form" style={{ gridTemplateColumns: '1fr' }}>
      <div className="field">
        This computer’s Machine ID
        <div className="form-actions">
          <code className="path machine-id">{lic.machineId}</code>
          <button type="button" className="btn sm" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
        </div>
        <span className="hint">Send this ID to get an activation key. A key works on this computer only.</span>
      </div>
      <label className="field">
        Activation key
        <textarea rows={3} spellCheck={false} placeholder="Paste the key here" value={token} onChange={(e) => setToken(e.target.value)} />
      </label>
      {error && <p className="err" role="alert">{error}</p>}
      <div className="form-actions">
        <button className="btn primary" disabled={busy || token.trim().length < 20} onClick={activate}>Activate</button>
      </div>
    </div>
  )
}

export default function Activate({ lic, onDone }: { lic: LicenseStatus; onDone: (s: LicenseStatus) => void }) {
  return (
    <div className="login">
      <div className="card login-card activate-card">
        <BrandMark />
        <h1>Activate this computer</h1>
        <p className="muted">{lic.problem ?? 'Enter your activation key to start using the system.'}</p>
        <div style={{ width: '100%', textAlign: 'left' }}>
          <LicensePanel lic={lic} onDone={onDone} />
        </div>
      </div>
    </div>
  )
}
