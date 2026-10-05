import { DatabaseSync } from 'node:sqlite'
import { app } from 'electron'
import { join } from 'path'
import { copyFileSync, existsSync, mkdirSync, renameSync, rmSync } from 'fs'

const dataDir = app.getPath('userData')
const dbPath = join(dataDir, 'pos.db')
const pendingRestore = join(dataDir, 'pos.db.restore')

// A restore is staged as a file and swapped in here, before the database is opened.
if (existsSync(pendingRestore)) {
  try {
    const safety = join(dataDir, 'before-restore')
    mkdirSync(safety, { recursive: true })
    if (existsSync(dbPath)) copyFileSync(dbPath, join(safety, `pos-${Date.now()}.db`))
    for (const ext of ['', '-wal', '-shm']) rmSync(dbPath + ext, { force: true })
    renameSync(pendingRestore, dbPath)
  } catch (e) {
    // Never leave the shop unable to start: keep the current data and drop the staged file.
    console.error('Restore could not be applied:', e)
    rmSync(pendingRestore, { force: true })
  }
}

export const raw = new DatabaseSync(dbPath)
raw.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')

// Thin wrapper adding transaction() on top of Node's built-in SQLite (no native add-on to compile)
export const db = {
  prepare: (sql: string) => raw.prepare(sql),
  exec: (sql: string) => raw.exec(sql),
  // Re-entrant: a transaction started inside another simply joins the outer one.
  transaction<T>(fn: () => T): () => T {
    return () => {
      if (depth > 0) return fn()
      raw.exec('BEGIN')
      depth++
      try {
        const r = fn()
        raw.exec('COMMIT')
        return r
      } catch (e) {
        raw.exec('ROLLBACK')
        throw e
      } finally {
        depth--
      }
    }
  }
}
let depth = 0

export const paths = { dataDir, dbPath, pendingRestore }

/** Consistent snapshot of the live database into a single file. */
export function backupTo(file: string) {
  rmSync(file, { force: true })
  raw.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`)
}

const MIGRATIONS: string[] = [
  // 1: core schema
  `
CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT UNIQUE NOT NULL,
  barcode TEXT UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  unit TEXT NOT NULL DEFAULT 'pcs',
  allow_fraction INTEGER NOT NULL DEFAULT 0,
  cost REAL NOT NULL DEFAULT 0,
  price REAL NOT NULL DEFAULT 0,
  reorder_level REAL NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_products_name ON products(name);

-- Append-only ledger: stock on hand = SUM(qty)
CREATE TABLE stock_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  qty REAL NOT NULL,
  reason TEXT NOT NULL,            -- sale | purchase | adjustment | return
  ref TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX idx_mov_product ON stock_movements(product_id);

CREATE TABLE sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  receipt_no TEXT UNIQUE NOT NULL,
  subtotal REAL NOT NULL,
  discount REAL NOT NULL DEFAULT 0,
  tax REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL,
  paid REAL NOT NULL,
  method TEXT NOT NULL DEFAULT 'cash',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL REFERENCES sales(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  qty REAL NOT NULL,
  price REAL NOT NULL,
  cost REAL NOT NULL,
  line_total REAL NOT NULL
);

CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`,
  // 2: staff, returns, purchasing
  `
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('owner','manager','cashier')),
  pin_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);
ALTER TABLE sales ADD COLUMN user_id INTEGER REFERENCES users(id);

CREATE TABLE returns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  return_no TEXT UNIQUE NOT NULL,
  sale_id INTEGER NOT NULL REFERENCES sales(id),
  total REAL NOT NULL,
  method TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  restock INTEGER NOT NULL DEFAULT 1,
  user_id INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE return_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  return_id INTEGER NOT NULL REFERENCES returns(id),
  sale_item_id INTEGER NOT NULL REFERENCES sale_items(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  qty REAL NOT NULL,
  price REAL NOT NULL,
  cost REAL NOT NULL,
  amount REAL NOT NULL
);
CREATE INDEX idx_return_items_sale_item ON return_items(sale_item_id);

CREATE TABLE suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  grn_no TEXT UNIQUE NOT NULL,
  supplier_id INTEGER REFERENCES suppliers(id),
  invoice_no TEXT NOT NULL DEFAULT '',
  total REAL NOT NULL,
  paid REAL NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  user_id INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE purchase_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id INTEGER NOT NULL REFERENCES purchases(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  qty REAL NOT NULL,
  cost REAL NOT NULL,
  line_total REAL NOT NULL
);
CREATE TABLE supplier_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  amount REAL NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
`,
  // 3: product pictures (kept in the database so backups include them)
  `
CREATE TABLE product_images (
  product_id INTEGER PRIMARY KEY REFERENCES products(id),
  mime TEXT NOT NULL,
  data BLOB NOT NULL
);
`
]

function migrate() {
  const hasProducts = raw.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='products'").get()
  let v = (raw.prepare('PRAGMA user_version').get() as { user_version: number }).user_version
  // Databases made before versioning already contain migration 1.
  if (v === 0 && hasProducts) v = 1
  for (let i = v; i < MIGRATIONS.length; i++) {
    raw.exec('BEGIN')
    try {
      raw.exec(MIGRATIONS[i])
      raw.exec(`PRAGMA user_version = ${i + 1}`)
      raw.exec('COMMIT')
    } catch (e) {
      raw.exec('ROLLBACK')
      throw e
    }
  }
  const defaults: Record<string, string> = {
    shop_name: 'My Hardware Store',
    shop_address: '',
    shop_phone: '',
    vat_rate: '0',
    vat_inclusive: '1',
    receipt_footer: 'Thank you! Come again.',
    printer_name: '',
    paper_width: '80',
    auto_print: '1',
    print_silent: '1',
    backup_dir: '',
    backup_dir2: '',
    last_backup: ''
  }
  const ins = raw.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES (?,?)')
  for (const [k, val] of Object.entries(defaults)) ins.run(k, val)
}
migrate()

export function seedSampleProducts() {
  if ((db.prepare('SELECT COUNT(*) c FROM products').get() as { c: number }).c > 0) return
  const ins = db.prepare(
    'INSERT INTO products(sku,barcode,name,category,unit,allow_fraction,cost,price,reorder_level) VALUES (?,?,?,?,?,?,?,?,?)'
  )
  const mov = db.prepare("INSERT INTO stock_movements(product_id,qty,reason,ref) VALUES (?,?,'purchase','opening')")
  const demo: [string, string, string, string, string, number, number, number, number, number][] = [
    ['NAIL-2', '1000001', 'Wire Nail 2"', 'Fasteners', 'kg', 1, 380, 450, 20, 100],
    ['SCR-10', '1000002', 'Wood Screw 10mm (box of 100)', 'Fasteners', 'box', 0, 250, 320, 10, 60],
    ['PVC-1', '1000003', 'PVC Pipe 1" (3m)', 'Plumbing', 'pcs', 0, 700, 890, 10, 40],
    ['WIRE-25', '1000004', 'Copper Wire 2.5mm', 'Electrical', 'm', 1, 95, 125, 100, 500],
    ['PAINT-W4', '1000005', 'Emulsion Paint White 4L', 'Paint', 'pcs', 0, 6800, 7900, 5, 20],
    ['HAM-1', '1000006', 'Claw Hammer', 'Tools', 'pcs', 0, 950, 1250, 5, 15]
  ]
  db.transaction(() => {
    for (const d of demo) {
      const r = ins.run(d[0], d[1], d[2], d[3], d[4], d[5], d[6], d[7], d[8])
      mov.run(Number(r.lastInsertRowid), d[9])
    }
  })()
}
