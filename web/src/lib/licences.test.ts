import { describe, expect, it } from "vitest"

import pivots from "@/data/info-pivots.json"
import { licences } from "@/lib/data"

import {
  annualLicences,
  licencesAsBuilt,
  missingLicenceMonths,
  type LicenceMeasure,
} from "./licences"

const P = pivots.pivots as unknown as Record<string, Record<string, Record<string, number>>>

describe("annualLicences (parity with the workbook INFO 'Average of' pivots)", () => {
  it.each([
    ["Average of Gaming Machine Licences", "licences"],
    ["Average of Live Gaming Machine Licences", "liveLicences"],
    ["Average of Entitlements Held", "entitlements"],
    ["Average of Live Machines", "liveMachines"],
  ] as const)("%s matches for every category and year", (pivot, measure: LicenceMeasure) => {
    const annual = annualLicences(licences, measure)
    let compared = 0
    for (const [category, byFy] of Object.entries(P[pivot])) {
      if (category === "Grand Total") continue
      for (const [fy, expected] of Object.entries(byFy)) {
        const got = annual.find((a) => a.fy === fy && a.category === category)
        expect(got?.mean).toBeCloseTo(expected, 9)
        compared++
      }
    }
    expect(compared).toBeGreaterThan(50)
  })

  it("reports the last snapshot of each year", () => {
    const a = annualLicences(licences, "entitlements").find(
      (x) => x.fy === "2024-25" && x.category === "Hotels"
    )
    expect(a?.endMonth).toBe("2025-06")
    expect(a?.end).toBe(11480)
  })
})

describe("gaps", () => {
  it("finds the missing 2017-18 Q1 release (Jul to Sep 2017)", () => {
    expect(missingLicenceMonths(licences)).toEqual(["2017-07", "2017-08", "2017-09"])
  })
})

describe("licencesAsBuilt (Power BI Sum by FY)", () => {
  it("is about twelve times the mean for a full year", () => {
    const sum = licencesAsBuilt(licences, "entitlements").find(
      (r) => r.fy === "2024-25" && r.category === "Hotels"
    )!
    const mean = annualLicences(licences, "entitlements").find(
      (r) => r.fy === "2024-25" && r.category === "Hotels"
    )!
    expect(sum.months).toBe(12)
    expect(sum.sum / mean.mean!).toBeCloseTo(12, 9)
  })
})
