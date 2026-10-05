import { useEffect, useState, type ReactNode } from 'react'
import type { Product } from '../types'
import { lkr, qtyFmt } from '../util'
import { IconCoins, IconPercent, IconReceipt, IconTrend } from '../icons'

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function Reports() {
  const [date, setDate] = useState(today())
  const [r, setR] = useState<any>(null)
  const [low, setLow] = useState<Product[]>([])

  useEffect(() => {
    window.api.dailyReport(date).then(setR)
    window.api.lowStock().then(setLow)
  }, [date])

  if (!r) return null

  const Table = ({ title, children, empty }: { title: string; children: ReactNode; empty?: string | false }) => (
    <div className="card table-card">
      <div className="table-card-head"><h3>{title}</h3></div>
      <div className="table-scroll">
        <table className="tbl">
          <tbody>
            {children}
            {empty && <tr><td className="muted">{empty}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Reports</h1>
          <div className="page-sub">Daily sales summary (revenue is after refunds)</div>
        </div>
        <label className="form-actions">
          <span className="label">Date</span>
          <input className="date-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>

      <div className="page-body">
        <div className="stats">
          <div className="card stat"><div className="stat-top"><span className="stat-ico"><IconCoins /></span>Revenue</div><b>{lkr(r.revenue)}</b></div>
          <div className="card stat"><div className="stat-top"><span className="stat-ico"><IconTrend /></span>Gross profit</div><b>{lkr(r.profit)}</b></div>
          <div className="card stat"><div className="stat-top"><span className="stat-ico"><IconReceipt /></span>Bills</div><b>{r.bills}</b></div>
          <div className="card stat"><div className="stat-top"><span className="stat-ico"><IconPercent /></span>VAT collected</div><b>{lkr(r.tax)}</b></div>
          <div className="card stat"><div className="stat-top"><span className="stat-ico"><IconReceipt /></span>Refunds{r.refundCount ? ` (${r.refundCount})` : ''}</div><b>{lkr(r.refunds)}</b></div>
        </div>

        <div className="two">
          <div className="stack">
            <Table title="By payment method" empty={!r.byMethod.length && 'No sales on this day.'}>
              {r.byMethod.map((m: any) => (
                <tr key={m.method}><td style={{ textTransform: 'capitalize' }}>{m.method}</td><td className="r">{lkr(m.total)}</td></tr>
              ))}
            </Table>
            <Table title="Top items" empty={!r.top.length && 'No items sold on this day.'}>
              {r.top.map((t: any) => (
                <tr key={t.name}><td className="name">{t.name}</td><td className="r muted">{qtyFmt(t.qty)} {t.unit}</td><td className="r">{lkr(t.total)}</td></tr>
              ))}
            </Table>
          </div>

          <div className="stack">
            <Table title="Low stock" empty={!low.length && 'Everything is above its reorder level.'}>
              {low.map((p) => (
                <tr key={p.id}><td className="name">{p.name}</td><td className="r"><span className="pill warn">{qtyFmt(p.stock)} {p.unit}</span></td></tr>
              ))}
            </Table>
            <Table title="Bills" empty={!r.sales.length && 'No bills on this day.'}>
              {r.sales.map((s: any) => (
                <tr key={s.id}><td className="name">{s.receipt_no}</td><td className="muted">{s.created_at.slice(11, 16)}</td><td style={{ textTransform: 'capitalize' }}>{s.method}</td><td className="r">{lkr(s.total)}</td></tr>
              ))}
            </Table>
          </div>
        </div>
      </div>
    </div>
  )
}
