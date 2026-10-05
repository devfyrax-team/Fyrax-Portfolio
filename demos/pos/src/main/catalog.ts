import { BrowserWindow, dialog, nativeImage } from 'electron'
import { readFileSync, statSync, writeFileSync } from 'fs'
import { isAtLeast } from './auth'
import { backupNow } from './backup'
import { parseCsv, toCsv } from './csv'
import { db } from './db'
import { handle } from './ipc'

const STOCK_SQL = '(SELECT COALESCE(SUM(qty),0) FROM stock_movements m WHERE m.product_id = p.id)'
const HAS_IMG_SQL = '(EXISTS(SELECT 1 FROM product_images i WHERE i.product_id = p.id))'
const MAX_IMAGE_BYTES = 15 * 1024 * 1024
const IMAGE_SIDE = 480

/** Shrinks a picture to a small JPEG so thousands of products stay fast and backups stay small. */
function processImage(file: string): Buffer {
  if (statSync(file).size > MAX_IMAGE_BYTES) throw new Error('That picture is too large. Choose one under 15 MB.')
  const img = nativeImage.createFromPath(file)
  if (img.isEmpty()) throw new Error('That file is not a picture this app can open. Use a JPG, PNG or WebP image.')
  const { width, height } = img.getSize()
  const scale = Math.min(1, IMAGE_SIDE / Math.max(width, height))
  const small = scale < 1 ? img.resize({ width: Math.round(width * scale), height: Math.round(height * scale), quality: 'best' }) : img
  return small.toJPEG(82)
}

const toDataUrl = (data: Uint8Array, mime: string) => `data:${mime};base64,${Buffer.from(data).toString('base64')}`

const FRACTION_UNITS =new Set(['kg', 'g', 'm', 'ft', 'l', 'litre', 'liter', 'mm', 'cm'])

// Cashiers never see what an item costs the shop.
const scrub = <T extends { cost?: number }>(rows: T[]): T[] => (isAtLeast('manager') ? rows : rows.map((r) => ({ ...r, cost: 0 })))

const num = (v: unknown) => {
  const n = parseFloat(String(v ?? '').replace(/,/g, '').trim())
  return Number.isFinite(n) ? n : NaN
}

export function registerCatalogIpc() {
  handle('products:search', 'any', (_u, q: string) => {
    const like = `%${(q || '').trim()}%`
    return scrub(
      db
        .prepare(
          `SELECT p.*, ${STOCK_SQL} AS stock, ${HAS_IMG_SQL} AS has_image FROM products p
           WHERE p.active = 1 AND (p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ? OR p.category LIKE ?)
           ORDER BY p.name LIMIT 500`
        )
        .all(like, like, like, like) as any[]
    )
  })

  handle('products:byCode', 'any', (_u, code: string) => {
    const row = db
      .prepare(`SELECT p.*, ${STOCK_SQL} AS stock, ${HAS_IMG_SQL} AS has_image FROM products p WHERE p.active = 1 AND (p.barcode = ? OR p.sku = ?)`)
      .get(code, code) as any
    return row ? scrub([row])[0] : null
  })

  handle('products:save', 'manager', (_u, p: any) => {
    const vals = [p.sku, p.barcode || null, p.name, p.category || '', p.unit, p.allow_fraction ? 1 : 0, p.cost || 0, p.price || 0, p.reorder_level || 0]
    // image: a data URL from products:pickImage = set it, null = remove it, undefined = leave it alone
    const saveImage = (id: number) => {
      if (p.image === null) db.prepare('DELETE FROM product_images WHERE product_id = ?').run(id)
      else if (typeof p.image === 'string') {
        const m = /^data:(image\/jpeg);base64,(.+)$/.exec(p.image)
        if (!m) throw new Error('The picture is not valid.')
        if (m[2].length > 3_000_000) throw new Error('The picture is too large.')
        db.prepare('INSERT INTO product_images(product_id,mime,data) VALUES (?,?,?) ON CONFLICT(product_id) DO UPDATE SET mime=excluded.mime, data=excluded.data').run(
          id,
          m[1],
          Buffer.from(m[2], 'base64')
        )
      }
    }
    return db.transaction(() => {
      if (p.id) {
        db.prepare(`UPDATE products SET sku=?,barcode=?,name=?,category=?,unit=?,allow_fraction=?,cost=?,price=?,reorder_level=? WHERE id=?`).run(...vals, p.id)
        saveImage(p.id)
        return p.id as number
      }
      const r = db
        .prepare(`INSERT INTO products(sku,barcode,name,category,unit,allow_fraction,cost,price,reorder_level) VALUES (?,?,?,?,?,?,?,?,?)`)
        .run(...vals)
      const id = Number(r.lastInsertRowid)
      saveImage(id)
      if (p.opening_stock) {
        db.prepare("INSERT INTO stock_movements(product_id,qty,reason,ref) VALUES (?,?,'purchase','opening')").run(id, p.opening_stock)
      }
      return id
    })()
  })

  // Opens a file picker and returns the shrunken picture as a data URL (not saved until the product is saved).
  handle('products:pickImage', 'manager', async () => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const r = await dialog.showOpenDialog(win, {
      title: 'Choose a product picture',
      properties: ['openFile'],
      filters: [{ name: 'Pictures', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif'] }]
    })
    if (r.canceled || !r.filePaths[0]) return null
    return toDataUrl(processImage(r.filePaths[0]), 'image/jpeg')
  })

  // Pictures for a batch of products, as { [id]: dataUrl }. Missing ones simply have no entry.
  handle('products:images', 'any', (_u, ids: number[]) => {
    const out: Record<number, string> = {}
    const get = db.prepare('SELECT mime, data FROM product_images WHERE product_id = ?')
    for (const id of (ids || []).slice(0, 500)) {
      const row = get.get(id) as { mime: string; data: Uint8Array } | undefined
      if (row) out[id] = toDataUrl(row.data, row.mime)
    }
    return out
  })

  handle('products:delete', 'manager', (_u, id: number) => {
    db.prepare('UPDATE products SET active = 0 WHERE id = ?').run(id)
  })

  handle('stock:adjust', 'manager', (u, productId: number, qty: number, reason: string, ref?: string) => {
    db.prepare('INSERT INTO stock_movements(product_id,qty,reason,ref) VALUES (?,?,?,?)').run(productId, qty, reason, ref ?? `${u!.name}`)
  })

  handle('reports:lowStock', 'any', () =>
    scrub(
      db
        .prepare(`SELECT * FROM (SELECT p.*, ${STOCK_SQL} AS stock, ${HAS_IMG_SQL} AS has_image FROM products p WHERE p.active = 1) WHERE stock <= reorder_level ORDER BY stock`)
        .all() as any[]
    )
  )

  // ---- CSV export / import -------------------------------------------------
  const HEADERS = ['sku', 'barcode', 'name', 'category', 'unit', 'cost', 'price', 'reorder_level', 'stock']

  handle('products:export', 'manager', async () => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const r = await dialog.showSaveDialog(win, { title: 'Export products', defaultPath: 'products.csv', filters: [{ name: 'CSV (Excel)', extensions: ['csv'] }] })
    if (r.canceled || !r.filePath) return null
    const rows = db.prepare(`SELECT p.*, ${STOCK_SQL} AS stock FROM products p WHERE p.active = 1 ORDER BY p.name`).all() as any[]
    writeFileSync(r.filePath, toCsv([HEADERS, ...rows.map((p) => HEADERS.map((h) => p[h]))]))
    return { path: r.filePath, count: rows.length }
  })

  handle('products:template', 'manager', async () => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const r = await dialog.showSaveDialog(win, { title: 'Save import template', defaultPath: 'products-template.csv', filters: [{ name: 'CSV (Excel)', extensions: ['csv'] }] })
    if (r.canceled || !r.filePath) return null
    writeFileSync(
      r.filePath,
      toCsv([
        HEADERS,
        ['NAIL-2', '1000001', 'Wire Nail 2"', 'Fasteners', 'kg', 380, 450, 20, 100],
        ['HAM-1', '', 'Claw Hammer', 'Tools', 'pcs', 950, 1250, 5, 15]
      ])
    )
    return { path: r.filePath }
  })

  handle('products:import', 'manager', async () => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const r = await dialog.showOpenDialog(win, { title: 'Import products', properties: ['openFile'], filters: [{ name: 'CSV (Excel)', extensions: ['csv'] }] })
    if (r.canceled || !r.filePaths[0]) return null

    const table = parseCsv(readFileSync(r.filePaths[0], 'utf8'))
    if (table.length < 2) throw new Error('The file has no product rows.')
    const head = table[0].map((h) => h.trim().toLowerCase().replace(/[\s-]+/g, '_'))
    const col = (...names: string[]) => head.findIndex((h) => names.includes(h))
    const idx = {
      sku: col('sku', 'code', 'item_code'),
      barcode: col('barcode', 'bar_code'),
      name: col('name', 'item', 'product', 'description'),
      category: col('category', 'group'),
      unit: col('unit', 'uom'),
      cost: col('cost', 'cost_price'),
      price: col('price', 'selling_price', 'sell_price'),
      reorder: col('reorder_level', 'reorder', 'min_stock'),
      stock: col('stock', 'qty', 'quantity', 'opening_stock')
    }
    if (idx.name < 0 || (idx.sku < 0 && idx.barcode < 0)) throw new Error('The file needs a "name" column and a "sku" or "barcode" column.')

    backupNow('pre-import') // safety net before bulk changes

    const result = { created: 0, updated: 0, skipped: 0, errors: [] as { line: number; message: string }[] }
    const get = (row: string[], i: number) => (i >= 0 ? (row[i] ?? '').trim() : '')
    const stockOf = db.prepare('SELECT COALESCE(SUM(qty),0) s FROM stock_movements WHERE product_id = ?')
    const addMov = db.prepare("INSERT INTO stock_movements(product_id,qty,reason,ref) VALUES (?,?,?, 'import')")

    db.transaction(() => {
      table.slice(1).forEach((row, n) => {
        const line = n + 2
        try {
          const name = get(row, idx.name)
          const barcode = get(row, idx.barcode)
          const sku = get(row, idx.sku) || barcode
          if (!name || !sku) throw new Error('Missing name or SKU')
          const cost = idx.cost >= 0 && get(row, idx.cost) !== '' ? num(get(row, idx.cost)) : undefined
          const price = idx.price >= 0 && get(row, idx.price) !== '' ? num(get(row, idx.price)) : undefined
          const reorder = idx.reorder >= 0 && get(row, idx.reorder) !== '' ? num(get(row, idx.reorder)) : undefined
          const stock = idx.stock >= 0 && get(row, idx.stock) !== '' ? num(get(row, idx.stock)) : undefined
          for (const [label, v] of [['cost', cost], ['price', price], ['reorder level', reorder], ['stock', stock]] as const) {
            if (v !== undefined && (Number.isNaN(v) || v < 0)) throw new Error(`Invalid ${label}`)
          }
          const unit = get(row, idx.unit) || 'pcs'
          const fraction = FRACTION_UNITS.has(unit.toLowerCase()) ? 1 : 0

          const cur = db.prepare('SELECT id FROM products WHERE sku = ?').get(sku) as { id: number } | undefined
          if (cur) {
            db.prepare(
              `UPDATE products SET name=?, barcode=COALESCE(?,barcode), category=CASE WHEN ?<>'' THEN ? ELSE category END,
                 unit=?, allow_fraction=?, cost=COALESCE(?,cost), price=COALESCE(?,price), reorder_level=COALESCE(?,reorder_level), active=1
               WHERE id=?`
            ).run(name, barcode || null, get(row, idx.category), get(row, idx.category), unit, fraction, cost ?? null, price ?? null, reorder ?? null, cur.id)
            if (stock !== undefined) {
              const diff = stock - (stockOf.get(cur.id) as { s: number }).s
              if (diff !== 0) addMov.run(cur.id, diff, 'adjustment')
            }
            result.updated++
          } else {
            const ins = db
              .prepare('INSERT INTO products(sku,barcode,name,category,unit,allow_fraction,cost,price,reorder_level) VALUES (?,?,?,?,?,?,?,?,?)')
              .run(sku, barcode || null, name, get(row, idx.category), unit, fraction, cost ?? 0, price ?? 0, reorder ?? 0)
            if (stock) addMov.run(Number(ins.lastInsertRowid), stock, 'purchase')
            result.created++
          }
        } catch (e: any) {
          result.skipped++
          result.errors.push({ line, message: /UNIQUE/.test(e.message) ? 'Barcode already used by another product' : e.message })
        }
      })
    })()
    result.errors = result.errors.slice(0, 50)
    return result
  })
}
