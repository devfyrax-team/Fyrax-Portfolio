import { useEffect, useRef, useState } from 'react'
import type { Product, Sale, Settings } from '../types'
import { lkr, qtyFmt, receiptHtml } from '../util'
import { IconBolt, IconPlusSquare, IconPrinter, IconSearch, IconX } from '../icons'
import { ProductThumb, useProductImages } from '../ProductImage'

interface CartLine {
  product: Product
  qty: number
  price: number
}

const METHODS = ['cash', 'card']

const catOf = (p: Product) => p.category?.trim() || 'Uncategorised'
const tint = (s: string) => 't' + ([...s].reduce((a, c) => a + c.charCodeAt(0), 0) % 6)

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
  const [pick, setPick] = useState<Record<number, number>>({})
  const [cart, setCart] = useState<CartLine[]>([])
  const [discount, setDiscount] = useState(0)
  const [method, setMethod] = useState('cash')
  const [tendered, setTendered] = useState('')
  const [done, setDone] = useState<{ sale: Sale; change: number } | null>(null)
  const [error, setError] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const imageOf = useProductImages(results)

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

  const counts = new Map<string, number>()
  for (const p of results) counts.set(catOf(p), (counts.get(catOf(p)) ?? 0) + 1)
  const cats = [...counts.keys()].sort((a, b) => a.localeCompare(b))
  if (category !== 'All' && !counts.has(category)) cats.unshift(category)
  const shown = category === 'All' ? results : results.filter((p) => catOf(p) === category)

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
    setPick({})
    if (settings.auto_print !== '0') window.api.printReceipt(receiptHtml(sale, settings, change))
  }

  if (done)
    return (
      <div className="card done">
        <span className="pill ok">Paid</span>
        <h2>Sale complete</h2>
        <p className="muted">Bill {done.sale.receipt_no}</p>
        <p className="big">{lkr(done.sale.total)}</p>
        {done.change > 0 && (
          <p>
            Change: <b>{lkr(done.change)}</b>
          </p>
        )}
        <div className="done-actions">
          <button className="btn outline" onClick={() => window.api.printReceipt(receiptHtml(done.sale, settings, done.change))}>
            <IconPrinter /> Reprint receipt
          </button>
          <button className="btn primary" autoFocus onClick={() => setDone(null)}>
            Start new sale
          </button>
        </div>
      </div>
    )

  return (
    <div className="checkout">
      <section className="checkout-main">
        <div className="page-head">
          <h1 className="page-title">Checkout</h1>
          <div className="searchbox">
            <IconSearch />
            <input
              ref={searchRef}
              aria-label="Search products"
              placeholder="Scan barcode or search name / SKU"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSearchEnter()}
            />
          </div>
        </div>

        <div className="tabs" role="tablist" style={{ padding: '0 32px', marginTop: 12 }}>
          {['All', ...cats].map((c) => (
            <button key={c} role="tab" aria-selected={c === category} className={c === category ? 'tab active' : 'tab'} onClick={() => onCategory(c)}>
              {c}
              <span className="badge-count">{c === 'All' ? results.length : counts.get(c) ?? 0}</span>
            </button>
          ))}
        </div>

        <div className="menu-grid">
          {shown.map((p) => {
            const step = p.allow_fraction ? 0.5 : 1
            const q = pick[p.id] ?? 1
            const low = p.stock <= p.reorder_level
            return (
              <article key={p.id} className="card product">
                <div className="product-top">
                  <ProductThumb src={imageOf(p.id)} tint={tint(catOf(p))} name={p.name} />
                  <div style={{ minWidth: 0 }}>
                    <div className="product-name">{p.name}</div>
                    <div className={low ? 'product-meta low' : 'product-meta'}>
                      {qtyFmt(p.stock)} {p.unit} available{low ? ' · low' : ''}
                    </div>
                    <div className="product-price">
                      {lkr(p.price)} <small>/ {p.unit}</small>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="label" style={{ marginBottom: 8 }}>Quantity</div>
                  <Stepper label={`quantity of ${p.name}`} step={step} value={q} onChange={(v) => setPick((m) => ({ ...m, [p.id]: v }))} />
                </div>
                <button
                  className="btn primary"
                  onClick={() => {
                    add(p, q)
                    setPick((m) => ({ ...m, [p.id]: 1 }))
                  }}
                >
                  Add to bill <IconPlusSquare />
                </button>
              </article>
            )
          })}
          {!shown.length && (
            <div className="empty">
              <b>No products match</b>
              <span>Try a different name, SKU or barcode, or choose “All”.</span>
            </div>
          )}
        </div>
      </section>

      <aside className="checkout-side" aria-label="Current bill">
        <div className="bill-head">
          <h2>Current bill</h2>
          <span className="pill info">
            {cart.length} {cart.length === 1 ? 'item' : 'items'}
          </span>
        </div>

        <div className="bill-lines">
          {!cart.length && (
            <div className="empty">
              <b>The bill is empty</b>
              <span>Scan a barcode or tap “Add to bill” on a product.</span>
            </div>
          )}
          {cart.map((l, i) => (
            <div key={l.product.id} className="card bill-line">
              <div className="bill-line-top">
                <span className="bill-line-name">{l.product.name}</span>
                <button className="icon-btn danger" aria-label={`Remove ${l.product.name}`} onClick={() => setCart((c) => c.filter((_, k) => k !== i))}>
                  <IconX size="sm" />
                </button>
              </div>
              <div className="bill-line-ctl">
                <Stepper
                  label={`bill quantity of ${l.product.name}`}
                  step={l.product.allow_fraction ? 0.5 : 1}
                  value={l.qty}
                  onChange={(q) => setCart((c) => c.map((x, k) => (k === i ? { ...x, qty: q } : x)))}
                />
                <span className="bill-line-total">{lkr(l.qty * l.price)}</span>
              </div>
              <label className="bill-line-ctl price">
                {l.product.unit} × Rs.
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
              </label>
            </div>
          ))}
        </div>

        <div className="bill-foot">
          <div className="trow">
            <span className="muted">Subtotal</span>
            <span>{lkr(subtotal)}</span>
          </div>
          <label className="trow">
            <span className="muted">Discount</span>
            <input type="number" min="0" placeholder="0.00" value={discount || ''} onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)} />
          </label>
          {rate > 0 && (
            <div className="trow">
              <span className="muted">
                VAT {rate}%{inclusive ? ' (incl.)' : ''}
              </span>
              <span>{lkr(tax)}</span>
            </div>
          )}
          <div className="trow grand">
            <span>Total</span>
            <span>{lkr(total)}</span>
          </div>

          <div className="chips" role="radiogroup" aria-label="Payment method">
            {METHODS.map((m) => (
              <button key={m} role="radio" aria-checked={m === method} className={m === method ? 'chip active' : 'chip'} onClick={() => setMethod(m)}>
                {m}
              </button>
            ))}
          </div>
          {method !== 'credit' && (
            <>
              <label className="trow">
                <span className="muted">Amount paid</span>
                <input type="number" min="0" placeholder={total.toFixed(2)} value={tendered} onChange={(e) => setTendered(e.target.value)} />
              </label>
              <div className="trow">
                <span className="muted">Change</span>
                <b>{lkr(change)}</b>
              </div>
            </>
          )}
          {error && <p className="err">{error}</p>}
          <button className="btn primary lg wide" disabled={!cart.length} onClick={complete}>
            Complete sale <IconBolt />
          </button>
          {!!cart.length && (
            <button className="btn ghost wide" onClick={() => setCart([])}>
              Clear bill
            </button>
          )}
        </div>
      </aside>
    </div>
  )
}
