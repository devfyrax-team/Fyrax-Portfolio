import { ipcMain } from 'electron'
import { requireRole, getSession, type Role, type SessionUser } from './auth'
import { db } from './db'
import { licenseOk } from './license'

/** 'public' = no sign-in needed, 'any' = any signed-in user, otherwise the minimum role. */
export type Access = 'public' | 'any' | Role

export function handle(channel: string, access: Access, fn: (user: SessionUser | null, ...args: any[]) => unknown) {
  ipcMain.handle(channel, (_e, ...args) => {
    if (!licenseOk()) throw new Error('This copy is not activated. Enter your activation key to continue.')
    let user = getSession()
    if (access === 'any') user = requireRole('cashier')
    else if (access !== 'public') user = requireRole(access)
    return fn(user, ...args)
  })
}

export const money = (n: number) => Math.round(n * 100) / 100

export function getSettings(): Record<string, string> {
  const rows = db.prepare('SELECT key,value FROM settings').all() as { key: string; value: string }[]
  return Object.fromEntries(rows.map((r) => [r.key, r.value]))
}

export function setSetting(key: string, value: string) {
  db.prepare('INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value)
}

export const ymd = (d = new Date()) =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`

/** Next document number for a day, e.g. nextNo('sales','receipt_no','', 4) -> 20261004-0001 */
export function nextNo(table: string, col: string, prefix: string, pad: number) {
  const day = ymd()
  const like = `${prefix}${day}-%`
  const n = (db.prepare(`SELECT COUNT(*) c FROM ${table} WHERE ${col} LIKE ?`).get(like) as { c: number }).c + 1
  return `${prefix}${day}-${String(n).padStart(pad, '0')}`
}
