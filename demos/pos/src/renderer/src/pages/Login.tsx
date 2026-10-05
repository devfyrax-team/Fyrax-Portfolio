import { useEffect, useRef, useState } from 'react'
import type { AuthState, User } from '../types'
import { BrandMark } from '../icons'

function PinPad({ value, onChange, onEnter, disabled }: { value: string; onChange: (v: string) => void; onEnter: () => void; disabled?: boolean }) {
  const press = (d: string) => value.length < 6 && onChange(value + d)
  return (
    <div className="pinpad">
      <div className="pin-dots" aria-label={`${value.length} digits entered`}>
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} className={i < value.length ? 'dot on' : 'dot'} />
        ))}
      </div>
      <div className="keys">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} type="button" className="key" disabled={disabled} onClick={() => press(d)}>{d}</button>
        ))}
        <button type="button" className="key sec" disabled={disabled} onClick={() => onChange(value.slice(0, -1))} aria-label="Delete last digit">⌫</button>
        <button type="button" className="key" disabled={disabled} onClick={() => press('0')}>0</button>
        <button type="button" className="key go" disabled={disabled || value.length < 4} onClick={onEnter}>Sign in</button>
      </div>
    </div>
  )
}

export default function Login({ state, onDone }: { state: AuthState; onDone: () => void }) {
  return (
    <div className="login">
      <div className="card login-card">
        <BrandMark />
        {state.hasUsers ? <SignIn users={state.users} onDone={onDone} /> : <Setup onDone={onDone} />}
      </div>
    </div>
  )
}

function SignIn({ users, onDone }: { users: User[]; onDone: () => void }) {
  const [userId, setUserId] = useState<number | null>(users.length === 1 ? users[0].id : null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const pinRef = useRef(pin)
  pinRef.current = pin

  const submit = async () => {
    if (userId == null || pinRef.current.length < 4 || busy) return
    setBusy(true)
    try {
      await window.api.login(userId, pinRef.current)
      onDone()
    } catch (e: any) {
      setError(e.message)
      setPin('')
    } finally {
      setBusy(false)
    }
  }

  // Physical keyboard: digits, Backspace, Enter
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (userId == null) return
      if (/^\d$/.test(e.key)) setPin((p) => (p.length < 6 ? p + e.key : p))
      else if (e.key === 'Backspace') setPin((p) => p.slice(0, -1))
      else if (e.key === 'Enter') submit()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [userId, busy])

  return (
    <>
      <h1>Who is selling?</h1>
      <p className="muted">{userId == null ? 'Tap your name to start' : 'Enter your PIN, 4 to 6 digits'}</p>
      <div className="who-list" role="radiogroup" aria-label="Staff member">
        {users.map((u) => (
          <button
            key={u.id}
            role="radio"
            aria-checked={u.id === userId}
            className={u.id === userId ? 'who on' : 'who'}
            onClick={() => {
              setUserId(u.id)
              setPin('')
              setError('')
            }}
          >
            <span className="avatar lg">{u.name.trim().charAt(0).toUpperCase()}</span>
            <b>{u.name}</b>
            <small>{u.role}</small>
          </button>
        ))}
      </div>
      {userId != null && <PinPad value={pin} onChange={(v) => { setPin(v); setError('') }} onEnter={submit} disabled={busy} />}
      {error && <p className="err" role="alert">{error}</p>}
    </>
  )
}

function Setup({ onDone }: { onDone: () => void }) {
  const [shopName, setShopName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [sample, setSample] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!ownerName.trim()) return setError('Enter the owner name.')
    if (!/^\d{4,6}$/.test(pin)) return setError('The PIN must be 4 to 6 digits.')
    if (pin !== pin2) return setError('The two PINs do not match.')
    try {
      await window.api.setup({ ownerName, pin, shopName, sample })
      onDone()
    } catch (e: any) {
      setError(e.message)
    }
  }

  return (
    <form
      className="form login-form"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <div className="full">
        <h1>Welcome</h1>
        <p className="muted">Set up your shop and the owner account. You can add cashiers and managers later in Settings.</p>
      </div>
      <label className="field full">Shop name<input autoFocus value={shopName} onChange={(e) => setShopName(e.target.value)} /></label>
      <label className="field full">Owner name<input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} /></label>
      <label className="field">PIN <span className="hint">4–6 digits</span><input type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} /></label>
      <label className="field">Confirm PIN<input type="password" inputMode="numeric" maxLength={6} value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))} /></label>
      <label className="check full"><input type="checkbox" checked={sample} onChange={(e) => setSample(e.target.checked)} />Add a few sample products so I can try it out</label>
      {error && <p className="err full" role="alert">{error}</p>}
      <button className="btn primary lg full" type="submit">Create shop and start</button>
    </form>
  )
}
