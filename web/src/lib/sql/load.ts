import type { SchemaColumn, SqlType } from "./schema"

/**
 * Builds the SQL script that creates and fills the browser database. The rows are the site's own
 * tidy tables (trusted data), quoted here with SQLite's literal rules. The script ends with
 * `PRAGMA query_only = ON`, so the engine itself refuses writes after loading, whatever SQL a
 * visitor or a model sends later.
 */

export type LoadCell = string | number | boolean | null | undefined

export interface LoadTable {
  name: string
  columns: SchemaColumn[]
  rows: LoadCell[][]
}

/** Column type from its values: INTEGER for whole numbers and booleans, REAL, otherwise TEXT. */
export function inferType(values: readonly LoadCell[]): SqlType {
  const present = values.filter(
    (v) => v !== null && v !== undefined && !(typeof v === "number" && !Number.isFinite(v))
  )
  if (!present.length) return "TEXT"
  if (present.every((v) => typeof v === "boolean")) return "INTEGER"
  if (present.every((v) => typeof v === "number")) {
    return present.every((v) => Number.isInteger(v)) ? "INTEGER" : "REAL"
  }
  return "TEXT"
}

export function quoteIdent(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) throw new Error(`unexpected identifier ${name}`)
  return `"${name}"`
}

/** A SQLite literal for one cell (NaN and Infinity become NULL, as in the CSV downloads). */
export function sqlLiteral(v: LoadCell): string {
  if (v === null || v === undefined) return "NULL"
  if (typeof v === "boolean") return v ? "1" : "0"
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL"
  return `'${v.replace(/'/g, "''")}'`
}

export function buildLoadScript(tables: readonly LoadTable[], chunk = 250): string {
  const out: string[] = ["BEGIN;"]
  for (const t of tables) {
    const cols = t.columns.map((c) => `${quoteIdent(c.name)} ${c.type}`).join(", ")
    out.push(`CREATE TABLE ${quoteIdent(t.name)} (${cols});`)
    for (let i = 0; i < t.rows.length; i += chunk) {
      const values = t.rows
        .slice(i, i + chunk)
        .map((r) => `(${r.map(sqlLiteral).join(",")})`)
        .join(",\n")
      out.push(`INSERT INTO ${quoteIdent(t.name)} VALUES\n${values};`)
    }
  }
  out.push("COMMIT;", "PRAGMA query_only = ON;")
  return out.join("\n")
}
