// No file system in the browser: reads find nothing, writes are ignored.
export const existsSync = () => false
export const mkdirSync = () => undefined
export const copyFileSync = () => undefined
export const renameSync = () => undefined
export const rmSync = () => undefined
export const readdirSync = () => [] as string[]
export const statSync = () => ({ size: 0, mtimeMs: 0 })
export const readFileSync = () => ''
export const writeFileSync = () => undefined
