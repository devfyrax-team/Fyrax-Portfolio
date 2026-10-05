// Just enough of Electron for the main-process modules to load: IPC handlers are kept in a map and called directly.
type Listener = (event: unknown, ...args: any[]) => unknown
export const handlers = new Map<string, Listener>()

export const ipcMain = {
  handle(channel: string, fn: Listener) {
    handlers.set(channel, fn)
  }
}

export const app = { getPath: (_name: string) => '/demo' }

export const BrowserWindow = {
  getFocusedWindow: () => null,
  getAllWindows: () => [] as unknown[]
}

export const dialog = {
  showOpenDialog: async (..._a: unknown[]) => ({ canceled: true, filePaths: [] as string[] }),
  showSaveDialog: async (..._a: unknown[]) => ({ canceled: true, filePath: undefined as string | undefined })
}

export const nativeImage = {
  createFromPath: () => ({ isEmpty: () => true })
}
