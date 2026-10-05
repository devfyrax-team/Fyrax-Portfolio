import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'

export type Role = 'owner' | 'manager' | 'cashier'
export interface SessionUser {
  id: number
  name: string
  role: Role
}

const RANK: Record<Role, number> = { cashier: 1, manager: 2, owner: 3 }

let session: SessionUser | null = null

export const getSession = () => session
export const setSession = (u: SessionUser | null) => {
  session = u
}

export function requireRole(min: Role): SessionUser {
  if (!session) throw new Error('Please sign in first.')
  if (RANK[session.role] < RANK[min]) throw new Error('You do not have permission to do that.')
  return session
}

export const isAtLeast = (min: Role) => !!session && RANK[session.role] >= RANK[min]

export function hashPin(pin: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(pin, salt, 32)
  return `${salt.toString('hex')}:${hash.toString('hex')}`
}

export function verifyPin(pin: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(':')
  if (!saltHex || !hashHex) return false
  const expected = Buffer.from(hashHex, 'hex')
  const actual = scryptSync(pin, Buffer.from(saltHex, 'hex'), expected.length)
  return timingSafeEqual(expected, actual)
}

export const validPin = (pin: unknown): pin is string => typeof pin === 'string' && /^\d{4,6}$/.test(pin)

// Slow down PIN guessing: 5 wrong tries locks that user for 30 seconds.
const fails = new Map<number, { n: number; until: number }>()
export function checkLock(userId: number) {
  const f = fails.get(userId)
  if (f && f.until > Date.now()) throw new Error(`Too many wrong PINs. Try again in ${Math.ceil((f.until - Date.now()) / 1000)} seconds.`)
}
export function recordFail(userId: number) {
  const f = fails.get(userId) ?? { n: 0, until: 0 }
  f.n += 1
  if (f.n >= 5) {
    f.n = 0
    f.until = Date.now() + 30_000
  }
  fails.set(userId, f)
}
export const clearFails = (userId: number) => fails.delete(userId)
