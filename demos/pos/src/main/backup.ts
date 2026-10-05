// Demo build: backups need a file system, which the browser does not have. These handlers report "nothing to show".
import { handle } from './ipc'

export const backupDirs = (): string[] => []
export const backupNow = (_tag = ''): { ok: string[]; failed: { dir: string; error: string }[] } => ({ ok: [], failed: [] })

export function registerBackupIpc() {
  handle('backup:info', 'owner', () => ({ dirs: [], defaultDir: 'Not available in the demo', last: '', backups: [] }))
  handle('backup:now', 'owner', () => ({ ok: [], failed: [{ dir: 'Demo', error: 'Backups are disabled in the online demo.' }] }))
  handle('backup:chooseDir', 'owner', () => null)
  handle('backup:clearDir2', 'owner', () => undefined)
  handle('backup:restore', 'owner', () => false)
}
