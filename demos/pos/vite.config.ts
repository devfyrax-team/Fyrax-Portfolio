import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const shim = (name: string) => resolve(__dirname, 'src/shims', name)

// The app's main-process code is reused as-is; Node and Electron modules are swapped for browser stand-ins.
export default defineConfig({
  base: '/demos/pos/',
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^node:sqlite$/, replacement: shim('sqlite.ts') },
      { find: /^electron$/, replacement: shim('electron.ts') },
      { find: /^fs$/, replacement: shim('fs.ts') },
      { find: /^path$/, replacement: shim('path.ts') },
      { find: /^crypto$/, replacement: shim('crypto.ts') }
    ]
  },
  build: { target: 'esnext', outDir: '../../public/demos/pos', emptyOutDir: true },
  esbuild: { target: 'esnext' }
})
