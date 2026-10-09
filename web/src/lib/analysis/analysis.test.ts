import { describe, expect, it } from "vitest"

import { cpi, lgaUnits, manufacturers, statewide } from "@/lib/data"
import { annualManufacturers, monthlyShares } from "@/lib/manufacturers"
import { annualStatewide } from "@/lib/statewide"

import {
  allMonths,
  concentrationVariant,
  hhiByYear,
  monthFromIndex,
  monthIndex,
} from "./concentration"
import {
  areaYears,
  FUNNEL_FYS,
  funnelYears,
  persistentRatios,
  serialDependence,
  scalingCheck,
  yearToYearScale,
} from "./councils"
import {
  CLOSURE_MONTHS,
  contiguousSegments,
  interruptedTimeSeries,
  ITS_SPECS,
  nextMonth,
  pairedComparisons,
  perMachineByYear,
  realMonths,
  stlSegments,
} from "./trends"

const months = realMonths(statewide, cpi)

describe("trend analysis", () => {
  it("deflates every month and keeps nominal values", () => {
    expect(months).toHaveLength(statewide.length)
    const last = months.at(-1)!
    expect(last.month).toBe("2025-06")
    // June 2025 is in FY 2024/25, the base year, so real and nominal are close
    expect(Math.abs(last.ngrReal / last.ngrNominal - 1)).toBeLessThan(0.02)
    expect(months.find((m) => m.month === "2020-04")!.perMachineReal).toBeNull()
    expect(nextMonth("2014-12")).toBe("2015-01")
  })

  it("splits the series at the missing FY 2014/15 and decomposes each run", () => {
    const segs = contiguousSegments(months)
    expect(segs.map((s) => s.length)).toEqual([60, 120])
    const stl = stlSegments(months)
    for (const s of stl) {
      for (const p of s.points) {
        expect(p.trend + p.seasonal + p.remainder).toBeCloseTo(p.observed, 9)
      }
      expect(s.seasonalProfile).toHaveLength(12)
    }
    // the robust fit sets the closure months aside on its own
    for (const m of CLOSURE_MONTHS) expect(stl[1].lowWeight).toContain(m)
    expect(stl[1].strength.n).toBe(116)
  })

  it("fits the interrupted time series on 116 months with Newey–West lag 4", () => {
    for (const spec of ITS_SPECS) {
      const r = interruptedTimeSeries(months, spec)
      expect(r.n).toBe(116 - spec.exclude.length)
      expect(r.nPre).toBe(56)
      expect(r.lag).toBe(4)
      expect(r.level.lower).toBeLessThan(r.level.estimate)
      expect(r.level.upper).toBeGreaterThan(r.level.estimate)
      // in the post period, fitted − counterfactual = level + slope change × months since July 2020
      const post = r.series.filter((s) => s.month >= "2020-07" && s.fitted != null)
      const slopePerMonth = r.slopePerYear.estimate / 12
      post.forEach((s) => {
        const since =
          months.findIndex((m) => m.month === s.month) -
          months.findIndex((m) => m.month === "2020-07")
        expect(s.fitted! - s.counterfactual!).toBeCloseTo(
          r.level.estimate + slopePerMonth * since,
          6
        )
      })
      expect(r.gapAtEnd.estimate).toBeCloseTo(r.level.estimate + slopePerMonth * 59, 6)
    }
    const primary = interruptedTimeSeries(months, ITS_SPECS[0])
    expect(primary.series.filter((s) => s.excluded).map((s) => s.month)).toEqual(CLOSURE_MONTHS)
    expect(primary.unit).toBe("$m")
  })

  it("pairs the twelve calendar months of two years", () => {
    const pairs = pairedComparisons(months)
    for (const p of pairs) {
      expect(p.summary.n).toBe(12)
      expect(p.summary.t.estimate).toBeCloseTo(p.afterMean - p.beforeMean, 9)
    }
    expect(pairedComparisons(months)).toEqual(pairs)
  })

  it("keeps the Statewide page's NGR per machine as the point estimate", () => {
    const annual = new Map(annualStatewide(statewide).map((y) => [y.fy, y]))
    const pm = perMachineByYear(statewide, cpi, { B: 200 })
    expect(pm).toHaveLength(16)
    for (const y of pm) {
      const a = annual.get(y.fy)!
      if (y.nominal == null) {
        expect(a.ngrPerMachine).toBeNull()
        continue
      }
      expect(y.nominal.estimate).toBeCloseTo(a.ngrPerMachine!, 6)
      expect(y.nominal.lower).toBeLessThanOrEqual(y.nominal.estimate)
      expect(y.nominal.upper).toBeGreaterThanOrEqual(y.nominal.estimate)
      expect(y.months).toBe(12)
    }
    expect(pm.find((y) => y.fy === "2019-20")!.note).toMatch(/zero machines/)
    expect(pm.find((y) => y.fy === "2014-15")!.note).toMatch(/No statewide release/)
  })
})

describe("council analysis", () => {
  const rows = areaYears(lgaUnits)

  it("leaves out FY 2019/20 and compares each area with its year's state rate", () => {
    expect(FUNNEL_FYS).not.toContain("2019-20")
    expect(rows.some((r) => r.fy === "2019-20")).toBe(false)
    for (const fy of FUNNEL_FYS) {
      const ys = rows.filter((r) => r.fy === fy)
      const state = ys.reduce((s, r) => s + r.ngr, 0) / ys.reduce((s, r) => s + r.machines, 0)
      for (const r of ys) expect(r.stateRate).toBeCloseTo(state, 6)
    }
  })

  it("estimates the year-to-year scale and checks the 1/√machines assumption", () => {
    const s = yearToYearScale(rows)
    expect(s.c).toBeGreaterThan(0)
    expect(s.groups).toBeGreaterThan(40)
    const check = scalingCheck(rows)
    expect(check.n).toBeGreaterThan(30)
    expect(check.slope.lower).toBeLessThan(check.slope.upper)
  })

  it("draws funnels whose zone counts add up", () => {
    const fy = funnelYears(rows)
    expect(fy.map((f) => f.fy)).toEqual(FUNNEL_FYS)
    for (const f of fy) {
      for (const kind of ["noise", "overdispersed"] as const) {
        expect(f.zones[kind].reduce((s, z) => s + z.count, 0)).toBe(f.points.length)
      }
      expect(f.outside95.n).toBe(f.points.length)
      // a census count is compared with the 5% the limits allow for, not given a binomial CI
      expect(f.outside95.expected).toBeCloseTo(0.05 * f.points.length, 12)
      expect(f.outside95.tailP).toBeGreaterThanOrEqual(0)
      expect(f.outside95.tailP).toBeLessThanOrEqual(1)
      // allowing for between-area spread can only widen the limits
      expect(f.outside95Overdispersed.count).toBeLessThanOrEqual(f.outside95.count)
      f.curves.forEach((c) => {
        expect(c.noise.lower95).toBeLessThan(f.stateRate)
        expect(c.overdispersed.upper95).toBeGreaterThanOrEqual(c.noise.upper95)
      })
    }
  })

  it("measures year-to-year dependence within areas", () => {
    const d = serialDependence(rows)
    expect(d.rho).toBeGreaterThan(0)
    expect(d.rho).toBeLessThan(1)
    expect(d.areas).toBe(scalingCheck(rows).n)
    expect(d.inflation).toBeCloseTo(Math.sqrt((1 + d.rho) / (1 - d.rho)), 12)
    // no pair spans FY 2019/20, which has no machine counts
    expect(d.pairs).toBeLessThan(rows.length)
  })

  it("summarises each area's typical ratio to the state rate", () => {
    const { inflation } = serialDependence(rows)
    const pr = persistentRatios(rows, 3, inflation)
    expect(pr.length).toBeGreaterThan(40)
    for (const p of pr) {
      expect(p.years).toBeGreaterThanOrEqual(3)
      expect(p.ratio.lower).toBeLessThanOrEqual(p.ratio.estimate)
      expect(p.direction).toBe(
        p.ratio.lower > 1 ? "above" : p.ratio.upper < 1 ? "below" : "unclear"
      )
      // allowing for dependence only widens the interval
      expect(p.ratio.lower).toBeLessThanOrEqual(p.ratioIndependent.lower)
      expect(p.ratio.upper).toBeGreaterThanOrEqual(p.ratioIndependent.upper)
      expect(p.ratio.estimate).toBe(p.ratioIndependent.estimate)
    }
    const independent = persistentRatios(rows)
    expect(independent.map((p) => p.ratio)).toEqual(independent.map((p) => p.ratioIndependent))
    // sorted largest first
    for (let i = 1; i < pr.length; i++) {
      expect(pr[i].ratio.estimate).toBeLessThanOrEqual(pr[i - 1].ratio.estimate)
    }
  })
})

describe("concentration analysis", () => {
  it("keeps the Manufacturers page's annual HHI as the point estimate", () => {
    const shares = monthlyShares(manufacturers)
    const annual = new Map(annualManufacturers(shares).map((y) => [y.fy, y]))
    for (const y of hhiByYear(shares, { B: 100 })) {
      expect(y.hhi.estimate).toBeCloseTo(annual.get(y.fy)!.hhi, 9)
      expect(y.months).toBe(annual.get(y.fy)!.months)
    }
  })

  it("finds a reproducible break in the monthly HHI", () => {
    const a = concentrationVariant(manufacturers, false, { B: 40 })
    const b = concentrationVariant(manufacturers, false, { B: 40 })
    expect(a.breakpoint.tau).toEqual(b.breakpoint.tau)
    expect(a.breakpoint.fit.rss).toBeLessThan(a.breakpoint.fit.rssLinear)
    expect(a.fitted).toHaveLength(a.monthly.length)
    expect(concentrationVariant(manufacturers, true, { B: 10 }).id).toBe("lineage")
  })

  it("converts month indexes both ways", () => {
    expect(monthIndex("2009-07")).toBe(0)
    expect(monthIndex("2015-12")).toBe(77)
    expect(monthFromIndex(77)).toBe("2015-12")
    expect(allMonths("2009-10", "2010-11")).toHaveLength(24)
  })
})
