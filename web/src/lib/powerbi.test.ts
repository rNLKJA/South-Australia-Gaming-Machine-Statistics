import { describe, expect, it } from "vitest"

import { licences, manufacturers, powerBiVisuals, statewide } from "@/lib/data"

import { asBuiltComparisons, powerBiFields } from "./powerbi"

describe("powerBiFields", () => {
  const fields = powerBiFields(powerBiVisuals)

  it("reads every aggregated field from the report layout", () => {
    expect(fields.every((f) => f.aggregation === "Sum")).toBe(true)
    expect(new Set(fields.map((f) => f.page))).toEqual(
      new Set([
        "SA Gaming Licences",
        "SA Gaming Revenue by LGA",
        "SA Gaming Manufacturer",
        "SA Gaming Statistics",
      ])
    )
  })

  it("finds the stock and share fields that are summed across a year axis", () => {
    const misleading = fields.filter((f) => (f.kind === "stock" || f.kind === "share") && f.byYear)
    expect(new Set(misleading.map((f) => f.label))).toEqual(
      new Set([
        "Machines",
        "Venues",
        "Entitlements held",
        "Live licences",
        "Manufacturer % of total",
      ])
    )
  })
})

describe("asBuiltComparisons", () => {
  const rows = asBuiltComparisons("2024-25", { statewide, licences, manufacturers })
  const get = (m: string) => rows.find((r) => r.measure === m)!

  it("leaves flows unchanged", () => {
    const ngr = get("Net gambling revenue ($m)")
    expect(ngr.asBuilt).toBe(1008.46)
    expect(ngr.corrected).toBe(1008.46)
  })

  it("shows the twelvefold inflation of stocks", () => {
    const m = get("Machines")
    expect(m.asBuilt).toBe(140948)
    expect(m.asBuilt / m.corrected).toBeCloseTo(12, 9)
    expect(
      get("Entitlements held · Hotels").asBuilt / get("Entitlements held · Hotels").corrected
    ).toBeCloseTo(12, 9)
    const share = get("% of total · Aristocrat")
    expect(share.asBuilt).toBeGreaterThan(1) // "more than 100%" of the market
    expect(share.asBuilt / share.corrected).toBeCloseTo(12, 1)
  })
})
