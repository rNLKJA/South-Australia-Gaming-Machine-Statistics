import initSqlJs, { type Database } from "sql.js"
import { beforeAll, describe, expect, it } from "vitest"

import { GOLD_QUESTIONS, scoreAttempt, type ResultTable } from "@/lib/ai/sql-eval"
import { lgaUnits, licences, manufacturers, statewide, cpi } from "@/lib/data"
import { annualLicences } from "@/lib/licences"
import { rankUnits, unitsForFy } from "@/lib/lga"
import { annualManufacturers, monthlyShares } from "@/lib/manufacturers"
import { annualStatewide } from "@/lib/statewide"

import { runValidated, SqlError, type Cell } from "./browser"
import { limitRows, tokenize, validateSql } from "./guard"
import { buildLoadScript, inferType, quoteIdent, sqlLiteral } from "./load"
import { DOMAIN_NOTES, describeSchema, tableNameForFile } from "./schema"
import { sqlSchema, tidyTables } from "./tables"

const TABLES = tidyTables().map((t) => t.name)

describe("the allow-list guard", () => {
  const ok = (sql: string) => {
    const v = validateSql(sql, TABLES)
    expect(v.ok, v.ok ? "" : v.error).toBe(true)
    return v
  }
  const no = (sql: string, pattern?: RegExp) => {
    const v = validateSql(sql, TABLES)
    expect(v.ok, `should reject: ${sql}`).toBe(false)
    if (pattern && !v.ok) expect(v.error).toMatch(pattern)
  }

  it("accepts ordinary read-only queries and reports the tables used", () => {
    const v = ok("SELECT month, ngr_aud_million FROM statewide_monthly ORDER BY 2 DESC LIMIT 5;")
    expect(v.ok && v.tables).toEqual(["statewide_monthly"])
    ok(
      "select count(*) from lga_published_areas where kind = 'group' and financial_year = '2024-25'"
    )
    ok(
      "WITH y AS (SELECT financial_year, SUM(ngr_aud_million) AS ngr FROM statewide_monthly GROUP BY 1) SELECT * FROM y"
    )
    ok(
      "WITH y(fy, n) AS (SELECT financial_year, ngr_aud_million FROM statewide_annual) SELECT fy FROM y"
    )
    ok(
      "SELECT a.area, b.council FROM lga_published_areas AS a JOIN lga_crosswalk b ON b.council = a.area"
    )
    ok(
      "SELECT * FROM statewide_monthly s, statewide_annual a WHERE s.financial_year = a.financial_year"
    )
    ok("SELECT * FROM (SELECT month FROM statewide_monthly) t, licences_monthly l")
    ok(
      "SELECT CASE WHEN machines = 0 THEN 'closed' ELSE 'open' END AS state FROM statewide_monthly"
    )
    ok(
      "SELECT month, LAG(hhi) OVER (ORDER BY month) FROM manufacturer_concentration WHERE hhi IN (SELECT MAX(hhi) FROM manufacturer_concentration)"
    )
    ok("SELECT replace(area, ',', ';'), CAST(machines AS REAL) FROM lga_published_areas")
    ok('SELECT "month" FROM "statewide_monthly" -- a comment with DROP TABLE\n')
    ok("SELECT 'DELETE FROM x; PRAGMA y' AS text_is_fine FROM statewide_annual")
    ok(
      "SELECT * FROM lga_published_areas a LEFT JOIN lga_crosswalk c ON c.council = a.area, statewide_annual s"
    )
  })

  it("rejects writes, settings and anything outside the tidy tables", () => {
    no("DELETE FROM statewide_monthly", /SELECT/)
    no("SELECT 1; DROP TABLE statewide_monthly", /one statement/)
    no("PRAGMA query_only = OFF", /SELECT/)
    no("SELECT * FROM statewide_monthly; PRAGMA query_only = OFF")
    no("WITH x AS (SELECT 1) INSERT INTO statewide_monthly SELECT * FROM x", /INSERT/)
    no("SELECT * FROM sqlite_master", /internal/)
    no("SELECT * FROM sqlite_schema", /internal/)
    no('SELECT * FROM "sqlite_master"', /internal/)
    no("SELECT sqlite_version()", /internal/)
    no("SELECT * FROM main.statewide_monthly", /Schema-qualified/)
    no("SELECT * FROM secret_table", /Unknown table/)
    no("SELECT * FROM statewide_monthly, secret_table", /Unknown table/)
    no("SELECT * FROM statewide_monthly a JOIN secret b ON 1", /Unknown table/)
    no("SELECT * FROM pragma_table_info('statewide_monthly')", /internal|Table-valued/)
    no("SELECT * FROM json_each('[1,2]')", /Table-valued/)
    no("SELECT load_extension('x')", /allow-list/)
    no("SELECT printf('%.*c', 1000000000, 'x')", /allow-list/)
    no("SELECT zeroblob(1000000000)", /allow-list/)
    no('SELECT "printf"(1)', /quoted/)
    no("SELECT * FROM `statewide_monthly`", /backticks/)
    no("SELECT * FROM [statewide_monthly]", /backticks/)
    no("SELECT * FROM statewide_monthly WHERE month = ?", /parameters/)
    no("SELECT * FROM statewide_monthly WHERE month = :m", /parameters/)
    no("ATTACH DATABASE 'x' AS y")
    no("SELECT 1 /* unterminated", /comment/)
    no("SELECT 'unterminated", /not closed/)
    no("REPLACE INTO statewide_monthly VALUES (1)")
    no("SELECT * FROM statewide_monthly WHERE 1 = (SELECT 1", /Unbalanced/)
    no("SELECT * FROM", /table name/)
    no("", /empty/)
    no(`SELECT '${"x".repeat(5000)}'`, /limited/)
  })

  it("rejects recursive common table expressions, with or without RECURSIVE", () => {
    no(
      "WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n) SELECT count(*) FROM n",
      /RECURSIVE/
    )
    no("WITH n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n) SELECT count(*) FROM n", /Recursive/)
  })

  it("tokenizes strings, quoted names and comments without leaking keywords", () => {
    const t = tokenize('SELECT \'it\'\'s\', "a ""b""" -- DROP\n/* DELETE */ FROM x')
    expect(t.map((x) => x.kind)).toEqual(["word", "string", "punct", "quoted", "word", "word"])
    expect(t[1].value).toBe("it's")
    expect(t[3].value).toBe('a "b"')
  })

  it("caps rows by wrapping the query", () => {
    expect(limitRows("SELECT 1", 500)).toBe("SELECT * FROM (\nSELECT 1\n) LIMIT 501")
  })
})

describe("the browser database load script", () => {
  it("infers column types and quotes literals", () => {
    expect(inferType([1, 2, null])).toBe("INTEGER")
    expect(inferType([1.5, 2])).toBe("REAL")
    expect(inferType(["a", 1])).toBe("TEXT")
    expect(inferType([true, false])).toBe("INTEGER")
    expect(inferType([null, NaN])).toBe("TEXT")
    expect(sqlLiteral("O'Brien")).toBe("'O''Brien'")
    expect(sqlLiteral(NaN)).toBe("NULL")
    expect(sqlLiteral(true)).toBe("1")
    expect(quoteIdent("ngr_aud")).toBe('"ngr_aud"')
    expect(() => quoteIdent('x"; DROP')).toThrow()
    expect(tableNameForFile("lga-published-areas.csv")).toBe("lga_published_areas")
  })

  it("describes the schema for both prompt variants", () => {
    const schema = sqlSchema()
    expect(schema.map((t) => t.name)).toEqual(TABLES)
    expect(TABLES).toHaveLength(8)
    const described = describeSchema(schema, "described")
    expect(described).toContain("statewide_monthly: Statewide, monthly")
    expect(described).toContain("'Hotels'")
    expect(describeSchema(schema, "bare")).toMatch(/^statewide_monthly\(month, financial_year/)
    expect(DOMAIN_NOTES).toMatch(/never SUM/)
  })
})

describe("SQLite in WebAssembly with the tidy tables", () => {
  let db: Database
  const exec = async (sql: string) => db.exec(sql) as { columns: string[]; values: Cell[][] }[]
  const run = async (sql: string): Promise<ResultTable> => {
    const r = await runValidated(exec, sql, TABLES)
    return { columns: r.columns, rows: r.rows }
  }
  const one = async (sql: string) => (await run(sql)).rows[0][0]

  beforeAll(async () => {
    const SQL = await initSqlJs()
    db = new SQL.Database()
    db.exec(buildLoadScript(tidyTables()))
  })

  it("loads every row of every table", () => {
    for (const t of tidyTables()) {
      const n = db.exec(`SELECT COUNT(*) FROM ${t.name}`)[0].values[0][0]
      expect(n).toBe(t.rows.length)
    }
  })

  it("refuses writes at the engine level after loading (PRAGMA query_only)", () => {
    expect(() => db.exec("DELETE FROM statewide_monthly")).toThrow(/readonly/)
    expect(() => db.exec("CREATE TABLE x (a)")).toThrow(/readonly/)
  })

  it("caps results at the row limit and keeps the inner ORDER BY", async () => {
    const r = await runValidated(
      exec,
      "SELECT month FROM statewide_monthly ORDER BY ngr_aud_million DESC",
      TABLES,
      5
    )
    expect(r.rows).toHaveLength(5)
    expect(r.truncated).toBe(true)
    expect(r.rows[0][0]).toBe("2024-08")
    await expect(runValidated(exec, "DROP TABLE statewide_monthly", TABLES)).rejects.toBeInstanceOf(
      SqlError
    )
  })

  it("answers the reference questions with the site's own figures", async () => {
    const sw = new Map(annualStatewide(statewide).map((y) => [y.fy, y]))
    const swReal = new Map(
      annualStatewide(statewide, { cpi, baseFy: "2024-25" }).map((y) => [y.fy, y])
    )
    const latestUnits = unitsForFy(lgaUnits, "2024-25")
    const june = monthlyShares(manufacturers).find((m) => m.month === "2025-06")!
    const hotels = annualLicences(licences, "entitlements").find(
      (r) => r.fy === "2024-25" && r.category === "Hotels"
    )!
    const gold = new Map(GOLD_QUESTIONS.map((q) => [q.id, q.sql]))
    const q = (id: string) => one(gold.get(id)!)
    const close = (a: Cell, b: number, tol = 1e-6) =>
      expect(Math.abs((a as number) - b)).toBeLessThanOrEqual(tol * Math.max(1, Math.abs(b)))

    close(await q("q01"), sw.get("2024-25")!.ngr!)
    close(await q("q03"), statewide.find((r) => r.month === "2025-06")!.machines)
    close(await q("q04"), sw.get("2018-19")!.machinesMean!)
    close(await q("q05"), sw.get("2009-10")!.taxRate!)
    expect(await q("q06")).toBe(rankUnits(latestUnits, "ngr")[0].label)
    close(await q("q07"), latestUnits.filter((u) => u.kind === "group").length)
    const adelaide = latestUnits.find((u) => u.label === "Adelaide")!
    close(await q("q08"), adelaide.ngr / adelaide.machines!)
    close(await q("q09"), Object.keys(june.counts).length)
    close(await q("q10"), june.shares["Aristocrat"], 1e-5)
    close(await q("q11"), annualManufacturers(monthlyShares(manufacturers)).at(-1)!.hhi, 1e-4)
    close(await q("q13"), hotels.end!)
    close(
      await q("q14"),
      licences.filter((r) => r.month === "2025-06").reduce((s, r) => s + r.liveMachines, 0)
    )
    const changes = [...sw.values()].filter((y) => y.ngrChange != null)
    const maxChange = changes.reduce((a, b) =>
      b.ngr! - b.ngr! / (1 + b.ngrChange!) > a.ngr! - a.ngr! / (1 + a.ngrChange!) ? b : a
    )
    expect(await q("q15")).toBe(maxChange.fy)
    close(await q("q16"), swReal.get("2009-10")!.ngr!, 1e-5)
    close(await q("q18"), statewide.filter((r) => r.fy === "2019-20" && r.machines === 0).length)
    expect(await q("q19")).toBe(rankUnits(latestUnits, "ngrPerMachine")[0].label)
    const list = await run(gold.get("q20")!)
    expect(list.rows.map((r) => r[0])).toEqual([
      "2020-21",
      "2021-22",
      "2022-23",
      "2023-24",
      "2024-25",
    ])
  })

  it("runs every reference query through the guard", async () => {
    for (const g of GOLD_QUESTIONS.filter((x) => x.sql)) {
      const r = await run(g.sql)
      expect(r.rows.length, g.id).toBeGreaterThan(0)
    }
    expect(GOLD_QUESTIONS.filter((g) => g.category === "abstain")).toHaveLength(3)
    expect(new Set(GOLD_QUESTIONS.map((g) => g.id)).size).toBe(GOLD_QUESTIONS.length)
  })

  it("scores attempts the way the evaluation page does", async () => {
    const g = GOLD_QUESTIONS.find((x) => x.id === "q04")!
    const ref = await run(g.sql)
    const right = await scoreAttempt(
      g,
      {
        answer: {
          answerable: true,
          sql: "SELECT ROUND(AVG(machines), 2) AS avg_machines, 'FY 2018-19' AS fy FROM statewide_monthly WHERE financial_year = '2018-19'",
        },
      },
      run,
      ref
    )
    expect(right.outcome).toBe("pass")
    expect(right.strict).toBe(false)
    const summed = await scoreAttempt(
      g,
      {
        answer: {
          answerable: true,
          sql: "SELECT SUM(machines) FROM statewide_monthly WHERE financial_year = '2018-19'",
        },
      },
      run,
      ref
    )
    expect(summed.outcome).toBe("wrong_result")
    const blocked = await scoreAttempt(
      g,
      { answer: { answerable: true, sql: "SELECT * FROM sqlite_master" } },
      run,
      ref
    )
    expect(blocked.outcome).toBe("rejected_by_guard")
    const broken = await scoreAttempt(
      g,
      { answer: { answerable: true, sql: "SELECT no_such_column FROM statewide_monthly" } },
      run,
      ref
    )
    expect(broken.outcome).toBe("sql_error")
    expect(
      (await scoreAttempt(g, { answer: { answerable: false, sql: "" } }, run, ref)).outcome
    ).toBe("declined")
    const abstain = GOLD_QUESTIONS.find((x) => x.id === "a01")!
    expect(
      (await scoreAttempt(abstain, { answer: { answerable: false, sql: "" } }, run, null)).outcome
    ).toBe("pass")
    expect(
      (await scoreAttempt(abstain, { answer: { answerable: true, sql: "SELECT 1" } }, run, null))
        .outcome
    ).toBe("answered_unanswerable")
    expect(
      (await scoreAttempt(g, { answer: null, errorKind: "rate_limit" }, run, ref)).outcome
    ).toBe("provider_error")
    expect(
      (await scoreAttempt(g, { answer: null, errorKind: "invalid_output" }, run, ref)).outcome
    ).toBe("invalid_output")
  })
})
