// Demo bootstrap: loads the app's real main-process modules (database, sales, stock, purchasing) in the browser,
// seeds a sample hardware shop, and exposes the same window.api the Electron preload would.
import '../shims/buffer'
import { db } from '../main/db'
import { registerCatalogIpc } from '../main/catalog'
import { registerPurchasingIpc } from '../main/purchasing'
import { registerSalesIpc } from '../main/sales'
import { registerUserIpc } from '../main/users'
import { registerBackupIpc } from '../main/backup'
import { getSettings, handle, setSetting, ymd } from '../main/ipc'
import { handlers } from '../shims/electron'
import { channels } from './channels'

const SETTING_KEYS = [
  'shop_name', 'shop_address', 'shop_phone', 'vat_rate', 'vat_inclusive', 'receipt_footer',
  'printer_name', 'paper_width', 'auto_print', 'print_silent'
]

export const DEMO_PIN = '1234'

handle('license:status', 'public', () => ({ state: 'licensed', machineId: 'DEMO-0000-0000-0000', shop: 'Demo shop' }))
handle('license:activate', 'public', () => ({ state: 'licensed', machineId: 'DEMO-0000-0000-0000', shop: 'Demo shop' }))
handle('settings:get', 'any', () => getSettings())
handle('settings:set', 'owner', (_u, kv: Record<string, string>) => {
  for (const [k, v] of Object.entries(kv)) if (SETTING_KEYS.includes(k)) setSetting(k, String(v))
})
handle('printers:list', 'any', () => [{ name: 'demo', label: 'Browser print preview' }])
handle('receipt:print', 'any', (_u, html: string) => {
  // No printer in a browser: show the receipt in a small window instead.
  const w = window.open('', '_blank', 'width=420,height=640')
  if (!w) return { ok: false, reason: 'Allow pop-ups to preview receipts in the demo.' }
  w.document.open()
  w.document.write(html)
  w.document.close()
  return { ok: true, reason: '' }
})
registerUserIpc()
registerCatalogIpc()
registerSalesIpc()
registerPurchasingIpc()
registerBackupIpc()

const call = (channel: string, ...args: unknown[]) => {
  const h = handlers.get(channel)
  if (!h) throw new Error(`Not available in the demo (${channel}).`)
  return h(null, ...args) as any
}

// Same shape as the Electron preload: every method returns a promise and rejects with a plain Error.
const api: Record<string, (...a: unknown[]) => Promise<unknown>> = {}
for (const [name, channel] of Object.entries(channels)) {
  api[name] = async (...args) => {
    await new Promise((r) => setTimeout(r, 25))
    return call(channel, ...args)
  }
}
;(window as any).api = api

// ---- Sample shop -------------------------------------------------------------------------------------------------

// Small seeded random generator so every visit shows the same history.
let seed = 20260
const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296
const pick = <T>(a: T[]) => a[Math.floor(rnd() * a.length)]

call('auth:setup', { ownerName: 'Nimal Perera', pin: DEMO_PIN, shopName: 'Kandy Hardware (demo)', sample: true })
call('settings:set', {
  shop_address: '123 Peradeniya Road, Kandy',
  shop_phone: '081 222 3344',
  vat_rate: '0',
  auto_print: '0',
  print_silent: '0'
})
call('users:save', { name: 'Kasun Silva', role: 'manager', pin: DEMO_PIN })
call('users:save', { name: 'Dilani Fernando', role: 'cashier', pin: DEMO_PIN })

// sku, barcode, name, category, unit, fraction, cost, price, reorder, opening stock
const more: [string, string, string, string, string, number, number, number, number, number][] = [
  ['NAIL-3', '1000007', 'Wire Nail 3"', 'Fasteners', 'kg', 1, 390, 460, 20, 80],
  ['BOLT-M8', '1000008', 'Hex Bolt M8 x 50mm', 'Fasteners', 'pcs', 0, 22, 35, 100, 400],
  ['PVC-ELB', '1000009', 'PVC Elbow 1"', 'Plumbing', 'pcs', 0, 45, 70, 30, 120],
  ['TAP-1', '1000010', 'Brass Garden Tap 1/2"', 'Plumbing', 'pcs', 0, 650, 890, 8, 24],
  ['SWT-1', '1000011', 'Light Switch 1-gang', 'Electrical', 'pcs', 0, 180, 260, 20, 60],
  ['BULB-LED', '1000012', 'LED Bulb 9W', 'Electrical', 'pcs', 0, 210, 320, 30, 90],
  ['CAB-15', '1000013', 'Cable 1.5mm (red)', 'Electrical', 'm', 1, 62, 85, 100, 400],
  ['PAINT-R4', '1000014', 'Emulsion Paint Cream 4L', 'Paint', 'pcs', 0, 6600, 7600, 5, 16],
  ['BRUSH-3', '1000015', 'Paint Brush 3"', 'Paint', 'pcs', 0, 240, 360, 10, 40],
  ['SAND-80', '1000016', 'Sandpaper 80 grit', 'Paint', 'pcs', 0, 40, 65, 30, 100],
  ['SCRD-SET', '1000017', 'Screwdriver Set (6 pc)', 'Tools', 'pcs', 0, 1150, 1650, 5, 14],
  ['TAPE-5', '1000018', 'Measuring Tape 5m', 'Tools', 'pcs', 0, 420, 620, 8, 22],
  ['DRILL-6', '1000019', 'Masonry Drill Bit 6mm', 'Tools', 'pcs', 0, 190, 290, 10, 30],
  ['CEM-50', '1000020', 'Cement 50kg bag', 'Building', 'pcs', 0, 2150, 2380, 20, 60],
  ['SAND-M', '1000021', 'River Sand (cube)', 'Building', 'pcs', 0, 14500, 16000, 2, 20],
  ['GLUE-PVC', '1000022', 'PVC Solvent Cement 100ml', 'Plumbing', 'pcs', 0, 160, 240, 10, 36]
]
for (const m of more) {
  call('products:save', {
    sku: m[0], barcode: m[1], name: m[2], category: m[3], unit: m[4], allow_fraction: m[5],
    cost: m[6], price: m[7], reorder_level: m[8], opening_stock: m[9]
  })
}

call('suppliers:save', { name: 'Lanka Fasteners (Pvt) Ltd', phone: '011 234 5678', address: 'Colombo 10', notes: '' })
call('suppliers:save', { name: 'Kandy Paint House', phone: '081 223 4455', address: 'Kandy', notes: '' })
call('suppliers:save', { name: 'Ceylon Electricals', phone: '011 765 4321', address: 'Pettah', notes: '30-day terms' })
const products = call('products:search', '') as { id: number; price: number; allow_fraction: number; name: string }[]
call('purchases:create', {
  supplierId: 1, invoiceNo: 'INV-5521', note: 'Monthly fasteners order', paid: 20000, updateCost: false,
  items: [{ productId: 1, qty: 40, cost: 380 }, { productId: 2, qty: 30, cost: 250 }]
})
call('purchases:create', {
  supplierId: 2, invoiceNo: 'KPH-908', note: '', paid: 0, updateCost: false,
  items: [{ productId: 5, qty: 6, cost: 6800 }, { productId: 14, qty: 4, cost: 6600 }]
})

// A week of trading, backdated so Reports and Bills have history.
const sellable = products.filter((p) => p.price < 5000)
for (let back = 6; back >= 0; back--) {
  const day = new Date()
  day.setDate(day.getDate() - back)
  const dayKey = ymd(day)
  const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
  const bills = back === 0 ? 5 + Math.floor(rnd() * 3) : 6 + Math.floor(rnd() * 8)
  for (let n = 1; n <= bills; n++) {
    const lines = Array.from({ length: 1 + Math.floor(rnd() * 3) }, () => {
      const p = pick(sellable)
      const qty = p.allow_fraction ? Math.round((0.5 + rnd() * 4) * 2) / 2 : 1 + Math.floor(rnd() * 3)
      return { productId: p.id, qty, price: p.price }
    })
    const total = lines.reduce((a, l) => a + l.qty * l.price, 0)
    const sale = call('sales:create', { items: lines, discount: 0, paid: Math.ceil(total / 100) * 100, method: rnd() < 0.7 ? 'cash' : 'card' })
    const hh = String(8 + Math.floor((n / bills) * 10)).padStart(2, '0')
    const mm = String(Math.floor(rnd() * 60)).padStart(2, '0')
    const no = `${dayKey}-${String(n).padStart(4, '0')}`
    const at = `${iso} ${hh}:${mm}:00`
    db.prepare('UPDATE sales SET receipt_no = ?, created_at = ? WHERE id = ?').run(no, at, sale.id)
    db.prepare("UPDATE stock_movements SET ref = ?, created_at = ? WHERE ref = ? AND reason = 'sale'").run(no, at, sale.receipt_no)
  }
}

// Start signed in as the owner so the demo opens straight on Checkout.
call('auth:login', 1, DEMO_PIN)
