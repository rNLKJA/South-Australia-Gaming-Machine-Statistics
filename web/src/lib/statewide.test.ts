import { describe, expect, it } from "vitest"

import pivots from "@/data/info-pivots.json"
import { cpi, statewide } from "@/lib/data"

import { annualStatewide, COVID_FY, monthlySeries, statewideAsBuilt } from "./statewide"

type FyTable = Record<string, number>
const P = pivots.pivots as unknown as Record<string, { all: FyTable }>

describe("annualStatewide (parity with the workbook INFO pivots)", () => {
  const years = annualStatewide(statewide)
  const byFy = new Map(years.map((y) => [y.fy, y]))

  it.each([
    ["Statewide: Sum of Net Gambling Revenue (mil)", "ngr"],
    ["Statewide: Sum of Gaming Tax Liability (mil)", "tax"],
    ["Statewide: Sum of Venue Share (mil)", "venueShare"],
  ] as const)("%s matches every financial year", (pivot, field) => {
    const expected = P[pivot].all
    expect(Object.keys(expected)).toHaveLength(15)
    for (const [fy, v] of Object.entries(expected)) {
      expect(byFy.get(fy)?.[field]).toBeCloseTo(v, 6)
    }
  })

  it("reproduces the CBS grand totals printed in the releases", () => {
    // Grand totals from the CBS statewide PDFs in original/SA Gaming Data/.
    expect(byFy.get("2013-14")?.ngr).toBe(731.01)
    expect(byFy.get("2019-20")?.ngr).toBe(511.48)
    expect(byFy.get("2024-25")?.ngr).toBe(1008.46)
  })

  it("keeps FY 2014/15 as an explicit gap", () => {
    const gap = byFy.get("2014-15")!
    expect(gap.months).toBe(0)
    expect(gap.ngr).toBeNull()
    expect(byFy.get("2015-16")?.ngrChange).toBeNull()
    expect(years.filter((y) => y.months === 12)).toHaveLength(15)
  })

  it("averages stocks instead of summing them", () => {
    const y = byFy.get("2009-10")!
    expect(y.machinesMean).toBeCloseTo(152729 / 12, 9)
    expect(y.venuesMean).toBeCloseTo(6760 / 12, 9)
    expect(y.machinesJune).toBe(12744) // June 2010
  })

  it("counts the COVID-19 months reported with zero machines", () => {
    expect(byFy.get("2019-20")?.zeroMachineMonths).toBe(4)
  })

  it("computes NGR per machine from annual NGR and mean machines", () => {
    const y = byFy.get("2024-25")!
    expect(y.ngrPerMachine).toBeCloseTo((1008.46 * 1e6) / y.machinesMean!, 6)
  })

  it("leaves NGR per machine blank for FY 2019/20, when machines were reported as zero", () => {
    // March and June 2020 carry $41.2m of NGR against zero machines, so annual NGR over the
    // machine mean would read $63,532 (+13% on FY 2018/19) during the closures.
    const y = byFy.get(COVID_FY)!
    expect(y.zeroMachineMonths).toBe(4)
    expect((y.ngr! * 1e6) / y.machinesMean!).toBeCloseTo(63532, -1)
    expect(y.ngrPerMachine).toBeNull()
    expect(years.filter((x) => x.months && x.ngrPerMachine == null).map((x) => x.fy)).toEqual([
      COVID_FY,
    ])
  })
})

describe("statewideAsBuilt (what the Power BI page shows)", () => {
  it("equals the INFO 'Sum of Machines' and 'Sum of Venues' pivots exactly", () => {
    const built = new Map(statewideAsBuilt(statewide).map((r) => [r.fy, r]))
    for (const [fy, v] of Object.entries(P["Statewide: Sum of Machines"].all)) {
      expect(built.get(fy)?.machines).toBe(v)
    }
    for (const [fy, v] of Object.entries(P["Statewide: Sum of Venues"].all)) {
      expect(built.get(fy)?.venues).toBe(v)
    }
  })
})

describe("real terms", () => {
  it("restates dollars in FY 2024/25 dollars using the Adelaide CPI", () => {
    const nominal = new Map(annualStatewide(statewide).map((y) => [y.fy, y.ngr]))
    const real = new Map(
      annualStatewide(statewide, { cpi, baseFy: "2024-25" }).map((y) => [y.fy, y.ngr])
    )
    // The base year is unchanged to within the spread of its own quarters.
    expect(real.get("2024-25")! / nominal.get("2024-25")!).toBeCloseTo(1, 2)
    // Earlier dollars are worth more in today's money.
    expect(real.get("2009-10")!).toBeGreaterThan(nominal.get("2009-10")! * 1.4)
  })

  it("leaves counts alone", () => {
    const a = monthlySeries(statewide, "machines")
    const b = monthlySeries(statewide, "machines", { cpi, baseFy: "2024-25" })
    expect(b).toEqual(a)
  })
})
