// A small stand-in for node:sqlite's DatabaseSync, backed by sql.js (SQLite compiled to WebAssembly).
// It runs entirely in memory, so a reload starts from the seed data again.
import initSqlJs from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'

const SQL = await initSqlJs({ locateFile: () => wasmUrl })

const clean = (args: unknown[]) => args.map((a) => (a === undefined ? null : typeof a === 'boolean' ? (a ? 1 : 0) : a))

export class DatabaseSync {
  private db = new SQL.Database()

  exec(sql: string) {
    this.db.exec(sql)
  }

  prepare(sql: string) {
    const db = this.db
    const rows = (args: unknown[]) => {
      const st = db.prepare(sql)
      try {
        st.bind(clean(args) as any)
        const out: any[] = []
        while (st.step()) out.push(st.getAsObject())
        return out
      } finally {
        st.free()
      }
    }
    return {
      get: (...args: unknown[]) => rows(args)[0],
      all: (...args: unknown[]) => rows(args),
      run: (...args: unknown[]) => {
        db.run(sql, clean(args) as any)
        const id = db.exec('SELECT last_insert_rowid()')[0]?.values[0]?.[0] ?? 0
        return { lastInsertRowid: Number(id), changes: db.getRowsModified() }
      }
    }
  }

  close() {
    this.db.close()
  }
}
