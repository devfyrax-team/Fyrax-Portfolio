import { checkLock, clearFails, getSession, hashPin, recordFail, setSession, validPin, verifyPin, type Role } from './auth'
import { db, seedSampleProducts } from './db'
import { handle, setSetting } from './ipc'

const ROLES: Role[] = ['owner', 'manager', 'cashier']

const activeUsers = () => db.prepare('SELECT id,name,role FROM users WHERE active = 1 ORDER BY name').all()
const hasUsers = () => (db.prepare('SELECT COUNT(*) c FROM users').get() as { c: number }).c > 0
const activeOwners = () => (db.prepare("SELECT COUNT(*) c FROM users WHERE role='owner' AND active=1").get() as { c: number }).c

export function registerUserIpc() {
  handle('auth:state', 'public', () => ({ hasUsers: hasUsers(), user: getSession(), users: activeUsers() }))

  handle('auth:setup', 'public', (_u, input: { ownerName: string; pin: string; shopName?: string; sample?: boolean }) => {
    if (hasUsers()) throw new Error('Setup has already been completed.')
    const name = (input.ownerName || '').trim()
    if (!name) throw new Error('Enter the owner name.')
    if (!validPin(input.pin)) throw new Error('The PIN must be 4 to 6 digits.')
    db.transaction(() => {
      db.prepare("INSERT INTO users(name,role,pin_hash) VALUES (?, 'owner', ?)").run(name, hashPin(input.pin))
      if (input.shopName?.trim()) setSetting('shop_name', input.shopName.trim())
      if (input.sample) seedSampleProducts()
    })()
    const u = db.prepare('SELECT id,name,role FROM users WHERE name = ?').get(name) as any
    setSession(u)
    return u
  })

  handle('auth:login', 'public', (_u, userId: number, pin: string) => {
    checkLock(userId)
    const row = db.prepare('SELECT id,name,role,pin_hash FROM users WHERE id = ? AND active = 1').get(userId) as any
    if (!row || !verifyPin(String(pin), row.pin_hash)) {
      if (row) recordFail(userId)
      throw new Error('Wrong PIN. Try again.')
    }
    clearFails(userId)
    const u = { id: row.id, name: row.name, role: row.role }
    setSession(u)
    return u
  })

  handle('auth:logout', 'public', () => setSession(null))

  handle('users:list', 'owner', () => db.prepare('SELECT id,name,role,active FROM users ORDER BY active DESC, name').all())

  handle('users:save', 'owner', (me, u: { id?: number; name: string; role: Role; pin?: string; active?: number }) => {
    const name = (u.name || '').trim()
    if (!name) throw new Error('Enter a name.')
    if (!ROLES.includes(u.role)) throw new Error('Choose a role.')
    if (u.pin && !validPin(u.pin)) throw new Error('The PIN must be 4 to 6 digits.')
    const active = u.active === 0 ? 0 : 1
    try {
      if (u.id) {
        const cur = db.prepare('SELECT role,active FROM users WHERE id = ?').get(u.id) as any
        if (!cur) throw new Error('User not found.')
        const losingOwner = cur.role === 'owner' && cur.active === 1 && (u.role !== 'owner' || active === 0)
        if (losingOwner && activeOwners() <= 1) throw new Error('There must be at least one active owner.')
        if (u.id === me!.id && active === 0) throw new Error('You cannot deactivate your own account.')
        db.prepare('UPDATE users SET name=?, role=?, active=? WHERE id=?').run(name, u.role, active, u.id)
        if (u.pin) db.prepare('UPDATE users SET pin_hash=? WHERE id=?').run(hashPin(u.pin), u.id)
        if (u.id === me!.id) setSession({ id: me!.id, name, role: u.role })
      } else {
        if (!u.pin) throw new Error('Set a PIN for the new user.')
        db.prepare('INSERT INTO users(name,role,pin_hash) VALUES (?,?,?)').run(name, u.role, hashPin(u.pin))
      }
    } catch (e: any) {
      if (/UNIQUE/.test(e.message)) throw new Error('Another user already has that name.')
      throw e
    }
  })
}
