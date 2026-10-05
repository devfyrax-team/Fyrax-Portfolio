import { useEffect, useRef, useState } from 'react'
import type { Product, Sale, Settings } from '../types'
import { lkr, qtyFmt, receiptHtml } from '../util'
import { IconPrinter, IconSearch, IconX } from '../icons'

interface CartLine {
  product: Product
  qty: number
  price: number
}

const METHODS = ['cash', 'card']

const catOf = (p: Product) => p.category?.trim() || 'Uncategorised'

/** Quick "customer gives" amounts: exact, then rounded up to the next 500 / 1,000 / 5,000. */
const cashOpts = (total: number) => {
  const up = (step: number) => Math.ceil(total / step) * step
  const seen = new Set<number>()
  return [{ label: 'Exact', v: total }, ...[500, 1000, 5000].map((st) => ({ label: lkr(up(st)).replace(/\.00$/, ''), v: up(st) }))].filter(
    (o) => o.v > 0 && !seen.has(o.v) && seen.add(o.v)
  )
}

function Stepper({ value, onChange, step, label }: { value: number; onChange: (v: number) => void; step: number; label: string }) {
  return (
    <div className="stepper">
      <button className="step minus" aria-label={`Decrease ${label}`} disabled={value <= step} onClick={() => onChange(Math.max(step, +(value - step).toFixed(3)))}>
        −
      </button>
      <input
        type="number"
        min="0"
        step={step}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      />
      <button className="step plus" aria-label={`Increase ${label}`} onClick={() => onChange(+(value + step).toFixed(3))}>
        +
      </button>
    </div>
  )
}

export default function Checkout({
  settings,
  category,
  onCategory
}: {
  settings: Settings
  category: string
  onCategory: (c: string) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Product[]>([])
  const [cart, setCart] = useState<CartLine[]>([])
  const [discount, setDiscount] = useState(0)
  const [method, setMethod] = useState('cash')
  const [tendered, setTendered] = useState('')
  const [done, setDone] = useState<{ sale: Sale; change: number } | null>(null)
  const [error, setError] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    window.api.searchProducts(query).then(setResults)
  }, [query])

  useEffect(() => {
    searchRef.current?.focus()
  }, [done])

  const rate = parseFloat(settings.vat_rate) || 0
  const inclusive = settings.vat_inclusive === '1'
  const subtotal = cart.reduce((a, l) => a + l.qty * l.price, 0)
  const disc = Math.min(discount || 0, subtotal)
  const net = subtotal - disc
  const tax = inclusive ? (net * rate) / (100 + rate) : (net * rate) / 100
  const total = inclusive ? net : net + tax
  const paid = tendered === '' ? total : parseFloat(tendered) || 0
  const change = Math.max(0, paid - total)
  const short = method !== 'credit' && paid < total

  const counts = new Map<string, number>()
  for (const p of results) counts.set(catOf(p), (counts.get(catOf(p)) ?? 0) + 1)
  const cats = [...counts.keys()].sort((a, b) => a.localeCompare(b))
  if (category !== 'All' && !counts.has(category)) cats.unshift(category)
  const shown = category === 'All' ? results : results.filter((p) => catOf(p) === category)

  const stockText = (p: Product) =>
    p.stock <= 0 ? 'Out of stock' : p.stock <= p.reorder_level ? `Only ${qtyFmt(p.stock)} left` : `${qtyFmt(p.stock)} in stock`
  const inCart = (p: Product) => cart.find((l) => l.product.id === p.id)?.qty ?? 0

  const add = (p: Product, qty = 1) => {
    if (qty <= 0) return
    setError('')
    setCart((c) => {
      const i = c.findIndex((l) => l.product.id === p.id)
      if (i >= 0) return c.map((l, k) => (k === i ? { ...l, qty: +(l.qty + qty).toFixed(3) } : l))
      return [...c, { product: p, qty, price: p.price }]
    })
  }

  const onSearchEnter = async () => {
    const code = query.trim()
    if (!code) return
    const exact = await window.api.productByCode(code)
    if (exact) {
      add(exact)
      setQuery('')
    } else if (shown.length === 1) {
      add(shown[0])
      setQuery('')
    }
  }

  const complete = async () => {
    if (!cart.length) return
    if (method !== 'credit' && paid < total) {
      setError('The amount paid is less than the total. Enter the full amount or change the method.')
      return
    }
    const sale = await window.api.createSale({
      items: cart.map((l) => ({ productId: l.product.id, qty: l.qty, price: l.price })),
      discount: disc,
      paid: method === 'credit' ? 0 : paid,
      method
    })
    setDone({ sale, change })
    setCart([])
    setDiscount(0)
    setTendered('')
    setQuery('')
    if (settings.auto_print !== '0') window.api.printReceipt(receiptHtml(sale, settings, change))
  }

  if (done)
    return (
      <div className="card done">
        <span className="done-tick" aria-hidden="true">✓</span>
        <h2>Sale complete</h2>
        <p className="muted">
          Bill {done.sale.receipt_no}
          {settings.auto_print !== '0' ? ' · Receipt is printing' : ''}
        </p>
        <p className="big">{lkr(done.sale.total)}</p>
        {done.change > 0 && <p className="change-ok">Give change {lkr(done.change)}</p>}
        <div className="done-actions">
          <button className="btn primary lg" autoFocus onClick={() => setDone(null)}>
            Start new sale
          </button>
          <button className="btn outline lg" onClick={() => window.api.printReceipt(receiptHtml(done.sale, settings, done.change))}>
            <IconPrinter /> Reprint receipt
          </button>
        </div>
      </div>
    )

  return (
    <div className="checkout">
      <section className="checkout-main">
        <div className="sell-top">
          <div className="searchbox big">
            <IconSearch />
            <input
              ref={searchRef}
              aria-label="Search products"
              placeholder="Scan a barcode or type a product name"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSearchEnter()}
            />
          </div>
          <div className="cat-chips" role="group" aria-label="Categories">
            {['All', ...cats].map((c) => (
              <button key={c} className={c === category ? 'fchip on' : 'fchip'} aria-pressed={c === category} onClick={() => onCategory(c)}>
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="menu-grid">
          {shown.map((p) => {
            const n = inCart(p)
            const low = p.stock <= p.reorder_level
            return (
              <button key={p.id} className="prod" onClick={() => add(p)} aria-label={`Add ${p.name} to bill`}>
                <span className="prod-cat">{catOf(p)}</span>
                <span className="prod-name">{p.name}</span>
                <span className="prod-price">
                  {lkr(p.price)} <small>/ {p.unit}</small>
                </span>
                <span className={p.stock <= 0 ? 'prod-stock out' : low ? 'prod-stock low' : 'prod-stock'}>{stockText(p)}</span>
                {n > 0 && <span className="prod-badge">{qtyFmt(n)}</span>}
              </button>
            )
          })}
          {!shown.length && (
            <div className="empty">
              <b>No products match “{query}”</b>
              <span>Check the spelling, or choose All.</span>
            </div>
          )}
        </div>
      </section>

      <aside className="checkout-side" aria-label="Current bill">
        <div className="bill-head">
          <h2>Current bill</h2>
          {!!cart.length && (
            <button className="link-danger" onClick={() => setCart([])}>
              Clear all
            </button>
          )}
        </div>

        <div className="bill-lines">
          {!cart.length && (
            <div className="empty-dash">
              <b>No items yet</b>
              Scan a barcode or tap a product to start the bill.
            </div>
          )}
          {cart.map((l, i) => (
            <div key={l.product.id} className="bill-line">
              <div className="bill-line-top">
                <span className="bill-line-name">{l.product.name}</span>
                <b className="bill-line-total">{lkr(l.qty * l.price)}</b>
              </div>
              <div className="bill-line-ctl">
                <Stepper
                  label={`bill quantity of ${l.product.name}`}
                  step={l.product.allow_fraction ? 0.5 : 1}
                  value={l.qty}
                  onChange={(q) => setCart((c) => c.map((x, k) => (k === i ? { ...x, qty: q } : x)))}
                />
                <label className="bill-price">
                  Rs.
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    aria-label={`Unit price of ${l.product.name}`}
                    value={l.price}
                    onChange={(e) => {
                      const p = parseFloat(e.target.value) || 0
                      setCart((c) => c.map((x, k) => (k === i ? { ...x, price: p } : x)))
                    }}
                  />
                  / {l.product.unit}
                </label>
                <button className="icon-btn danger" aria-label={`Remove ${l.product.name}`} onClick={() => setCart((c) => c.filter((_, k) => k !== i))}>
                  <IconX size="sm" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="bill-foot">
          <div className="trow small">
            <span className="muted">
              Subtotal ({cart.length} {cart.length === 1 ? 'item' : 'items'})
            </span>
            <span>{lkr(subtotal)}</span>
          </div>
          <label className="trow small">
            <span className="muted">Discount (Rs.)</span>
            <input type="number" min="0" placeholder="0.00" value={discount || ''} onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)} />
          </label>
          {rate > 0 && (
            <div className="trow small">
              <span className="muted">
                VAT {rate}%{inclusive ? ' (included)' : ''}
              </span>
              <span>{lkr(tax)}</span>
            </div>
          )}
          <div className="trow grand">
            <span>Total to pay</span>
            <span>{lkr(total)}</span>
          </div>

          <div className="pay-methods" role="radiogroup" aria-label="Payment method">
            {METHODS.map((m) => (
              <button key={m} role="radio" aria-checked={m === method} className={m === method ? 'pay on' : 'pay'} onClick={() => setMethod(m)}>
                {m === 'cash' ? 'Cash' : 'Card'}
              </button>
            ))}
          </div>
          {method === 'cash' && (
            <>
              <div className="label">Customer gives</div>
              <div className="quick-cash">
                {cashOpts(total).map((o) => (
                  <button key={o.label} className={tendered === String(o.v) ? 'qc on' : 'qc'} onClick={() => setTendered(o.v === total ? '' : String(o.v))}>
                    {o.label}
                  </button>
                ))}
                <input
                  className="qc-input"
                  type="number"
                  min="0"
                  aria-label="Other amount paid"
                  placeholder="Other amount"
                  value={cashOpts(total).some((o) => String(o.v) === tendered) ? '' : tendered}
                  onChange={(e) => setTendered(e.target.value)}
                />
              </div>
              <div className={short ? 'change-box short' : 'change-box'}>
                <span>{short ? 'Still to collect' : 'Change to give'}</span>
                <b>{short ? lkr(total - paid) : lkr(change)}</b>
              </div>
            </>
          )}
          {error && (
            <p className="err" role="alert">
              {error}
            </p>
          )}
          <button className="btn primary xl wide" disabled={!cart.length || (method === 'cash' && short)} onClick={complete}>
            {cart.length ? `Complete sale · ${lkr(total)}` : 'Add items to start'}
          </button>
        </div>
      </aside>
    </div>
  )
}
