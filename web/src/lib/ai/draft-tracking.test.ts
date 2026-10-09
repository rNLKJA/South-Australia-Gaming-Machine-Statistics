import "fake-indexeddb/auto"

import { IDBFactory } from "fake-indexeddb"
import { describe, expect, it } from "vitest"

import { indexedDbAuditStore } from "./audit-log"
import {
  decisionForRun,
  discardDraft,
  isRepeat,
  sourceAfterDraft,
  sqlOrigin,
  type LoggedDecision,
  type SqlSource,
} from "./draft-tracking"

const STARTER = "SELECT financial_year FROM statewide_annual"
const AI_SQL = "SELECT area FROM lga_published_areas LIMIT 5"

/** The Ask page's run step, as the component does it: label, then append a decision if new. */
async function simulateRun(
  store: ReturnType<typeof indexedDbAuditStore>,
  source: SqlSource | null,
  sql: string,
  last: Map<string, LoggedDecision>
) {
  const origin = sqlOrigin(source, sql)
  if (source) {
    const next = decisionForRun(origin, sql, last.get(source.auditId))
    if (next) {
      last.set(source.auditId, next)
      await store.setDecision(
        source.auditId,
        next.decision,
        next.decision === "edited" ? { sql: next.sql } : undefined
      )
    }
  }
  return origin
}

async function newEntry(store: ReturnType<typeof indexedDbAuditStore>) {
  return store.add({
    feature: "ask-the-data",
    provider: "anthropic",
    model: "claude-haiku-4-5",
    requestedModel: "claude-haiku-4-5",
    input: { question: "q" },
    output: { answerable: true, sql: AI_SQL },
    error: null,
    latency_ms: 10,
    usage: null,
    human_decision: "pending",
  })
}

describe("Ask the data: where the editor's SQL came from", () => {
  it("labels drafted and edited SQL, and only hand-written SQL as manual", () => {
    expect(sqlOrigin(null, STARTER)).toBe("manual")
    const src = sourceAfterDraft(null, STARTER, {
      auditId: "a",
      model: "m",
      answerable: true,
      sql: ` ${AI_SQL}\n`,
    })!
    expect(src).toEqual({ auditId: "a", model: "m", sql: AI_SQL, before: STARTER })
    expect(sqlOrigin(src, `${AI_SQL}  `)).toBe("ai")
    expect(sqlOrigin(src, "SELECT 1")).toBe("edited")
  })

  it("logs every distinct edited query that runs, so the log matches the result on screen", async () => {
    const store = indexedDbAuditStore(new IDBFactory())
    const entry = await newEntry(store)
    const src = sourceAfterDraft(null, STARTER, {
      auditId: entry.id,
      model: "m",
      answerable: true,
      sql: AI_SQL,
    })
    const last = new Map<string, LoggedDecision>()
    const v3 = AI_SQL.replace("LIMIT 5", "LIMIT 3")
    const v2 = AI_SQL.replace("LIMIT 5", "LIMIT 2")
    expect(await simulateRun(store, src, v3, last)).toBe("edited")
    expect(await simulateRun(store, src, v3, last)).toBe("edited") // same run again: not re-logged
    expect(await simulateRun(store, src, v2, last)).toBe("edited")
    expect(await simulateRun(store, src, AI_SQL, last)).toBe("ai")
    expect(await simulateRun(store, src, AI_SQL, last)).toBe("ai")
    const [logged] = await store.list()
    expect(logged.decisions.map((d) => [d.decision, d.edited_output])).toEqual([
      ["edited", { sql: v3 }],
      ["edited", { sql: v2 }],
      ["accepted", null],
    ])
    expect(logged.human_decision).toBe("accepted")
  })

  it("puts back the pre-draft SQL on discard, so a rejected query can't run unlabelled", async () => {
    const store = indexedDbAuditStore(new IDBFactory())
    const entry = await newEntry(store)
    const src = sourceAfterDraft(null, STARTER, {
      auditId: entry.id,
      model: "m",
      answerable: true,
      sql: AI_SQL,
    })
    await store.setDecision(entry.id, "rejected")
    const after = discardDraft(src, entry.id, AI_SQL)
    expect(after).toEqual({ source: null, sql: STARTER })
    expect(sqlOrigin(after.source, after.sql)).toBe("manual")
    const last = new Map<string, LoggedDecision>()
    expect(await simulateRun(store, after.source, after.sql, last)).toBe("manual")
    const [logged] = await store.list()
    expect(logged.decisions.map((d) => d.decision)).toEqual(["rejected"])
  })

  it("keeps an earlier draft's label when a later question is declined", () => {
    const first = sourceAfterDraft(null, STARTER, {
      auditId: "a",
      model: "m",
      answerable: true,
      sql: AI_SQL,
    })
    const afterDecline = sourceAfterDraft(first, AI_SQL, {
      auditId: "b",
      model: "m",
      answerable: false,
      sql: "",
    })
    expect(afterDecline).toBe(first)
    expect(sqlOrigin(afterDecline, AI_SQL)).toBe("ai")
    // discarding the declined draft leaves the editor (and the earlier source) alone
    expect(discardDraft(afterDecline, "b", AI_SQL)).toEqual({ source: first, sql: AI_SQL })
    // a second answerable draft keeps the SQL from before any draft for a later discard
    const second = sourceAfterDraft(first, AI_SQL, {
      auditId: "c",
      model: "m",
      answerable: true,
      sql: "SELECT 2",
    })!
    expect(second.before).toBe(STARTER)
    expect(discardDraft(second, "c", "SELECT 2")).toEqual({ source: null, sql: STARTER })
  })

  it("skips only exact repeats of the last decision", () => {
    const accepted: LoggedDecision = { decision: "accepted", sql: null }
    expect(isRepeat(accepted, undefined)).toBe(false)
    expect(isRepeat(accepted, accepted)).toBe(true)
    expect(isRepeat({ decision: "edited", sql: "x" }, { decision: "edited", sql: "y" })).toBe(false)
    expect(decisionForRun("manual", "SELECT 1", undefined)).toBeNull()
  })
})
