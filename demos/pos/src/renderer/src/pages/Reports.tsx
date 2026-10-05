import { useEffect, useState, type ReactNode } from 'react'
import type { Product } from '../types'
import { lkr, qtyFmt } from '../util'
import { IconCoins, IconPercent, IconReceipt, IconTrend } from '../icons'

const dayStr = (back: number) => {
  const d = new Date()
  d.setDate(d.getDate() - back)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
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
          <div className="page-sub">How the shop did on {date === today() ? 'today' : date}. Money in is after refunds.</div>
        </div>
        <div className="form-actions">
        {[['Today', 0], ['Yesterday', 1]].map(([label, back]) => (
          <button key={label} className={date === dayStr(back as number) ? 'fchip on' : 'fchip'} onClick={() => setDate(dayStr(back as number))}>
            {label}
          </button>
        ))}
        <label className="form-actions">
          <span className="label">Or pick a date</span>
          <input className="date-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        </div>
      </div>

      <div className="page-body">
        <div className="stats">
          <div className="card stat"><div className="stat-top"><span className="stat-ico"><IconCoins /></span>Money in</div><b>{lkr(r.revenue)}</b></div>
          <div className="card stat"><div className="stat-top"><span className="stat-ico"><IconTrend /></span>Profit (before expenses)</div><b>{lkr(r.profit)}</b></div>
          <div className="card stat"><div className="stat-top"><span className="stat-ico"><IconReceipt /></span>Bills made</div><b>{r.bills}</b></div>
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
            <Table title="Running low: reorder soon" empty={!low.length && 'Nothing is running low.'}>
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
