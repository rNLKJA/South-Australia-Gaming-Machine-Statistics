import { limitRows, validateSql } from "./guard"

/**
 * The browser SQL engine: SQLite compiled to WebAssembly (sql.js), running in a Web Worker served
 * from /vendor/sqljs/. The worker holds an in-memory copy of the tidy tables, loaded once from
 * /ask/tidy-tables.sql; nothing is sent to this site's server. Every query is validated against
 * the allow-list first, capped at MAX_ROWS rows, and the worker is terminated (and reloaded on the
 * next query) if a query runs longer than QUERY_TIMEOUT_MS.
 */

export const WORKER_URL = "/vendor/sqljs/worker.sql-wasm.js"
export const SCRIPT_URL = "/ask/tidy-tables.sql"
export const MAX_ROWS = 500
export const QUERY_TIMEOUT_MS = 5000

export type Cell = string | number | null

export interface QueryResult {
  columns: string[]
  rows: Cell[][]
  /** True when more than MAX_ROWS rows matched and the extra rows were dropped. */
  truncated: boolean
  ms: number
}

export class SqlError extends Error {
  constructor(
    message: string,
    readonly kind: "rejected" | "sql" | "timeout" | "load"
  ) {
    super(message)
    this.name = "SqlError"
  }
}

interface WorkerReply {
  id: number
  results?: { columns: string[]; values: Cell[][] }[]
  error?: string
  ready?: boolean
}

export interface SqlEngine {
  query(sql: string): Promise<QueryResult>
  tables(): string[]
}

/** Run a validated query on an engine-like executor (shared by the browser and the tests). */
export async function runValidated(
  exec: (sql: string) => Promise<{ columns: string[]; values: Cell[][] }[]>,
  sql: string,
  allowedTables: readonly string[],
  maxRows = MAX_ROWS
): Promise<QueryResult> {
  const v = validateSql(sql, allowedTables)
  if (!v.ok) throw new SqlError(v.error, "rejected")
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now()
  const results = await exec(limitRows(v.sql, maxRows))
  const t1 = typeof performance !== "undefined" ? performance.now() : Date.now()
  const r = results.at(-1) ?? { columns: [], values: [] }
  const truncated = r.values.length > maxRows
  return {
    columns: r.columns,
    rows: truncated ? r.values.slice(0, maxRows) : r.values,
    truncated,
    ms: Math.round(t1 - t0),
  }
}

export function createBrowserEngine(allowedTables: readonly string[]): SqlEngine {
  let worker: Worker | null = null
  let ready: Promise<void> | null = null
  let nextId = 1
  const pending = new Map<number, { resolve: (r: WorkerReply) => void }>()

  const send = (msg: Record<string, unknown>) =>
    new Promise<WorkerReply>((resolve) => {
      const id = nextId++
      pending.set(id, { resolve })
      worker!.postMessage({ ...msg, id })
    })

  const reset = () => {
    worker?.terminate()
    worker = null
    ready = null
    for (const p of pending.values()) p.resolve({ id: -1, error: "The query was stopped." })
    pending.clear()
  }

  const start = () => {
    if (ready) return ready
    worker = new Worker(WORKER_URL)
    worker.onmessage = (e: MessageEvent<WorkerReply>) => {
      const p = pending.get(e.data.id)
      if (p) {
        pending.delete(e.data.id)
        p.resolve(e.data)
      }
    }
    ready = (async () => {
      const res = await fetch(SCRIPT_URL)
      if (!res.ok) throw new SqlError("Could not load the tables.", "load")
      const script = await res.text()
      const open = await send({ action: "open" })
      if (open.error) throw new SqlError(open.error, "load")
      const load = await send({ action: "exec", sql: script })
      if (load.error) throw new SqlError(load.error, "load")
    })()
    ready.catch(() => reset())
    return ready
  }

  const exec = async (sql: string) => {
    await start()
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reset()
        reject(
          new SqlError(
            `The query took longer than ${QUERY_TIMEOUT_MS / 1000} seconds and was stopped.`,
            "timeout"
          )
        )
      }, QUERY_TIMEOUT_MS)
    })
    try {
      const reply = await Promise.race([send({ action: "exec", sql }), timeout])
      if (reply.error) throw new SqlError(reply.error, "sql")
      return reply.results ?? []
    } finally {
      clearTimeout(timer)
    }
  }

  return {
    query: (sql) => runValidated(exec, sql, allowedTables),
    tables: () => [...allowedTables],
  }
}
