import { db } from './db'
import { getSettings, handle, money, nextNo } from './ipc'

function getSale(id: number) {
  const sale = db
    .prepare('SELECT s.*, u.name AS cashier FROM sales s LEFT JOIN users u ON u.id = s.user_id WHERE s.id = ?')
    .get(id) as any
  if (!sale) throw new Error('Bill not found.')
  const items = db
    .prepare(
      `SELECT i.*, COALESCE((SELECT SUM(r.qty) FROM return_items r WHERE r.sale_item_id = i.id),0) AS returned
       FROM sale_items i WHERE i.sale_id = ?`
    )
    .all(id)
  const returns = db.prepare('SELECT * FROM returns WHERE sale_id = ? ORDER BY id').all(id)
  return { ...sale, items, returns }
}

export function registerSalesIpc() {
  handle(
    'sales:create',
    'any',
    (user, input: { items: { productId: number; qty: number; price: number }[]; discount: number; paid: number; method: string }) => {
      if (!input.items?.length) throw new Error('The bill is empty.')
      if (!['cash', 'card'].includes(input.method)) throw new Error('Choose cash or card.')
      const s = getSettings()
      const rate = parseFloat(s.vat_rate) || 0
      const inclusive = s.vat_inclusive === '1'

      const id = db.transaction(() => {
        const lines = input.items.map((it) => {
          const p = db.prepare('SELECT * FROM products WHERE id = ?').get(it.productId) as any
          if (!p) throw new Error('A product on the bill no longer exists.')
          if (!(it.qty > 0)) throw new Error(`Enter a quantity for ${p.name}.`)
          if (!(it.price >= 0)) throw new Error(`Invalid price for ${p.name}.`)
          return { p, qty: it.qty, price: it.price, line_total: money(it.qty * it.price) }
        })
        const subtotal = money(lines.reduce((a, l) => a + l.line_total, 0))
        const discount = money(Math.min(Math.max(input.discount || 0, 0), subtotal))
        const net = subtotal - discount
        const tax = inclusive ? money((net * rate) / (100 + rate)) : money((net * rate) / 100)
        const total = inclusive ? money(net) : money(net + tax)
        const receipt_no = nextNo('sales', 'receipt_no', '', 4)

        const sale = db
          .prepare('INSERT INTO sales(receipt_no,subtotal,discount,tax,total,paid,method,user_id) VALUES (?,?,?,?,?,?,?,?)')
          .run(receipt_no, subtotal, discount, tax, total, input.paid, input.method, user!.id)
        const saleId = Number(sale.lastInsertRowid)

        const insItem = db.prepare('INSERT INTO sale_items(sale_id,product_id,name,unit,qty,price,cost,line_total) VALUES (?,?,?,?,?,?,?,?)')
        const insMov = db.prepare("INSERT INTO stock_movements(product_id,qty,reason,ref) VALUES (?,?,'sale',?)")
        for (const l of lines) {
          insItem.run(saleId, l.p.id, l.p.name, l.p.unit, l.qty, l.price, l.p.cost, l.line_total)
          insMov.run(l.p.id, -l.qty, receipt_no)
        }
        return saleId
      })()
      return getSale(id)
    }
  )

  handle('sales:get', 'any', (_u, id: number) => getSale(id))

  /** Find bills by receipt number fragment and/or date (YYYY-MM-DD). */
  handle('sales:list', 'any', (_u, q: { date?: string; text?: string }) => {
    const where: string[] = []
    const args: string[] = []
    if (q.date) {
      where.push('date(s.created_at) = ?')
      args.push(q.date)
    }
    if (q.text?.trim()) {
      where.push('s.receipt_no LIKE ?')
      args.push(`%${q.text.trim()}%`)
    }
    return db
      .prepare(
        `SELECT s.*, u.name AS cashier,
           COALESCE((SELECT SUM(total) FROM returns r WHERE r.sale_id = s.id),0) AS refunded
         FROM sales s LEFT JOIN users u ON u.id = s.user_id
         ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
         ORDER BY s.id DESC LIMIT 200`
      )
      .all(...args)
  })

  handle(
    'returns:create',
    'any',
    (user, input: { saleId: number; items: { saleItemId: number; qty: number }[]; method: string; restock: boolean; reason: string }) => {
      if (!['cash', 'card'].includes(input.method)) throw new Error('Choose how the refund is paid.')
      const wanted = (input.items || []).filter((i) => i.qty > 0)
      if (!wanted.length) throw new Error('Choose at least one item to return.')

      const id = db.transaction(() => {
        const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(input.saleId) as any
        if (!sale) throw new Error('Bill not found.')
        // Refund the share of discount and VAT that the customer actually paid.
        const factor = sale.subtotal > 0 ? sale.total / sale.subtotal : 1

        const lines = wanted.map((w) => {
          const it = db.prepare('SELECT * FROM sale_items WHERE id = ? AND sale_id = ?').get(w.saleItemId, sale.id) as any
          if (!it) throw new Error('An item is not on that bill.')
          const already = (db.prepare('SELECT COALESCE(SUM(qty),0) q FROM return_items WHERE sale_item_id = ?').get(it.id) as { q: number }).q
          if (w.qty > it.qty - already + 1e-9) throw new Error(`Only ${+(it.qty - already).toFixed(3)} of ${it.name} can still be returned.`)
          return { it, qty: w.qty, amount: money(w.qty * it.price * factor) }
        })
        const total = money(lines.reduce((a, l) => a + l.amount, 0))
        const return_no = nextNo('returns', 'return_no', 'R-', 3)
        const r = db
          .prepare('INSERT INTO returns(return_no,sale_id,total,method,reason,restock,user_id) VALUES (?,?,?,?,?,?,?)')
          .run(return_no, sale.id, total, input.method, (input.reason || '').trim(), input.restock ? 1 : 0, user!.id)
        const rid = Number(r.lastInsertRowid)
        const insItem = db.prepare('INSERT INTO return_items(return_id,sale_item_id,product_id,name,unit,qty,price,cost,amount) VALUES (?,?,?,?,?,?,?,?,?)')
        const insMov = db.prepare("INSERT INTO stock_movements(product_id,qty,reason,ref) VALUES (?,?,'return',?)")
        for (const l of lines) {
          insItem.run(rid, l.it.id, l.it.product_id, l.it.name, l.it.unit, l.qty, l.it.price, l.it.cost, l.amount)
          if (input.restock) insMov.run(l.it.product_id, l.qty, return_no)
        }
        return rid
      })()
      const ret = db.prepare('SELECT * FROM returns WHERE id = ?').get(id) as any
      const items = db.prepare('SELECT * FROM return_items WHERE return_id = ?').all(id)
      return { ...ret, items, cashier: user!.name }
    }
  )

  handle('reports:daily', 'manager', (_u, date: string) => {
    const summary = db
      .prepare(
        `SELECT COUNT(*) AS bills, COALESCE(SUM(total),0) AS gross, COALESCE(SUM(tax),0) AS tax, COALESCE(SUM(discount),0) AS discount
         FROM sales WHERE date(created_at) = ?`
      )
      .get(date) as any
    const refunds = db
      .prepare('SELECT COUNT(*) AS n, COALESCE(SUM(total),0) AS total FROM returns WHERE date(created_at) = ?')
      .get(date) as any
    const grossProfit = db
      .prepare(
        `SELECT COALESCE(SUM(i.line_total - i.qty * i.cost),0) - (SELECT COALESCE(SUM(discount),0) FROM sales WHERE date(created_at) = ?) AS p
         FROM sale_items i JOIN sales s ON s.id = i.sale_id WHERE date(s.created_at) = ?`
      )
      .get(date, date) as any
    // A refund gives back revenue; if the goods went back on the shelf their cost comes back too.
    const lostProfit = db
      .prepare(
        `SELECT COALESCE(SUM(CASE WHEN r.restock = 1 THEN i.amount - i.qty * i.cost ELSE i.amount END),0) AS p
         FROM return_items i JOIN returns r ON r.id = i.return_id WHERE date(r.created_at) = ?`
      )
      .get(date) as any

    const sold = db.prepare('SELECT method, SUM(total) AS total FROM sales WHERE date(created_at) = ? GROUP BY method').all(date) as any[]
    const refunded = db.prepare('SELECT method, SUM(total) AS total FROM returns WHERE date(created_at) = ? GROUP BY method').all(date) as any[]
    const methods = new Map<string, number>()
    for (const m of sold) methods.set(m.method, (methods.get(m.method) ?? 0) + m.total)
    for (const m of refunded) methods.set(m.method, (methods.get(m.method) ?? 0) - m.total)

    const top = db
      .prepare(
        `SELECT i.name, i.unit, SUM(i.qty) AS qty, SUM(i.line_total) AS total
         FROM sale_items i JOIN sales s ON s.id = i.sale_id WHERE date(s.created_at) = ?
         GROUP BY i.product_id ORDER BY total DESC LIMIT 10`
      )
      .all(date)
    const sales = db
      .prepare('SELECT s.*, u.name AS cashier FROM sales s LEFT JOIN users u ON u.id = s.user_id WHERE date(s.created_at) = ? ORDER BY s.id DESC')
      .all(date)

    return {
      bills: summary.bills,
      gross: summary.gross,
      refunds: refunds.total,
      refundCount: refunds.n,
      revenue: money(summary.gross - refunds.total),
      profit: money(grossProfit.p - lostProfit.p),
      tax: summary.tax,
      discount: summary.discount,
      byMethod: [...methods].map(([method, total]) => ({ method, total: money(total) })),
      top,
      sales
    }
  })
}
