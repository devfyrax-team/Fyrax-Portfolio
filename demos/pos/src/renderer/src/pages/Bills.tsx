import { useEffect, useState } from 'react'
import type { Sale, SaleReturn, SaleSummary, Settings } from '../types'
import { lkr, qtyFmt, receiptHtml, refundHtml, todayStr } from '../util'
import { IconPrinter, IconSearch } from '../icons'

export default function Bills({ settings }: { settings: Settings }) {
  const [date, setDate] = useState(todayStr())
  const [text, setText] = useState('')
  const [rows, setRows] = useState<SaleSummary[]>([])
  const [open, setOpen] = useState<Sale | null>(null)

  const load = () => window.api.listSales({ date: text.trim() ? undefined : date, text }).then(setRows)
  useEffect(() => {
    load()
  }, [date, text])

  const view = async (id: number) => setOpen(await window.api.getSale(id))

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Bills</h1>
          <div className="page-sub">Find a bill to reprint it or take a return</div>
        </div>
        <div className="form-actions">
          <div className="searchbox">
            <IconSearch />
            <input aria-label="Search bill number" placeholder="Bill number (any date)" value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          <label className="form-actions">
            <span className="label">Date</span>
            <input className="date-input" type="date" value={date} disabled={!!text.trim()} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>
      </div>

      <div className="page-body">
        <div className="card table-card">
          <div className="table-scroll">
            <table className="tbl">
              <thead>
                <tr><th>Bill</th><th>Time</th><th>Cashier</th><th>Method</th><th className="r">Total</th><th>Status</th><th className="r"></th></tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id}>
                    <td className="name">{s.receipt_no}</td>
                    <td className="muted">{s.created_at.slice(text.trim() ? 0 : 11, 16)}</td>
                    <td>{s.cashier ?? '—'}</td>
                    <td style={{ textTransform: 'capitalize' }}>{s.method}</td>
                    <td className="r">{lkr(s.total)}</td>
                    <td>{s.refunded > 0 ? <span className="pill warn">{s.refunded >= s.total ? 'Fully refunded' : `Refunded ${lkr(s.refunded)}`}</span> : <span className="muted">—</span>}</td>
                    <td className="r"><button className="btn sm outline" onClick={() => view(s.id)}>Open</button></td>
                  </tr>
                ))}
                {!rows.length && <tr><td colSpan={7}><div className="empty"><b>No bills found</b><span>Try another date or bill number.</span></div></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {open && <BillDialog sale={open} settings={settings} onClose={() => setOpen(null)} onChanged={async () => { setOpen(await window.api.getSale(open.id)); load() }} />}
    </div>
  )
}

function BillDialog({ sale, settings, onClose, onChanged }: { sale: Sale; settings: Settings; onClose: () => void; onChanged: () => void }) {
  const [returning, setReturning] = useState(false)
  const [qty, setQty] = useState<Record<number, number>>({})
  const [method, setMethod] = useState('cash')
  const [restock, setRestock] = useState(true)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState<SaleReturn | null>(null)

  const factor = sale.subtotal > 0 ? sale.total / sale.subtotal : 1
  const refund = sale.items.reduce((a, i) => a + (qty[i.id] || 0) * i.price * factor, 0)
  const anyLeft = sale.items.some((i) => i.qty - i.returned > 1e-9)

  const submit = async () => {
    setError('')
    try {
      const r = await window.api.createReturn({
        saleId: sale.id,
        items: sale.items.map((i) => ({ saleItemId: i.id, qty: qty[i.id] || 0 })),
        method,
        restock,
        reason
      })
      setDone(r)
      setReturning(false)
      setQty({})
      onChanged()
      window.api.printReceipt(refundHtml(r, sale.receipt_no, settings))
    } catch (e: any) {
      setError(e.message)
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={`Bill ${sale.receipt_no}`} onClick={(e) => e.stopPropagation()}>
        <h3>Bill {sale.receipt_no}</h3>
        <p className="muted" style={{ marginTop: -12 }}>{sale.created_at} · {sale.cashier ?? 'unknown cashier'} · {sale.method}</p>

        <div className="card table-card">
          <table className="tbl">
            <thead><tr><th>Item</th><th className="r">Qty</th><th className="r">Price</th><th className="r">Total</th>{returning && <th className="r">Return qty</th>}</tr></thead>
            <tbody>
              {sale.items.map((i) => {
                const left = +(i.qty - i.returned).toFixed(3)
                return (
                  <tr key={i.id}>
                    <td className="name">{i.name}{i.returned > 0 && <div className="muted" style={{ fontWeight: 400, fontSize: 12 }}>{qtyFmt(i.returned)} already returned</div>}</td>
                    <td className="r">{qtyFmt(i.qty)} {i.unit}</td>
                    <td className="r">{lkr(i.price)}</td>
                    <td className="r">{lkr(i.line_total)}</td>
                    {returning && (
                      <td className="r">
                        <input
                          type="number" min="0" max={left} step={i.unit === 'kg' || i.unit === 'm' ? '0.01' : '1'}
                          style={{ width: 90, textAlign: 'right' }} disabled={left <= 0}
                          aria-label={`Return quantity of ${i.name}`}
                          value={qty[i.id] ?? ''} placeholder={left <= 0 ? '—' : '0'}
                          onChange={(e) => setQty((q) => ({ ...q, [i.id]: Math.min(left, Math.max(0, parseFloat(e.target.value) || 0)) }))}
                        />
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="totals-box">
          <div className="trow"><span className="muted">Subtotal</span><span>{lkr(sale.subtotal)}</span></div>
          {sale.discount > 0 && <div className="trow"><span className="muted">Discount</span><span>−{lkr(sale.discount)}</span></div>}
          {sale.tax > 0 && <div className="trow"><span className="muted">VAT</span><span>{lkr(sale.tax)}</span></div>}
          <div className="trow grand"><span>Total</span><span>{lkr(sale.total)}</span></div>
        </div>

        {sale.returns.length > 0 && (
          <p className="muted" style={{ marginTop: 12 }}>
            Refunds: {sale.returns.map((r) => `${r.return_no} (${lkr(r.total)})`).join(', ')}
          </p>
        )}

        {done && <p className="ok-text" role="status">Refund {done.return_no} recorded: give {lkr(done.total)} by {done.method}.</p>}

        {returning && (
          <div className="form" style={{ marginTop: 16 }}>
            <div className="field">Refund paid by
              <div className="chips">
                {['cash', 'card'].map((m) => (
                  <button key={m} className={m === method ? 'chip active' : 'chip'} onClick={() => setMethod(m)}>{m}</button>
                ))}
              </div>
            </div>
            <label className="field">Reason<input value={reason} placeholder="e.g. wrong size" onChange={(e) => setReason(e.target.value)} /></label>
            <label className="check full"><input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} />Put the items back in stock <span className="muted">(untick if damaged)</span></label>
            <div className="trow full" style={{ fontSize: 18, fontWeight: 700 }}><span>Refund amount</span><span>{lkr(refund)}</span></div>
          </div>
        )}
        {error && <p className="err" style={{ marginTop: 12 }} role="alert">{error}</p>}

        <div className="dialog-actions">
          <button className="btn" onClick={onClose}>Close</button>
          {!returning && (
            <>
              <button className="btn outline" onClick={() => window.api.printReceipt(receiptHtml(sale, settings, Math.max(0, sale.paid - sale.total)))}><IconPrinter /> Reprint</button>
              <button className="btn primary" disabled={!anyLeft} onClick={() => { setReturning(true); setDone(null) }}>{anyLeft ? 'Return items' : 'Fully returned'}</button>
            </>
          )}
          {returning && (
            <>
              <button className="btn" onClick={() => { setReturning(false); setError('') }}>Cancel return</button>
              <button className="btn primary" disabled={refund <= 0} onClick={submit}>Refund {lkr(refund)}</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
