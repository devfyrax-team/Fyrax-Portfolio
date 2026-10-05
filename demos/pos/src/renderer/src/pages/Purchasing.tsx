import { useEffect, useState } from 'react'
import type { Product, Purchase, PurchaseDetail, Supplier } from '../types'
import { lkr, qtyFmt } from '../util'
import { IconEdit, IconPlus, IconSearch, IconTrash, IconX } from '../icons'

export default function Purchasing() {
  const [tab, setTab] = useState<'Receipts' | 'Suppliers'>('Receipts')
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [receiving, setReceiving] = useState(false)
  const [detail, setDetail] = useState<PurchaseDetail | null>(null)
  const [editSup, setEditSup] = useState<Partial<Supplier> | null>(null)
  const [paySup, setPaySup] = useState<Supplier | null>(null)
  const [delSup, setDelSup] = useState<Supplier | null>(null)

  const load = () => {
    window.api.listSuppliers().then(setSuppliers)
    window.api.listPurchases().then(setPurchases)
  }
  useEffect(load, [])

  const owed = suppliers.reduce((a, s) => a + s.balance, 0)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Purchasing</h1>
          <div className="page-sub">Stock received from suppliers{owed > 0 && <> · you owe <b>{lkr(owed)}</b></>}</div>
        </div>
        <div className="form-actions">
          <button className="btn outline" onClick={() => setEditSup({ name: '', phone: '', address: '', notes: '' })}><IconPlus /> Add supplier</button>
          <button className="btn primary" onClick={() => setReceiving(true)}><IconPlus /> Receive stock</button>
        </div>
      </div>

      <div className="tabs" role="tablist" style={{ padding: '0 32px', marginTop: 12 }}>
        {(['Receipts', 'Suppliers'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={t === tab} className={t === tab ? 'tab active' : 'tab'} onClick={() => setTab(t)}>
            {t}<span className="badge-count">{t === 'Receipts' ? purchases.length : suppliers.length}</span>
          </button>
        ))}
      </div>

      <div className="page-body">
        {tab === 'Receipts' && (
          <div className="card table-card"><div className="table-scroll">
            <table className="tbl">
              <thead><tr><th>GRN</th><th>Date</th><th>Supplier</th><th>Invoice</th><th className="r">Lines</th><th className="r">Total</th><th className="r">Balance</th><th></th></tr></thead>
              <tbody>
                {purchases.map((p) => (
                  <tr key={p.id}>
                    <td className="name">{p.grn_no}</td>
                    <td className="muted">{p.created_at.slice(0, 16)}</td>
                    <td>{p.supplier ?? <span className="muted">—</span>}</td>
                    <td>{p.invoice_no || <span className="muted">—</span>}</td>
                    <td className="r">{p.lines}</td>
                    <td className="r">{lkr(p.total)}</td>
                    <td className="r">{p.total - p.paid > 0.004 ? <span className="pill warn">{lkr(p.total - p.paid)}</span> : <span className="pill ok">Paid</span>}</td>
                    <td className="r"><button className="btn sm outline" onClick={async () => setDetail(await window.api.getPurchase(p.id))}>View</button></td>
                  </tr>
                ))}
                {!purchases.length && <tr><td colSpan={8}><div className="empty"><b>No stock received yet</b><span>Use “Receive stock” when a delivery arrives. It adds to stock and updates costs.</span></div></td></tr>}
              </tbody>
            </table>
          </div></div>
        )}

        {tab === 'Suppliers' && (
          <div className="card table-card"><div className="table-scroll">
            <table className="tbl">
              <thead><tr><th>Name</th><th>Phone</th><th>Address</th><th className="r">You owe</th><th className="r">Actions</th></tr></thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.id}>
                    <td className="name">{s.name}</td>
                    <td>{s.phone || <span className="muted">—</span>}</td>
                    <td style={{ whiteSpace: 'normal' }}>{s.address || <span className="muted">—</span>}</td>
                    <td className="r">{s.balance > 0.004 ? <span className="pill warn">{lkr(s.balance)}</span> : <span className="muted">—</span>}</td>
                    <td className="r"><div className="actions">
                      <button className="btn sm outline" disabled={s.balance <= 0.004} onClick={() => setPaySup(s)}>Record payment</button>
                      <button className="icon-btn" aria-label={`Edit ${s.name}`} title="Edit supplier" onClick={() => setEditSup(s)}><IconEdit /></button>
                      <button className="icon-btn danger" aria-label={`Delete ${s.name}`} title="Delete supplier" onClick={() => setDelSup(s)}><IconTrash /></button>
                    </div></td>
                  </tr>
                ))}
                {!suppliers.length && <tr><td colSpan={5}><div className="empty"><b>No suppliers yet</b><span>Add the companies you buy stock from.</span></div></td></tr>}
              </tbody>
            </table>
          </div></div>
        )}
      </div>

      {receiving && <ReceiveDialog suppliers={suppliers} onClose={() => setReceiving(false)} onSaved={() => { setReceiving(false); setTab('Receipts'); load() }} />}

      {detail && (
        <div className="overlay" onClick={() => setDetail(null)}>
          <div className="dialog" role="dialog" aria-modal="true" aria-label={detail.grn_no} onClick={(e) => e.stopPropagation()}>
            <h3>{detail.grn_no}</h3>
            <p className="muted" style={{ marginTop: -12 }}>{detail.created_at} · {detail.supplier ?? 'No supplier'}{detail.invoice_no && ` · Invoice ${detail.invoice_no}`}</p>
            <div className="card table-card"><table className="tbl">
              <thead><tr><th>Item</th><th className="r">Qty</th><th className="r">Cost</th><th className="r">Total</th></tr></thead>
              <tbody>{detail.items.map((i) => (
                <tr key={i.id}><td className="name">{i.name}</td><td className="r">{qtyFmt(i.qty)} {i.unit}</td><td className="r">{lkr(i.cost)}</td><td className="r">{lkr(i.line_total)}</td></tr>
              ))}</tbody>
            </table></div>
            <div className="totals-box">
              <div className="trow grand"><span>Total</span><span>{lkr(detail.total)}</span></div>
              <div className="trow"><span className="muted">Paid at receipt</span><span>{lkr(detail.paid)}</span></div>
            </div>
            {detail.note && <p className="muted">Note: {detail.note}</p>}
            <div className="dialog-actions"><button className="btn primary" onClick={() => setDetail(null)}>Close</button></div>
          </div>
        </div>
      )}

      {editSup && <SupplierDialog s={editSup} onClose={() => setEditSup(null)} onSaved={() => { setEditSup(null); load() }} />}
      {paySup && <PayDialog s={paySup} onClose={() => setPaySup(null)} onSaved={() => { setPaySup(null); load() }} />}

      {delSup && (
        <div className="overlay" onClick={() => setDelSup(null)}>
          <div className="dialog small" role="alertdialog" aria-modal="true" aria-label="Delete supplier" onClick={(e) => e.stopPropagation()}>
            <h3>Delete “{delSup.name}”?</h3>
            <p className="muted">Past stock receipts from this supplier are kept.{delSup.balance > 0.004 && ` You still owe ${lkr(delSup.balance)}.`}</p>
            <div className="dialog-actions">
              <button className="btn" autoFocus onClick={() => setDelSup(null)}>Keep supplier</button>
              <button className="btn danger" onClick={async () => { await window.api.deleteSupplier(delSup.id); setDelSup(null); load() }}><IconTrash /> Delete supplier</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SupplierDialog({ s, onClose, onSaved }: { s: Partial<Supplier>; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState(s)
  const [error, setError] = useState('')
  const set = (k: keyof Supplier, v: string) => setD((x) => ({ ...x, [k]: v }))
  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={d.id ? 'Edit supplier' : 'Add supplier'} onClick={(e) => e.stopPropagation()}>
        <h3>{d.id ? 'Edit supplier' : 'Add supplier'}</h3>
        <div className="form">
          <label className="field full">Name<input autoFocus value={d.name ?? ''} onChange={(e) => set('name', e.target.value)} /></label>
          <label className="field">Phone<input value={d.phone ?? ''} onChange={(e) => set('phone', e.target.value)} /></label>
          <label className="field">Address<input value={d.address ?? ''} onChange={(e) => set('address', e.target.value)} /></label>
          <label className="field full">Notes<input value={d.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></label>
        </div>
        {error && <p className="err" style={{ marginTop: 12 }} role="alert">{error}</p>}
        <div className="dialog-actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={async () => { try { await window.api.saveSupplier(d); onSaved() } catch (e: any) { setError(e.message) } }}>Save supplier</button>
        </div>
      </div>
    </div>
  )
}

function PayDialog({ s, onClose, onSaved }: { s: Supplier; onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = useState(String(s.balance.toFixed(2)))
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog small" role="dialog" aria-modal="true" aria-label="Record payment" onClick={(e) => e.stopPropagation()}>
        <h3>Pay {s.name}</h3>
        <p className="muted" style={{ marginTop: -12 }}>You owe {lkr(s.balance)}</p>
        <div className="form" style={{ gridTemplateColumns: '1fr' }}>
          <label className="field">Amount paid (Rs.)<input autoFocus type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
          <label className="field">Note<input value={note} placeholder="e.g. cheque no." onChange={(e) => setNote(e.target.value)} /></label>
        </div>
        {error && <p className="err" style={{ marginTop: 12 }} role="alert">{error}</p>}
        <div className="dialog-actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={async () => { try { await window.api.paySupplier(s.id, parseFloat(amount), note); onSaved() } catch (e: any) { setError(e.message) } }}>Save payment</button>
        </div>
      </div>
    </div>
  )
}

interface Line { product: Product; qty: number; cost: number }

function ReceiveDialog({ suppliers, onClose, onSaved }: { suppliers: Supplier[]; onClose: () => void; onSaved: () => void }) {
  const [supplierId, setSupplierId] = useState<string>('')
  const [invoiceNo, setInvoiceNo] = useState('')
  const [note, setNote] = useState('')
  const [q, setQ] = useState('')
  const [found, setFound] = useState<Product[]>([])
  const [lines, setLines] = useState<Line[]>([])
  const [paid, setPaid] = useState('')
  const [updateCost, setUpdateCost] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!q.trim()) return setFound([])
    window.api.searchProducts(q).then((r) => setFound(r.slice(0, 6)))
  }, [q])

  const add = (p: Product) => {
    setLines((l) => (l.some((x) => x.product.id === p.id) ? l : [...l, { product: p, qty: 1, cost: p.cost }]))
    setQ('')
  }
  const total = lines.reduce((a, l) => a + l.qty * l.cost, 0)
  const paidNum = paid === '' ? 0 : parseFloat(paid) || 0

  const submit = async () => {
    setError('')
    try {
      await window.api.createPurchase({
        supplierId: supplierId ? Number(supplierId) : null,
        invoiceNo,
        note,
        paid: Math.min(paidNum, total),
        updateCost,
        items: lines.map((l) => ({ productId: l.product.id, qty: l.qty, cost: l.cost }))
      })
      onSaved()
    } catch (e: any) {
      setError(e.message)
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog wide" role="dialog" aria-modal="true" aria-label="Receive stock" onClick={(e) => e.stopPropagation()}>
        <h3>Receive stock</h3>
        <div className="form">
          <label className="field">Supplier
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">No supplier</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="field">Supplier invoice no.<input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} /></label>
        </div>

        <div className="searchbox" style={{ maxWidth: 'none', marginTop: 16 }}>
          <IconSearch />
          <input aria-label="Add a product" placeholder="Search a product to add (name, SKU, barcode)" value={q} onChange={(e) => setQ(e.target.value)} />
          {found.length > 0 && (
            <div className="pick-list" role="listbox">
              {found.map((p) => (
                <button key={p.id} role="option" aria-selected="false" className="pick-item" onClick={() => add(p)}>
                  <span>{p.name}</span><span className="muted">{p.sku} · stock {qtyFmt(p.stock)} {p.unit}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="card table-card" style={{ marginTop: 12 }}>
          <div className="table-scroll"><table className="tbl">
            <thead><tr><th>Item</th><th className="r">Qty</th><th className="r">Cost / unit</th><th className="r">Total</th><th></th></tr></thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={l.product.id}>
                  <td className="name">{l.product.name}<div className="muted" style={{ fontWeight: 400, fontSize: 12 }}>was {lkr(l.product.cost)} · {l.product.unit}</div></td>
                  <td className="r"><input type="number" min="0" step="any" aria-label={`Quantity of ${l.product.name}`} style={{ width: 90, textAlign: 'right' }} value={l.qty} onChange={(e) => setLines((x) => x.map((y, k) => k === i ? { ...y, qty: parseFloat(e.target.value) || 0 } : y))} /></td>
                  <td className="r"><input type="number" min="0" step="0.01" aria-label={`Cost of ${l.product.name}`} style={{ width: 110, textAlign: 'right' }} value={l.cost} onChange={(e) => setLines((x) => x.map((y, k) => k === i ? { ...y, cost: parseFloat(e.target.value) || 0 } : y))} /></td>
                  <td className="r">{lkr(l.qty * l.cost)}</td>
                  <td className="r"><button className="icon-btn danger" aria-label={`Remove ${l.product.name}`} onClick={() => setLines((x) => x.filter((_, k) => k !== i))}><IconX size="sm" /></button></td>
                </tr>
              ))}
              {!lines.length && <tr><td colSpan={5}><div className="empty" style={{ padding: 24 }}><span>Search above to add the items you received.</span></div></td></tr>}
            </tbody>
          </table></div>
        </div>

        <div className="form" style={{ marginTop: 16 }}>
          <label className="field">Paid now (Rs.) <span className="hint">leave blank if on credit</span>
            <input type="number" min="0" step="0.01" value={paid} placeholder="0.00" onChange={(e) => setPaid(e.target.value)} />
          </label>
          <label className="field">Note<input value={note} onChange={(e) => setNote(e.target.value)} /></label>
          <label className="check full"><input type="checkbox" checked={updateCost} onChange={(e) => setUpdateCost(e.target.checked)} />Update each product’s cost price to this delivery’s cost</label>
        </div>
        <div className="totals-box">
          <div className="trow grand"><span>Total</span><span>{lkr(total)}</span></div>
          {total - Math.min(paidNum, total) > 0.004 && <div className="trow"><span className="muted">Left to pay supplier</span><span>{lkr(total - Math.min(paidNum, total))}</span></div>}
        </div>
        {error && <p className="err" style={{ marginTop: 12 }} role="alert">{error}</p>}
        <div className="dialog-actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!lines.length} onClick={submit}>Add to stock</button>
        </div>
      </div>
    </div>
  )
}
