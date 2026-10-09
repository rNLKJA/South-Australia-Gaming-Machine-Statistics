import { describe, expect, it } from "vitest"

import { verification } from "@/lib/data"

/**
 * The Data quality page states these results in prose ("4,406 of 4,409 values", the listed
 * exceptions, the one image-only PDF). Pin them so regenerating verification.json with a new
 * miss fails CI instead of silently contradicting the page.
 */
describe("verification.json (scripts/verify_pdfs.py)", () => {
  const families = [
    verification.statewide,
    verification.lga,
    verification.licences,
    verification.manufacturers,
  ]

  it("finds 4,406 of the 4,409 checked values in their PDFs", () => {
    expect(families.map((f) => ({ family: f.family, checked: f.checked, found: f.found }))).toEqual(
      [
        { family: "Gaming Statistics Statewide", checked: 900, found: 900 },
        { family: "Gaming Machine Revenue by ABS LGA", checked: 1013, found: 1011 },
        { family: "Gaming Machine Licence Statistics", checked: 1475, found: 1474 },
        { family: "Gaming Manufacturer’s Market Reports", checked: 1021, found: 1021 },
      ]
    )
    expect(families.reduce((s, f) => s + f.found, 0)).toBe(4406)
    expect(families.reduce((s, f) => s + f.checked, 0)).toBe(4409)
  })

  it("lists exactly the exceptions the Data quality page explains", () => {
    expect(families.flatMap((f) => f.misses)).toEqual([
      { period: "2013-14", field: "Adelaide Plains, Light · machines", value: 110 },
      {
        period: "2015-16",
        field: "Prospect, Walkerville",
        value: 14393352.18,
        printed: 14393272.17,
      },
      { period: "2025-04", field: "Hotels · entitlements", value: 11484 },
    ])
    expect(verification.licences.imageOnly).toEqual(["2022-23 Q3.pdf"])
    for (const f of [verification.statewide, verification.lga, verification.manufacturers]) {
      expect(f.imageOnly ?? []).toEqual([])
    }
  })

  it("matches every printed LGA total to cents, except FY 2015/16's $80.11", () => {
    const totals = verification.lga.totals ?? []
    expect(totals).toHaveLength(12)
    const gaps = Object.fromEntries(
      totals.map((t) => [t.fy, Math.round((t.workbookTotal - t.printedTotal) * 100) / 100])
    )
    // The page explains the one material gap: Prospect and Walkerville are $80.01 too high.
    expect(gaps["2015-16"]).toBe(80.11)
    for (const [fy, gap] of Object.entries(gaps)) {
      if (fy !== "2015-16") expect(Math.abs(gap)).toBeLessThan(0.15)
    }
    expect(totals.find((t) => t.fy === "2013-14")?.printedTotal).toBe(731010894.63)
  })
})
