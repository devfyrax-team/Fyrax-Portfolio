import { useEffect, useState } from 'react'
import type { ImportResult, Product } from '../types'
import { lkr, qtyFmt } from '../util'
import { IconEdit, IconPlus, IconSearch, IconTrash } from '../icons'
import { invalidateImage, ProductThumb, useProductImages } from '../ProductImage'

const UNITS = ['pcs', 'box', 'kg', 'g', 'm', 'ft', 'L', 'pack', 'roll', 'set']

// image: undefined = unchanged, null = remove, string = new picture (data URL)
type Draft = Partial<Product> & { opening_stock?: number; image?: string | null }
const blank: Draft = { sku: '', barcode: '', name: '', category: '', unit: 'pcs', allow_fraction: 0, cost: 0, price: 0, reorder_level: 0, opening_stock: 0 }

export default function Products() {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<Product[]>([])
  const [edit, setEdit] = useState<Draft | null>(null)
  const [adj, setAdj] = useState<Product | null>(null)
  const [adjQty, setAdjQty] = useState('')
  const [error, setError] = useState('')
  const [del, setDel] = useState<Product | null>(null)
  const [io, setIo] = useState<{ msg?: string; result?: ImportResult; error?: string } | null>(null)
  const [menu, setMenu] = useState(false)

  const imageOf = useProductImages(rows)
  const load = () => window.api.searchProducts(q).then(setRows)
  useEffect(() => {
    load()
  }, [q])

  const save = async () => {
    if (!edit?.name || !edit.sku) return setError('SKU and name are required.')
    try {
      const id = await window.api.saveProduct(edit)
      if (edit.image !== undefined) invalidateImage(id)
      setEdit(null)
      setError('')
      load()
    } catch (e: any) {
      setError(/UNIQUE/.test(e.message) ? 'That SKU or barcode already exists.' : e.message)
    }
  }

  const set = (k: keyof Draft, v: any) => setEdit((d) => ({ ...d!, [k]: v }))

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Products</h1>
          <div className="page-sub">{rows.length} {rows.length === 1 ? 'product' : 'products'}</div>
        </div>
        <div className="form-actions" style={{ flex: 1, justifyContent: 'flex-end' }}>
          <div className="searchbox">
            <IconSearch />
            <input aria-label="Search products" placeholder="Search name, SKU, barcode" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="menu-wrap">
            <button className="btn" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>Import / Export</button>
            {menu && (
              <div className="menu" role="menu" onMouseLeave={() => setMenu(false)}>
                <button role="menuitem" onClick={async () => {
                  setMenu(false)
                  try { const r = await window.api.importProducts(); if (r) { setIo({ result: r }); load() } } catch (e: any) { setIo({ error: e.message }) }
                }}>Import from CSV…</button>
                <button role="menuitem" onClick={async () => {
                  setMenu(false)
                  try { const r = await window.api.exportProducts(); if (r) setIo({ msg: `Exported ${r.count} products to ${r.path}` }) } catch (e: any) { setIo({ error: e.message }) }
                }}>Export to CSV…</button>
                <button role="menuitem" onClick={async () => {
                  setMenu(false)
                  try { const r = await window.api.productTemplate(); if (r) setIo({ msg: `Template saved to ${r.path}` }) } catch (e: any) { setIo({ error: e.message }) }
                }}>Download blank template…</button>
              </div>
            )}
          </div>
          <button className="btn primary" onClick={() => setEdit({ ...blank })}>
            <IconPlus /> Add product
          </button>
        </div>
      </div>

      <div className="page-body">
        <div className="card table-card">
          <div className="table-scroll">
            <table className="tbl">
              <thead>
                <tr><th aria-label="Picture"></th><th>SKU</th><th>Name</th><th>Category</th><th>Unit</th><th className="r">Cost</th><th className="r">Price</th><th className="r">Stock</th><th className="r">Actions</th></tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td className="thumb-cell"><ProductThumb small src={imageOf(p.id)} name={p.name} /></td>
                    <td className="muted">{p.sku}</td>
                    <td className="name">{p.name}</td>
                    <td>{p.category ? <span className="pill info">{p.category}</span> : <span className="muted">—</span>}</td>
                    <td>{p.unit}</td>
                    <td className="r">{lkr(p.cost)}</td>
                    <td className="r">{lkr(p.price)}</td>
                    <td className="r">
                      {p.stock <= p.reorder_level ? <span className="pill warn">{qtyFmt(p.stock)} low</span> : qtyFmt(p.stock)}
                    </td>
                    <td className="r">
                      <div className="actions">
                        <button className="btn sm outline" onClick={() => { setAdj(p); setAdjQty('') }}>Adjust stock</button>
                        <button className="icon-btn" title="Edit product" aria-label={`Edit ${p.name}`} onClick={() => setEdit(p)}><IconEdit /></button>
                        <button className="icon-btn danger" title="Delete product" aria-label={`Delete ${p.name}`} onClick={() => setDel(p)}><IconTrash /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr><td colSpan={9}><div className="empty"><b>No products found</b><span>Add your first product or change the search.</span></div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {edit && (
        <div className="overlay" onClick={() => setEdit(null)}>
          <div className="dialog" role="dialog" aria-modal="true" aria-label={edit.id ? 'Edit product' : 'Add product'} onClick={(e) => e.stopPropagation()}>
            <h3>{edit.id ? 'Edit product' : 'Add product'}</h3>
            <div className="form">
              <div className="full picture-row">
                <ProductThumb
                  src={edit.image === null ? '' : edit.image ?? (edit.id ? imageOf(edit.id) : '')}
                  name={edit.name}
                />
                <div className="picture-actions">
                  <div className="label">Picture <span className="muted">· shown on the checkout screen. Optional: products without one show a default picture.</span></div>
                  <div className="form-actions">
                    <button
                      type="button"
                      className="btn sm outline"
                      onClick={async () => {
                        try {
                          const img = await window.api.pickProductImage()
                          if (img) { set('image', img); setError('') }
                        } catch (e: any) {
                          setError(e.message)
                        }
                      }}
                    >
                      {edit.image || (edit.image === undefined && edit.has_image) ? 'Change picture…' : 'Choose picture…'}
                    </button>
                    {(edit.image || (edit.image === undefined && edit.has_image)) && (
                      <button type="button" className="btn sm ghost" onClick={() => set('image', null)}>Remove picture</button>
                    )}
                  </div>
                </div>
              </div>
              <label className="field">SKU<input value={edit.sku ?? ''} onChange={(e) => set('sku', e.target.value)} /></label>
              <label className="field">Barcode<input value={edit.barcode ?? ''} onChange={(e) => set('barcode', e.target.value)} /></label>
              <label className="field full">Name<input value={edit.name ?? ''} onChange={(e) => set('name', e.target.value)} /></label>
              <label className="field">Category<input value={edit.category ?? ''} onChange={(e) => set('category', e.target.value)} /></label>
              <label className="field">Unit
                <select value={edit.unit} onChange={(e) => set('unit', e.target.value)}>
                  {UNITS.map((u) => <option key={u}>{u}</option>)}
                </select>
              </label>
              <label className="field">Cost (Rs.)<input type="number" min="0" step="0.01" value={edit.cost ?? 0} onChange={(e) => set('cost', parseFloat(e.target.value) || 0)} /></label>
              <label className="field">Price (Rs.)<input type="number" min="0" step="0.01" value={edit.price ?? 0} onChange={(e) => set('price', parseFloat(e.target.value) || 0)} /></label>
              <label className="field">Reorder level<input type="number" min="0" value={edit.reorder_level ?? 0} onChange={(e) => set('reorder_level', parseFloat(e.target.value) || 0)} /></label>
              {!edit.id && <label className="field">Opening stock<input type="number" min="0" value={edit.opening_stock ?? 0} onChange={(e) => set('opening_stock', parseFloat(e.target.value) || 0)} /></label>}
              <label className="check full">
                <input type="checkbox" checked={!!edit.allow_fraction} onChange={(e) => set('allow_fraction', e.target.checked ? 1 : 0)} />
                Sold in fractions (e.g. 2.5 kg)
              </label>
            </div>
            {error && <p className="err" style={{ marginTop: 12 }}>{error}</p>}
            <div className="dialog-actions">
              <button className="btn" onClick={() => { setEdit(null); setError('') }}>Cancel</button>
              <button className="btn primary" onClick={save}>Save product</button>
            </div>
          </div>
        </div>
      )}

      {adj && (
        <div className="overlay" onClick={() => setAdj(null)}>
          <div className="dialog small" role="dialog" aria-modal="true" aria-label="Adjust stock" onClick={(e) => e.stopPropagation()}>
            <h3>Adjust stock</h3>
            <p style={{ marginTop: -8 }}><b>{adj.name}</b> <span className="muted">· on hand {qtyFmt(adj.stock)} {adj.unit}</span></p>
            <label className="field" style={{ marginTop: 16 }}>Quantity change <span className="hint">Use a minus sign to reduce, e.g. −5</span>
              <input autoFocus type="number" step="any" value={adjQty} onChange={(e) => setAdjQty(e.target.value)} />
            </label>
            <div className="dialog-actions">
              <button className="btn" onClick={() => setAdj(null)}>Cancel</button>
              <button
                className="btn primary"
                disabled={!parseFloat(adjQty)}
                onClick={async () => {
                  await window.api.adjustStock(adj.id, parseFloat(adjQty), 'adjustment')
                  setAdj(null)
                  load()
                }}
              >
                Save adjustment
              </button>
            </div>
          </div>
        </div>
      )}

      {io && (
        <div className="overlay" onClick={() => setIo(null)}>
          <div className="dialog small" role="dialog" aria-modal="true" aria-label="Import and export" onClick={(e) => e.stopPropagation()}>
            {io.error && (<><h3>That did not work</h3><p className="err" role="alert">{io.error}</p></>)}
            {io.msg && (<><h3>Done</h3><p className="muted" style={{ overflowWrap: 'anywhere' }}>{io.msg}</p></>)}
            {io.result && (
              <>
                <h3>Import finished</h3>
                <div className="chips" style={{ marginBottom: 12 }}>
                  <span className="pill ok">{io.result.created} added</span>
                  <span className="pill info">{io.result.updated} updated</span>
                  {io.result.skipped > 0 && <span className="pill warn">{io.result.skipped} skipped</span>}
                </div>
                <p className="muted" style={{ marginTop: 0 }}>A backup was saved just before the import.</p>
                {io.result.errors.length > 0 && (
                  <ul className="err-list">
                    {io.result.errors.map((e) => <li key={e.line}>Row {e.line}: {e.message}</li>)}
                  </ul>
                )}
              </>
            )}
            <div className="dialog-actions"><button className="btn primary" autoFocus onClick={() => setIo(null)}>Close</button></div>
          </div>
        </div>
      )}

      {del && (
        <div className="overlay" onClick={() => setDel(null)}>
          <div className="dialog small" role="alertdialog" aria-modal="true" aria-label="Delete product" onClick={(e) => e.stopPropagation()}>
            <h3>Delete “{del.name}”?</h3>
            <p className="muted">It will be removed from the product list. Past sales that include it are kept.</p>
            <div className="dialog-actions">
              <button className="btn" autoFocus onClick={() => setDel(null)}>Keep product</button>
              <button
                className="btn danger"
                onClick={async () => {
                  await window.api.deleteProduct(del.id)
                  setDel(null)
                  load()
                }}
              >
                <IconTrash /> Delete product
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
