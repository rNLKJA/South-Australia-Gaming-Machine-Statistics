import { describe, expect, it } from "vitest"

import pivots from "@/data/info-pivots.json"
import { crosswalk, lgaRows, lgaUnits, statewide } from "@/lib/data"

import {
  groupingThreshold,
  LGA_FYS,
  LGA_MEASURES,
  measureValue,
  rankUnits,
  rebuildUnits,
  reconcile,
  sortForMeasure,
  sortUnits,
  unitHistory,
  unitsForFy,
  type LgaSort,
} from "./lga"
import { annualStatewide } from "./statewide"

const P = pivots.pivots as unknown as Record<string, Record<string, Record<string, number>>>

describe("rebuildUnits (TypeScript port of the Python grouping)", () => {
  it("produces exactly the units written by scripts/build_data.py", () => {
    expect(rebuildUnits(lgaRows, crosswalk)).toEqual(lgaUnits)
  })

  it("rebuilds the 44 rows printed in the CBS FY 2013/14 release", () => {
    expect(unitsForFy(lgaUnits, "2013-14")).toHaveLength(44)
  })

  it("recovers published group totals from the equal split (CBS FY 2013/14 PDF)", () => {
    const fy = unitsForFy(lgaUnits, "2013-14")
    const find = (label: string) => fy.find((u) => u.label === label)!
    expect(find("Barunga West, Copper Coast").ngr).toBe(10277669.86)
    expect(find("Barunga West, Copper Coast").perRowNgr).toBe(5138834.93)
    expect(find("Campbelltown, Tea Tree Gully").ngr).toBe(46617275.99)
    expect(find("Campbelltown, Tea Tree Gully").machines).toBe(462)
    expect(find("Ceduna, Elliston, Lower Eyre Peninsula, Streaky Bay, Wudinna").machines).toBe(143)
  })

  it("treats a council split into several workbook rows as one council", () => {
    const n = unitsForFy(lgaUnits, "2013-14").find(
      (u) => u.id === "norwood-payneham-and-st-peters"
    )!
    expect(n.kind).toBe("split")
    expect(n.workbookNames).toEqual(["Norwood", "Payneham", "St Peters"])
    expect(n.ngr).toBe(32214698.25)
    expect(n.premises).toBe(17)
  })

  it("groups by NGR so an uneven machine split stays together (Light 54.5 + Mallala 55)", () => {
    const u = unitsForFy(lgaUnits, "2013-14").find((x) => x.label === "Adelaide Plains, Light")!
    expect(u.kind).toBe("group")
    expect(u.workbookNames).toEqual(["Light", "Mallala"])
    // CBS printed 109; the workbook's halves add to 109.5. scripts/verify_pdfs.py flags it.
    expect(u.machines).toBe(110)
  })

  it("never assigns one council boundary to two units in a year", () => {
    for (const fy of LGA_FYS) {
      const codes = unitsForFy(lgaUnits, fy).flatMap((u) => u.codes)
      expect(new Set(codes).size).toBe(codes.length)
    }
  })

  it("marks FY 2019/20 machines as not published", () => {
    for (const u of unitsForFy(lgaUnits, "2019-20")) {
      expect(u.machines).toBeNull()
      expect(measureValue(u, "ngrPerMachine")).toBeNull()
    }
  })
})

describe("totals (parity with INFO 'Sum of Aggregated NGR by LGA')", () => {
  it("matches the Grand Total row for every year", () => {
    const grand = P["Sum of Aggregated NGR by LGA (AUD)"]["Grand Total"]
    const rec = reconcile(lgaRows, lgaUnits, new Map())
    for (const r of rec) {
      expect(r.lgaTotal).toBeCloseTo(grand[r.fy], 2)
      expect(Math.abs(r.unitTotal - r.lgaTotal)).toBeLessThan(0.1)
    }
  })

  it("reconciles with statewide NGR within monthly rounding in every overlapping year", () => {
    const sw = new Map(annualStatewide(statewide).map((y) => [y.fy, y.ngr]))
    const rec = reconcile(lgaRows, lgaUnits, sw)
    const overlapping = rec.filter((r) => r.statewide != null)
    expect(overlapping).toHaveLength(11)
    // Statewide months are printed to $0.01m, so twelve of them can drift by up to $60,000.
    for (const r of overlapping) expect(Math.abs(r.difference!)).toBeLessThanOrEqual(60_000)
    // In practice the largest gap is FY 2016/17: $15,769 on $680m.
    const worst = Math.max(...overlapping.map((r) => Math.abs(r.difference!)))
    expect(worst).toBeCloseTo(15769.11, 2)
    expect(rec.find((r) => r.fy === "2014-15")?.statewide).toBeNull()
  })
})

describe("ranking and history", () => {
  it("ranks Salisbury, then Port Adelaide Enfield, by NGR in FY 2024/25", () => {
    const ranked = rankUnits(unitsForFy(lgaUnits, "2024-25"), "ngr")
    expect(ranked.slice(0, 2).map((u) => u.label)).toEqual(["Salisbury", "Port Adelaide Enfield"])
  })

  it("sinks missing values to the bottom whatever the direction", () => {
    const units = unitsForFy(lgaUnits, "2019-20")
    expect(rankUnits(units, "machines", "asc").every((u) => u.machines == null)).toBe(true)
  })

  it("follows a council through changing groups", () => {
    const grant = crosswalk.find((c) => c.workbookName === "Grant")!.absCode
    const h = unitHistory(lgaUnits, grant)
    expect(h).toHaveLength(12)
    expect(h.find((x) => x.fy === "2022-23")?.unit?.label).toBe("Grant")
    expect(h.find((x) => x.fy === "2023-24")?.unit?.label).toBe("Grant, Mount Gambier")
  })
})

describe("grouping rule", () => {
  it("uses the threshold printed in each release (5 venues to FY 2021/22, then 3)", () => {
    expect(groupingThreshold("2013-14")).toBe(5)
    expect(groupingThreshold("2021-22")).toBe(5)
    expect(groupingThreshold("2022-23")).toBe(3)
    expect(groupingThreshold("2024-25")).toBe(3)
  })

  it("publishes no council alone below the threshold from FY 2022/23", () => {
    for (const fy of LGA_FYS.filter((f) => f >= "2022-23")) {
      for (const u of unitsForFy(lgaUnits, fy).filter((x) => x.kind !== "group")) {
        expect(u.premises).toBeGreaterThanOrEqual(groupingThreshold(fy))
      }
    }
    // Grant, Kangaroo Island and Campbelltown (3 venues each) stand alone under the new rule.
    const alone = unitsForFy(lgaUnits, "2022-23").filter((u) => u.kind !== "group")
    for (const name of ["Grant", "Kangaroo Island", "Campbelltown"]) {
      expect(alone.find((u) => u.label === name)?.premises).toBe(3)
    }
  })
})

describe("ranked table sort", () => {
  const units = unitsForFy(lgaUnits, "2024-25")
  const rank = (measure: (typeof LGA_MEASURES)[number]["id"]) =>
    new Map(rankUnits(units, measure).map((u, i) => [u.id, i + 1]))

  it.each(LGA_MEASURES.map((m) => m.id))(
    "puts rank 1 first after switching the measure to %s",
    (measure) => {
      const sort = sortForMeasure({ col: "ngr", dir: "desc" }, measure)
      expect(sort).toEqual({ col: measure, dir: "desc" })
      const rows = sortUnits(units, sort)
      const r = rank(measure)
      expect(rows.slice(0, 5).map((u) => r.get(u.id))).toEqual([1, 2, 3, 4, 5])
    }
  )

  it("keeps a sort by area name when the measure changes", () => {
    const byName: LgaSort = { col: "label", dir: "asc" }
    expect(sortForMeasure(byName, "machines")).toBe(byName)
    const rows = sortUnits(units, byName)
    expect(rows[0].label.localeCompare(rows[1].label)).toBeLessThan(0)
    expect(sortUnits(units, { col: "label", dir: "desc" })[0]).toBe(rows.at(-1))
  })
})
