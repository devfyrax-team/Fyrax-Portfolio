import { db } from './db'
import { handle, money, nextNo } from './ipc'

const BALANCE_SQL = `
  (COALESCE((SELECT SUM(total - paid) FROM purchases p WHERE p.supplier_id = s.id),0)
   - COALESCE((SELECT SUM(amount) FROM supplier_payments x WHERE x.supplier_id = s.id),0))`

export function registerPurchasingIpc() {
  handle('suppliers:list', 'manager', () =>
    db.prepare(`SELECT s.*, ${BALANCE_SQL} AS balance FROM suppliers s WHERE s.active = 1 ORDER BY s.name`).all()
  )

  handle('suppliers:save', 'manager', (_u, s: { id?: number; name: string; phone?: string; address?: string; notes?: string }) => {
    const name = (s.name || '').trim()
    if (!name) throw new Error('Enter the supplier name.')
    try {
      if (s.id) {
        db.prepare('UPDATE suppliers SET name=?,phone=?,address=?,notes=? WHERE id=?').run(name, s.phone || '', s.address || '', s.notes || '', s.id)
        return s.id
      }
      return Number(db.prepare('INSERT INTO suppliers(name,phone,address,notes) VALUES (?,?,?,?)').run(name, s.phone || '', s.address || '', s.notes || '').lastInsertRowid)
    } catch (e: any) {
      if (/UNIQUE/.test(e.message)) throw new Error('A supplier with that name already exists.')
      throw e
    }
  })

  handle('suppliers:delete', 'manager', (_u, id: number) => {
    db.prepare('UPDATE suppliers SET active = 0 WHERE id = ?').run(id)
  })

  handle('suppliers:pay', 'manager', (_u, supplierId: number, amount: number, note: string) => {
    if (!(amount > 0)) throw new Error('Enter an amount greater than zero.')
    db.prepare('INSERT INTO supplier_payments(supplier_id,amount,note) VALUES (?,?,?)').run(supplierId, money(amount), (note || '').trim())
  })

  handle(
    'purchases:create',
    'manager',
    (
      user,
      input: { supplierId: number | null; invoiceNo?: string; note?: string; paid?: number; updateCost: boolean; items: { productId: number; qty: number; cost: number }[] }
    ) => {
      if (!input.items?.length) throw new Error('Add at least one item.')
      const id = db.transaction(() => {
        const lines = input.items.map((it) => {
          const p = db.prepare('SELECT * FROM products WHERE id = ?').get(it.productId) as any
          if (!p) throw new Error('A product no longer exists.')
          if (!(it.qty > 0)) throw new Error(`Enter a quantity for ${p.name}.`)
          if (!(it.cost >= 0)) throw new Error(`Invalid cost for ${p.name}.`)
          return { p, qty: it.qty, cost: it.cost, line_total: money(it.qty * it.cost) }
        })
        const total = money(lines.reduce((a, l) => a + l.line_total, 0))
        const paid = money(Math.min(Math.max(input.paid ?? 0, 0), total))
        const grn = nextNo('purchases', 'grn_no', 'GRN-', 3)
        const r = db
          .prepare('INSERT INTO purchases(grn_no,supplier_id,invoice_no,total,paid,note,user_id) VALUES (?,?,?,?,?,?,?)')
          .run(grn, input.supplierId || null, (input.invoiceNo || '').trim(), total, paid, (input.note || '').trim(), user!.id)
        const pid = Number(r.lastInsertRowid)
        const insItem = db.prepare('INSERT INTO purchase_items(purchase_id,product_id,name,unit,qty,cost,line_total) VALUES (?,?,?,?,?,?,?)')
        const insMov = db.prepare("INSERT INTO stock_movements(product_id,qty,reason,ref) VALUES (?,?,'purchase',?)")
        for (const l of lines) {
          insItem.run(pid, l.p.id, l.p.name, l.p.unit, l.qty, l.cost, l.line_total)
          insMov.run(l.p.id, l.qty, grn)
          if (input.updateCost) db.prepare('UPDATE products SET cost = ? WHERE id = ?').run(l.cost, l.p.id)
        }
        return pid
      })()
      return db.prepare('SELECT * FROM purchases WHERE id = ?').get(id)
    }
  )

  handle('purchases:list', 'manager', () =>
    db
      .prepare(
        `SELECT p.*, s.name AS supplier, u.name AS received_by,
           (SELECT COUNT(*) FROM purchase_items i WHERE i.purchase_id = p.id) AS lines
         FROM purchases p LEFT JOIN suppliers s ON s.id = p.supplier_id LEFT JOIN users u ON u.id = p.user_id
         ORDER BY p.id DESC LIMIT 200`
      )
      .all()
  )

  handle('purchases:get', 'manager', (_u, id: number) => {
    const p = db.prepare('SELECT p.*, s.name AS supplier FROM purchases p LEFT JOIN suppliers s ON s.id = p.supplier_id WHERE p.id = ?').get(id) as any
    if (!p) throw new Error('Purchase not found.')
    return { ...p, items: db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ?').all(id) }
  })
}
