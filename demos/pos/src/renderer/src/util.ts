import type { Sale, SaleReturn, Settings } from './types'

export const lkr = (n: number) =>
  'Rs. ' + (n || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const qtyFmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/0+$/, ''))

export const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

function slip(s: Settings, body: string): string {
  const narrow = s.paper_width === '58'
  const page = narrow ? 58 : 80
  const content = narrow ? 48 : 72
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: ${page}mm auto; margin: 0 }
    body { width: ${content}mm; margin: 0 ${(page - content) / 2}mm; font: ${narrow ? 11 : 12}px monospace; color: #000 }
    h1 { font-size: 15px; text-align: center; margin: 4px 0 }
    .c { text-align: center } .r { text-align: right }
    table { width: 100%; border-collapse: collapse } hr { border: 0; border-top: 1px dashed #000 }
  </style></head><body>
    <h1>${esc(s.shop_name || '')}</h1>
    <div class="c">${esc(s.shop_address || '')}</div><div class="c">${esc(s.shop_phone || '')}</div><hr>
    ${body}
    <hr><div class="c">${esc(s.receipt_footer || '')}</div>
  </body></html>`
}

export function receiptHtml(sale: Sale, s: Settings, change: number): string {
  const rows = sale.items
    .map(
      (i) => `<tr><td colspan="3">${esc(i.name)}</td></tr>
      <tr><td>${qtyFmt(i.qty)} ${esc(i.unit)} x ${i.price.toFixed(2)}</td><td></td><td class="r">${i.line_total.toFixed(2)}</td></tr>`
    )
    .join('')
  return slip(
    s,
    `<div>Bill: ${sale.receipt_no}</div><div>${sale.created_at}</div>${sale.cashier ? `<div>Cashier: ${esc(sale.cashier)}</div>` : ''}<hr>
    <table>${rows}</table><hr>
    <table>
      <tr><td>Subtotal</td><td class="r">${sale.subtotal.toFixed(2)}</td></tr>
      ${sale.discount ? `<tr><td>Discount</td><td class="r">-${sale.discount.toFixed(2)}</td></tr>` : ''}
      ${sale.tax ? `<tr><td>VAT</td><td class="r">${sale.tax.toFixed(2)}</td></tr>` : ''}
      <tr><td><b>TOTAL</b></td><td class="r"><b>${sale.total.toFixed(2)}</b></td></tr>
      <tr><td>Paid (${sale.method})</td><td class="r">${sale.paid.toFixed(2)}</td></tr>
      <tr><td>Change</td><td class="r">${change.toFixed(2)}</td></tr>
    </table>`
  )
}

export function refundHtml(ret: SaleReturn, receiptNo: string, s: Settings): string {
  const rows = (ret.items ?? [])
    .map((i) => `<tr><td>${esc(i.name)}<br>${qtyFmt(i.qty)} ${esc(i.unit)}</td><td class="r">${i.amount.toFixed(2)}</td></tr>`)
    .join('')
  return slip(
    s,
    `<div class="c"><b>REFUND</b></div>
    <div>Refund: ${ret.return_no}</div><div>Original bill: ${receiptNo}</div><div>${ret.created_at}</div><hr>
    <table>${rows}</table><hr>
    <table><tr><td><b>REFUNDED (${ret.method})</b></td><td class="r"><b>${ret.total.toFixed(2)}</b></td></tr></table>
    ${ret.reason ? `<div>Reason: ${esc(ret.reason)}</div>` : ''}`
  )
}

export function testReceiptHtml(s: Settings): string {
  return slip(s, `<div class="c"><b>PRINTER TEST</b></div><div class="c">If you can read this, printing works.</div><div class="c">${new Date().toLocaleString()}</div>`)
}
