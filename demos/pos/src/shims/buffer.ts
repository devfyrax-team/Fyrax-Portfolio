import { Buffer } from 'buffer'

// The main-process code uses Node's Buffer; the browser needs it on the global object.
;(globalThis as any).Buffer ??= Buffer
export { Buffer }
