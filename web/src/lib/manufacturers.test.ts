import { describe, expect, it } from "vitest"

import pivots from "@/data/info-pivots.json"
import { manufacturers } from "@/lib/data"

import {
  annualManufacturers,
  hhi,
  LINEAGE_LABEL,
  leadingMakers,
  manufacturersAsBuilt,
  missingManufacturerMonths,
  monthlyShares,
  pivotAverageMachines,
} from "./manufacturers"

const P = pivots.pivots as unknown as Record<string, Record<string, Record<string, number>>>

describe("pivotAverageMachines (parity with INFO 'Average of No. of GMs')", () => {
  it("matches every manufacturer and financial year", () => {
    const got = pivotAverageMachines(manufacturers)
    let compared = 0
    for (const [maker, byFy] of Object.entries(P["Average of No. of GMs"])) {
      for (const [fy, expected] of Object.entries(byFy)) {
        expect(got[maker]?.[fy]).toBeCloseTo(expected, 9)
        compared++
      }
    }
    expect(compared).toBeGreaterThan(100)
  })
})

describe("monthlyShares and HHI", () => {
  const months = monthlyShares(manufacturers)

  it("covers 189 months and leaves out Oct to Dec 2023", () => {
    expect(months).toHaveLength(189)
    expect(missingManufacturerMonths(manufacturers)).toEqual(["2023-10", "2023-11", "2023-12"])
  })

  it("normalises shares to one within each month", () => {
    for (const m of months) {
      const s = Object.values(m.shares).reduce((a, b) => a + b, 0)
      expect(s).toBeCloseTo(1, 12)
    }
  })

  it("computes HHI = Σ(100·share)² (July 2009 by hand)", () => {
    const counts = [7067, 3787, 1562, 284, 60, 51, 24, 12, 8]
    const total = counts.reduce((a, b) => a + b, 0)
    expect(total).toBe(12855)
    const expected = counts.reduce((a, c) => a + ((100 * c) / total) ** 2, 0)
    expect(months[0].month).toBe("2009-07")
    expect(months[0].hhi).toBeCloseTo(expected, 9)
    expect(months[0].hhi).toBeCloseTo(4043, 0)
  })

  it("bounds HHI between 10,000/n and 10,000", () => {
    expect(hhi([1])).toBe(10000)
    expect(hhi([0.25, 0.25, 0.25, 0.25])).toBeCloseTo(2500, 9)
    for (const m of months) {
      const n = Object.keys(m.shares).length
      expect(m.hhi).toBeGreaterThanOrEqual(10000 / n - 1e-9)
      expect(m.hhi).toBeLessThanOrEqual(10000)
    }
  })

  it("flags the three months where the printed figures do not add up", () => {
    const odd = months.filter(
      (m) => m.total !== m.printedTotal || Math.abs(m.printedShareSum - 1) > 0.002
    )
    expect(odd.map((m) => m.month)).toEqual(["2010-02", "2011-10", "2022-11"])
  })
})

describe("lineage merge", () => {
  it("combines Stargames and SGS when both are listed in the same month", () => {
    const plain = monthlyShares(manufacturers).find((m) => m.month === "2021-07")!
    const merged = monthlyShares(manufacturers, true).find((m) => m.month === "2021-07")!
    expect(plain.counts["Stargames"]).toBe(1113)
    expect(plain.counts["SGS"]).toBe(59)
    expect(merged.counts[LINEAGE_LABEL]).toBe(1172)
    expect(merged.hhi).toBeGreaterThan(plain.hhi)
  })

  it("orders leading makers by mean share", () => {
    const lead = leadingMakers(monthlyShares(manufacturers, true))
    expect(lead.slice(0, 2)).toEqual(["Aristocrat", "IGT"])
    expect(lead).toContain(LINEAGE_LABEL)
  })
})

describe("annual figures", () => {
  it("averages monthly HHI and shares per financial year", () => {
    const years = annualManufacturers(monthlyShares(manufacturers))
    expect(years).toHaveLength(16)
    const fy2324 = years.find((y) => y.fy === "2023-24")!
    expect(fy2324.months).toBe(9)
    const s = Object.values(fy2324.shares).reduce((a, b) => a + b, 0)
    expect(s).toBeCloseTo(1, 12)
  })

  it("Power BI's Sum of % of Total is about twelve times the share", () => {
    const built = manufacturersAsBuilt(manufacturers)
    const years = annualManufacturers(monthlyShares(manufacturers))
    const y = years.find((r) => r.fy === "2024-25")!
    expect(built["Aristocrat"]["2024-25"] / y.shares["Aristocrat"]).toBeCloseTo(12, 1)
  })
})
