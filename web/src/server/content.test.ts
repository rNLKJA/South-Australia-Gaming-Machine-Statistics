import { existsSync, readdirSync, readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { concentrationView, councilsView, trendsView } from "@/lib/analysis/view"
import { statewide } from "@/lib/data"
import { docHref, slugify } from "@/lib/doc-links"
import { fmtAud, fmtDecimal, fmtInterval, fmtMillions, signed } from "@/lib/format"
import { fyLabel, monthLabel } from "@/lib/fy"
import { sqlSchema } from "@/lib/sql/tables"
import { annualStatewide } from "@/lib/statewide"

import { listDecisions, parseDecision, readDoc } from "./content"

const web = process.cwd()
const docs = path.resolve(web, "..", "docs")

describe("docs rendered on /methods", () => {
  it.runIf(existsSync(docs))("web/content is an exact copy of docs/ (run pnpm docs:sync)", () => {
    for (const f of ["methods.md", "data-card.md", "model-card.md", "ai-use-statement.md"]) {
      expect(readFileSync(path.join(web, "content", f), "utf8"), f).toBe(
        readFileSync(path.join(docs, f), "utf8")
      )
    }
    const src = readdirSync(path.join(docs, "decisions")).sort()
    expect(readdirSync(path.join(web, "content", "decisions")).sort()).toEqual(src)
    for (const f of src) {
      expect(readFileSync(path.join(web, "content", "decisions", f), "utf8"), f).toBe(
        readFileSync(path.join(docs, "decisions", f), "utf8")
      )
    }
  })

  it("parses every decision record in Rin's format", () => {
    const all = listDecisions()
    expect(all.map((d) => d.id)).toEqual([
      "DR-001",
      "DR-002",
      "DR-003",
      "DR-004",
      "DR-005",
      "DR-006",
    ])
    // a past record is never edited: DR-006 supersedes part of DR-004 and the link is derived
    const dr4 = all.find((d) => d.id === "DR-004")!
    expect(dr4.supersededBy.map((s) => s.id)).toEqual(["DR-006"])
    expect(dr4.supersededBy[0].part).toMatch(/intervals/)
    expect(all.find((d) => d.id === "DR-006")!.supersedes?.id).toBe("DR-004")
    // src/proxy.ts sends every other slug to a 404
    const known = JSON.parse(readFileSync(path.join(web, "content", "decision-slugs.json"), "utf8"))
    expect(known).toEqual(all.map((d) => d.slug))
    for (const d of all) {
      expect(d.status).toBe("Accepted")
      expect(d.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(d.decision.length).toBeGreaterThan(40)
      const sections = [...d.body.matchAll(/^## (.+)$/gm)].map((m) => m[1])
      expect(sections).toEqual([
        "Context",
        "Decision",
        "Options considered",
        "Why",
        "What happened",
        "What I'd change",
      ])
    }
    expect(() => parseDecision("x", "no heading")).toThrow()
  })

  it("keeps the data card's row counts in step with the tables", () => {
    const card = readDoc("data-card")
    for (const t of sqlSchema()) {
      const m = new RegExp("\\| `" + t.name + "`\\s*\\|\\s*([\\d,]+)\\s*\\|").exec(card)
      expect(m, t.name).not.toBeNull()
      expect(Number(m![1].replace(/,/g, "")), t.name).toBe(t.rows)
    }
  })

  it("never claims compliance, and avoids em dashes in the docs", () => {
    const text = ["methods", "data-card", "model-card", "ai-use-statement"]
      .map((d) => readDoc(d as Parameters<typeof readDoc>[0]))
      .concat(listDecisions().map((d) => d.body))
      .join("\n")
    expect(text).not.toMatch(/\bcompliant\b/i)
    expect(text).not.toContain("—")
  })

  // builds every Analysis view, including the block-length sensitivity bootstraps: give it time
  it(
    "quotes the analysis results the pages compute (no stale numbers in the docs)",
    { timeout: 120_000 },
    () => {
      const t = trendsView()
      const its = t.its[0]
      const m = (x: number) => signed(x, (v) => fmtMillions(v, 1))
      const level = `${m(its.level.estimate)} a month (95% CI ${m(its.level.lower)} to ${m(its.level.upper)})`
      const dr5 = listDecisions().find((d) => d.id === "DR-005")!.body
      const card = readDoc("model-card")
      expect(card).toContain(`R² is ${its.r2.toFixed(2)}`)
      expect(dr5).toContain(level)
      expect(card).toContain(level)
      expect(fmtInterval(1, 0, 2, String)).toBe("1 (95% CI 0 to 2)")
      const slope = `${m(its.slopePerYear.estimate)} a year (${m(its.slopePerYear.lower)} to ${m(its.slopePerYear.upper)})`
      expect(dr5).toContain(slope)
      const c = councilsView()
      const scaling = `${fmtDecimal(c.scaling.slope.estimate)} (95% CI ${fmtDecimal(c.scaling.slope.lower)} to ${fmtDecimal(c.scaling.slope.upper)})`
      expect(dr5).toContain(scaling)
      expect(card).toContain(`c = ${c.scale.c.toFixed(2)}`)
      // the council-basis state rate and the Statewide page's rate, both quoted in the model card
      const fy = c.funnels.at(-1)!.fy
      const statewideRate = annualStatewide(statewide).find((y) => y.fy === fy)!.ngrPerMachine!
      expect(card).toContain(
        `${fmtAud(c.funnels.at(-1)!.stateRate)} against ${fmtAud(statewideRate)} in ${fyLabel(fy)}`
      )
      const latest = c.funnels.at(-1)!
      expect(dr5).toContain(`${latest.outside95.count} of ${latest.outside95.n} areas`)
      const k = concentrationView()
      const [y, mo] = k.breaks[0].tau.split("-")
      const breakText = `${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][Number(mo) - 1]} ${y}`
      expect(dr5).toContain(breakText)
      expect(card).toContain(breakText)
      expect(monthLabel(k.breaks[0].tau)).toBe("Dec 2015")
      const months = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ]
      const long = (m: string) => `${months[Number(m.split("-")[1]) - 1]} ${m.split("-")[0]}`
      const breakCi = `${breakText} (95% CI ${long(k.breaks[0].tauLower)} to ${long(k.breaks[0].tauUpper)})`
      expect(dr5).toContain(breakCi)
      expect(card).toContain(breakCi)
      expect(dr5).toContain(`(${k.variants[0].breakpoint.blockLength} months)`)
      // the council counts quoted in DR-005 and the model card
      const n = (d: string) => c.persistent.filter((p) => p.direction === d).length
      const counts = `${n("above")} above, ${n("below")} below and ${n("unclear")} unclear`
      expect(dr5).toContain(counts)
      expect(card).toContain(
        `${n("above")} are consistently above the state rate, ${n("below")} below and ${n("unclear")} unclear`
      )
      expect(dr5).toContain(`autocorrelation of the log ratios is ${c.dependence.rho.toFixed(2)}`)
      expect(dr5).toContain(`by ${c.dependence.inflation.toFixed(2)}`)
    }
  )

  it("maps links between docs to site routes", () => {
    expect(docHref("decisions/DR-002-stock-vs-flow-aggregation.md")).toBe(
      "/methods/decisions/DR-002-stock-vs-flow-aggregation"
    )
    expect(docHref("DR-001-combined-lga-groups.md#why")).toBe(
      "/methods/decisions/DR-001-combined-lga-groups#why"
    )
    expect(docHref("data-card.md")).toBe("/methods/data-card")
    expect(docHref("../model-card.md")).toBe("/methods/model-card")
    expect(docHref("ai-use-statement.md")).toBe("/methods#ai-use-statement")
    expect(docHref("https://example.com")).toBe("https://example.com")
    expect(slugify("What I’d change")).toBe("what-id-change")
  })
})
