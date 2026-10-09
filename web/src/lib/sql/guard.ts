/**
 * The allow-list check every query passes before it runs, whether a model drafted it or a visitor
 * typed it. It works on tokens (string literals, quoted names and comments can't hide keywords):
 *
 * 1. one statement, starting with SELECT or WITH, at most MAX_SQL_LENGTH characters;
 * 2. no statement keyword that writes, changes the schema or touches settings (INSERT, PRAGMA,
 *    ATTACH, ...), and no RECURSIVE common table expressions;
 * 3. every table after FROM or JOIN (or a comma in a FROM list) is one of the tidy tables or a
 *    common table expression defined in the same query; no schema-qualified names, no sqlite_*;
 * 4. every function call is on an allow-list of aggregate, window, text, date and maths functions;
 * 5. no bound parameters.
 *
 * It is one of three layers: the browser database is also loaded with `PRAGMA query_only = ON`
 * and runs in a Web Worker that is terminated after a time limit (src/lib/sql/browser.ts).
 */

export const MAX_SQL_LENGTH = 4000

export type TokenKind = "word" | "quoted" | "string" | "number" | "punct" | "param"

export interface Token {
  kind: TokenKind
  /** Upper-cased for words; the raw text otherwise. */
  value: string
  raw: string
}

export type Validation = { ok: true; sql: string; tables: string[] } | { ok: false; error: string }

const DENIED_KEYWORDS = new Set([
  "ALTER",
  "ANALYZE",
  "ATTACH",
  "BEGIN",
  "COMMIT",
  "CONFLICT",
  "CREATE",
  "DELETE",
  "DETACH",
  "DROP",
  "INSERT",
  "INTO",
  "PRAGMA",
  "RECURSIVE",
  "REINDEX",
  "RELEASE",
  "ROLLBACK",
  "SAVEPOINT",
  "TRANSACTION",
  "TRIGGER",
  "UPDATE",
  "UPSERT",
  "VACUUM",
])

/** Keywords that may be followed by "(" without being a function call. */
const KEYWORDS_BEFORE_PAREN = new Set([
  "AND",
  "AS",
  "BETWEEN",
  "BY",
  "CASE",
  "CAST",
  "ELSE",
  "EXCEPT",
  "EXISTS",
  "FILTER",
  "FROM",
  "HAVING",
  "IN",
  "INTERSECT",
  "IS",
  "JOIN",
  "LIKE",
  "LIMIT",
  "NOT",
  "OFFSET",
  "ON",
  "OR",
  "OVER",
  "SELECT",
  "THEN",
  "UNION",
  "USING",
  "VALUES",
  "WHEN",
  "WHERE",
  "WITH",
  "ALL",
  "DISTINCT",
  "GLOB",
])

export const ALLOWED_FUNCTIONS = new Set([
  // aggregates
  "avg",
  "count",
  "group_concat",
  "max",
  "min",
  "sum",
  "total",
  // window functions
  "cume_dist",
  "dense_rank",
  "first_value",
  "lag",
  "last_value",
  "lead",
  "nth_value",
  "ntile",
  "percent_rank",
  "rank",
  "row_number",
  // scalar
  "abs",
  "coalesce",
  "ifnull",
  "iif",
  "instr",
  "length",
  "lower",
  "ltrim",
  "nullif",
  "replace",
  "round",
  "rtrim",
  "sign",
  "substr",
  "substring",
  "trim",
  "typeof",
  "upper",
  // dates
  "date",
  "julianday",
  "strftime",
  // maths (when the SQLite build has them)
  "ceil",
  "ceiling",
  "exp",
  "floor",
  "ln",
  "log",
  "log10",
  "mod",
  "pow",
  "power",
  "sqrt",
])

/** Words that end a FROM list (after which a comma is a select-list or argument comma again). */
const FROM_LIST_ENDS = new Set([
  "WHERE",
  "GROUP",
  "ORDER",
  "LIMIT",
  "HAVING",
  "WINDOW",
  "UNION",
  "EXCEPT",
  "INTERSECT",
  "SELECT",
])

const JOIN_WORDS = new Set(["JOIN"])

export class TokenizeError extends Error {}

export function tokenize(sql: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < sql.length) {
    const ch = sql[i]
    const next = sql[i + 1]
    if (/\s/.test(ch)) {
      i++
    } else if (ch === "-" && next === "-") {
      const end = sql.indexOf("\n", i)
      i = end === -1 ? sql.length : end + 1
    } else if (ch === "/" && next === "*") {
      const end = sql.indexOf("*/", i + 2)
      if (end === -1) throw new TokenizeError("A comment is not closed.")
      i = end + 2
    } else if (ch === "'") {
      let j = i + 1
      let text = ""
      for (;;) {
        if (j >= sql.length) throw new TokenizeError("A text value in quotes is not closed.")
        if (sql[j] === "'" && sql[j + 1] === "'") {
          text += "'"
          j += 2
        } else if (sql[j] === "'") break
        else text += sql[j++]
      }
      tokens.push({ kind: "string", value: text, raw: sql.slice(i, j + 1) })
      i = j + 1
    } else if (ch === '"') {
      let j = i + 1
      let text = ""
      for (;;) {
        if (j >= sql.length) throw new TokenizeError("A quoted name is not closed.")
        if (sql[j] === '"' && sql[j + 1] === '"') {
          text += '"'
          j += 2
        } else if (sql[j] === '"') break
        else text += sql[j++]
      }
      tokens.push({ kind: "quoted", value: text, raw: sql.slice(i, j + 1) })
      i = j + 1
    } else if (ch === "`" || ch === "[") {
      throw new TokenizeError("Use double quotes for names; backticks and brackets aren't allowed.")
    } else if (/[A-Za-z_]/.test(ch)) {
      let j = i + 1
      while (j < sql.length && /[A-Za-z0-9_$]/.test(sql[j])) j++
      const raw = sql.slice(i, j)
      tokens.push({ kind: "word", value: raw.toUpperCase(), raw })
      i = j
    } else if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(next ?? ""))) {
      let j = i + 1
      while (j < sql.length && /[0-9.eE]/.test(sql[j])) {
        if (/[eE]/.test(sql[j]) && /[+-]/.test(sql[j + 1] ?? "")) j++
        j++
      }
      tokens.push({ kind: "number", value: sql.slice(i, j), raw: sql.slice(i, j) })
      i = j
    } else if (ch === "?" || ch === ":" || ch === "@" || ch === "$") {
      tokens.push({ kind: "param", value: ch, raw: ch })
      i++
    } else {
      const two = sql.slice(i, i + 2)
      const op = ["<=", ">=", "<>", "!=", "==", "||", "<<", ">>", "->"].includes(two) ? two : ch
      tokens.push({ kind: "punct", value: op, raw: op })
      i += op.length
    }
  }
  return tokens
}

const isWord = (t: Token | undefined, w?: string) => t?.kind === "word" && (!w || t.value === w)
const isPunct = (t: Token | undefined, p: string) => t?.kind === "punct" && t.value === p

/** Common table expressions: `name [(columns)] AS ( body )`, with the token range of each body. */
export function commonTableExpressions(
  tokens: readonly Token[]
): { name: string; start: number; end: number }[] {
  const out: { name: string; start: number; end: number }[] = []
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (t.kind !== "word" && t.kind !== "quoted") continue
    let j = i + 1
    if (isPunct(tokens[j], "(")) {
      // column list: identifiers and commas only
      let k = j + 1
      while (k < tokens.length && !isPunct(tokens[k], ")")) {
        const tk = tokens[k]
        if (!(tk.kind === "word" || tk.kind === "quoted" || isPunct(tk, ","))) break
        k++
      }
      if (!isPunct(tokens[k], ")")) continue
      j = k + 1
    }
    if (isWord(tokens[j], "AS") && isPunct(tokens[j + 1], "(")) {
      let depth = 0
      let k = j + 1
      for (; k < tokens.length; k++) {
        if (isPunct(tokens[k], "(")) depth++
        else if (isPunct(tokens[k], ")") && --depth === 0) break
      }
      out.push({ name: (t.kind === "word" ? t.raw : t.value).toLowerCase(), start: j + 2, end: k })
    }
  }
  return out
}

export function cteNames(tokens: readonly Token[]): Set<string> {
  return new Set(commonTableExpressions(tokens).map((c) => c.name))
}

function nameOf(t: Token): string {
  return (t.kind === "word" ? t.raw : t.value).toLowerCase()
}

export function validateSql(input: string, allowedTables: Iterable<string>): Validation {
  if (typeof input !== "string") return { ok: false, error: "SQL must be text." }
  const allowed = new Set([...allowedTables].map((t) => t.toLowerCase()))
  const sql = input.trim().replace(/;\s*$/, "").trim()
  if (!sql) return { ok: false, error: "The query is empty." }
  if (sql.length > MAX_SQL_LENGTH) {
    return { ok: false, error: `Queries are limited to ${MAX_SQL_LENGTH} characters.` }
  }
  let tokens: Token[]
  try {
    tokens = tokenize(sql)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "The query could not be read." }
  }
  if (!tokens.length) return { ok: false, error: "The query is empty." }
  if (tokens.some((t) => isPunct(t, ";"))) {
    return { ok: false, error: "Only one statement is allowed." }
  }
  if (!(isWord(tokens[0], "SELECT") || isWord(tokens[0], "WITH"))) {
    return { ok: false, error: "Only SELECT queries (optionally starting with WITH) are allowed." }
  }
  const param = tokens.find((t) => t.kind === "param")
  if (param) return { ok: false, error: `Bound parameters (${param.raw}) aren't supported.` }
  for (const t of tokens) {
    if (t.kind === "word" && DENIED_KEYWORDS.has(t.value)) {
      return { ok: false, error: `${t.value} is not allowed: the database is read-only.` }
    }
    if ((t.kind === "word" || t.kind === "quoted") && nameOf(t).startsWith("sqlite_")) {
      return { ok: false, error: "SQLite's internal tables and functions aren't available." }
    }
  }

  const ctes = cteNames(tokens)
  // a CTE that names itself in its own body is recursive in SQLite even without RECURSIVE
  for (const c of commonTableExpressions(tokens)) {
    for (let k = c.start; k < c.end; k++) {
      const tk = tokens[k]
      if ((tk.kind === "word" || tk.kind === "quoted") && nameOf(tk) === c.name) {
        return {
          ok: false,
          error: `Recursive queries aren't allowed (${c.name} refers to itself).`,
        }
      }
    }
  }
  const used = new Set<string>()
  // FROM-list state per parenthesis depth
  const fromDepths = new Set<number>()
  let depth = 0
  let expectTable = false

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    const next = tokens[i + 1]

    if (expectTable) {
      expectTable = false
      if (isPunct(t, "(")) {
        depth++
        continue
      }
      if (t.kind !== "word" && t.kind !== "quoted") {
        return { ok: false, error: "Expected a table name after FROM or JOIN." }
      }
      if (isPunct(next, ".")) {
        return { ok: false, error: "Schema-qualified table names aren't allowed." }
      }
      if (isPunct(next, "(")) {
        return { ok: false, error: `Table-valued functions such as ${t.raw}() aren't allowed.` }
      }
      const name = nameOf(t)
      if (!allowed.has(name) && !ctes.has(name)) {
        return {
          ok: false,
          error: `Unknown table "${t.kind === "word" ? t.raw : t.value}". Use one of: ${[...allowed].sort().join(", ")}.`,
        }
      }
      if (allowed.has(name)) used.add(name)
      continue
    }

    if (isPunct(t, "(")) {
      depth++
      continue
    }
    if (isPunct(t, ")")) {
      fromDepths.delete(depth)
      depth--
      if (depth < 0) return { ok: false, error: "Unbalanced brackets." }
      continue
    }
    if (t.kind === "word") {
      if (t.value === "FROM") {
        fromDepths.add(depth)
        expectTable = true
        continue
      }
      if (JOIN_WORDS.has(t.value)) {
        expectTable = true
        continue
      }
      if (FROM_LIST_ENDS.has(t.value)) fromDepths.delete(depth)
      if (t.value === "REPLACE" && !isPunct(next, "(")) {
        return { ok: false, error: "REPLACE is only allowed as the replace() function." }
      }
      if (isPunct(next, "(") && !KEYWORDS_BEFORE_PAREN.has(t.value)) {
        const fn = t.raw.toLowerCase()
        if (!ALLOWED_FUNCTIONS.has(fn) && !ctes.has(fn)) {
          return { ok: false, error: `The function ${t.raw}() is not on the allow-list.` }
        }
      }
      continue
    }
    if (t.kind === "quoted" && isPunct(next, "(") && !ctes.has(nameOf(t))) {
      return { ok: false, error: "Function names can't be quoted." }
    }
    if (isPunct(t, ",") && fromDepths.has(depth)) {
      expectTable = true
    }
  }
  if (expectTable) return { ok: false, error: "Expected a table name after FROM or JOIN." }
  if (depth !== 0) return { ok: false, error: "Unbalanced brackets." }
  return { ok: true, sql, tables: [...used].sort() }
}

/** Wrap a validated query so at most `maxRows + 1` rows come back (the +1 shows truncation). */
export function limitRows(sql: string, maxRows: number): string {
  return `SELECT * FROM (\n${sql}\n) LIMIT ${Math.floor(maxRows) + 1}`
}
