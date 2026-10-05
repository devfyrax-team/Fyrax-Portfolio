export type Role = 'owner' | 'manager' | 'cashier'

export interface User {
  id: number
  name: string
  role: Role
}
export interface UserRow extends User {
  active: number
}
export interface AuthState {
  hasUsers: boolean
  user: User | null
  users: User[]
}

export interface Product {
  id: number
  sku: string
  barcode: string | null
  name: string
  category: string
  unit: string
  allow_fraction: number
  cost: number
  price: number
  reorder_level: number
  stock: number
  has_image: number
}

export interface SaleItem {
  id: number
  product_id: number
  name: string
  unit: string
  qty: number
  price: number
  line_total: number
  returned: number
}

export interface ReturnItem {
  name: string
  unit: string
  qty: number
  amount: number
}

export interface SaleReturn {
  id: number
  return_no: string
  total: number
  method: string
  reason: string
  restock: number
  created_at: string
  items?: ReturnItem[]
  cashier?: string
}

export interface Sale {
  id: number
  receipt_no: string
  subtotal: number
  discount: number
  tax: number
  total: number
  paid: number
  method: string
  created_at: string
  cashier: string | null
  items: SaleItem[]
  returns: SaleReturn[]
}

export interface SaleSummary {
  id: number
  receipt_no: string
  total: number
  method: string
  created_at: string
  cashier: string | null
  refunded: number
}

export interface Supplier {
  id: number
  name: string
  phone: string
  address: string
  notes: string
  balance: number
}

export interface Purchase {
  id: number
  grn_no: string
  supplier: string | null
  invoice_no: string
  total: number
  paid: number
  note: string
  created_at: string
  received_by: string | null
  lines: number
}

export interface PurchaseDetail extends Purchase {
  items: { id: number; name: string; unit: string; qty: number; cost: number; line_total: number }[]
}

export interface ImportResult {
  created: number
  updated: number
  skipped: number
  errors: { line: number; message: string }[]
}

export interface BackupInfo {
  dirs: string[]
  defaultDir: string
  last: string
  backups: { path: string; name: string; size: number; mtime: number; dir: string }[]
}

export interface LicenseStatus {
  state: 'licensed' | 'trial' | 'expired' | 'unlicensed'
  machineId: string
  shop?: string
  expires?: string
  daysLeft?: number
  problem?: string
}

export type Settings = Record<string, string>

declare global {
  interface Window {
    api: {
      licenseStatus(): Promise<LicenseStatus>
      activateLicense(token: string): Promise<LicenseStatus>
      authState(): Promise<AuthState>
      setup(i: { ownerName: string; pin: string; shopName?: string; sample?: boolean }): Promise<User>
      login(userId: number, pin: string): Promise<User>
      logout(): Promise<void>
      listUsers(): Promise<UserRow[]>
      saveUser(u: { id?: number; name: string; role: Role; pin?: string; active?: number }): Promise<void>

      searchProducts(q: string): Promise<Product[]>
      productByCode(code: string): Promise<Product | null>
      saveProduct(p: Partial<Product> & { opening_stock?: number; image?: string | null }): Promise<number>
      pickProductImage(): Promise<string | null>
      productImages(ids: number[]): Promise<Record<number, string>>
      deleteProduct(id: number): Promise<void>
      adjustStock(productId: number, qty: number, reason: string, ref?: string): Promise<void>
      lowStock(): Promise<Product[]>
      exportProducts(): Promise<{ path: string; count: number } | null>
      productTemplate(): Promise<{ path: string } | null>
      importProducts(): Promise<ImportResult | null>

      createSale(input: {
        items: { productId: number; qty: number; price: number }[]
        discount: number
        paid: number
        method: string
      }): Promise<Sale>
      getSale(id: number): Promise<Sale>
      listSales(q: { date?: string; text?: string }): Promise<SaleSummary[]>
      createReturn(input: {
        saleId: number
        items: { saleItemId: number; qty: number }[]
        method: string
        restock: boolean
        reason: string
      }): Promise<SaleReturn>
      dailyReport(date: string): Promise<any>

      listSuppliers(): Promise<Supplier[]>
      saveSupplier(s: Partial<Supplier>): Promise<number>
      deleteSupplier(id: number): Promise<void>
      paySupplier(supplierId: number, amount: number, note: string): Promise<void>
      createPurchase(input: {
        supplierId: number | null
        invoiceNo?: string
        note?: string
        paid?: number
        updateCost: boolean
        items: { productId: number; qty: number; cost: number }[]
      }): Promise<Purchase>
      listPurchases(): Promise<Purchase[]>
      getPurchase(id: number): Promise<PurchaseDetail>

      getSettings(): Promise<Settings>
      setSettings(kv: Settings): Promise<void>
      listPrinters(): Promise<{ name: string; label: string }[]>
      printReceipt(html: string): Promise<{ ok: boolean; reason: string }>
      backupInfo(): Promise<BackupInfo>
      backupNow(): Promise<{ ok: string[]; failed: { dir: string; error: string }[] }>
      backupChooseDir(which: 1 | 2): Promise<string | null>
      backupClearDir2(): Promise<void>
      backupRestore(file: string | null): Promise<boolean>
    }
  }
}
