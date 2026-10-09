import { describe, expect, it } from "vitest"

import pivots from "@/data/info-pivots.json"
import { crosswalk, lgaRows, lgaUnits, statewide } from "@/lib/data"

import cbs201314 from "./__fixtures__/cbs-lga-2013-14.json"
import {
  areaHistory,
  areaYear,
  combineUnits,
  groupingThreshold,
  LGA_FYS,
  LGA_MEASURES,
  measureValue,
  rankUnits,
  rebuildUnits,
  reconcile,
  sortForMeasure,
  sortUnits,
  unitsForFy,
  type LgaSort,
} from "./lga"
import { round } from "./stats"
import { annualStatewide } from "./statewide"

const P = pivots.pivots as unknown as Record<string, Record<string, Record<string, number>>>

describe("rebuildUnits (TypeScript port of the Python grouping)", () => {
  it("produces exactly the units written by scripts/build_data.py", () => {
    expect(rebuildUnits(lgaRows, crosswalk)).toEqual(lgaUnits)
  })

  it("rebuilds the 44 rows printed in the CBS FY 2013/14 release", () => {
    // Transcribed from original/SA Gaming Data/Gaming Machine Revenue by ABS LGA/2013-14.pdf.
    const printed = cbs201314.rows
    expect(printed).toHaveLength(44)
    expect(printed.reduce((s, r) => s + r.venues, 0)).toBe(cbs201314.total.venues)
    expect(printed.reduce((s, r) => s + r.machines, 0)).toBe(cbs201314.total.machines)
    const rebuilt = [...unitsForFy(lgaUnits, "2013-14")].sort((a, b) => a.ngr - b.ngr)
    const rows = [...printed].sort((a, b) => a.ngr - b.ngr)
    expect(rebuilt.map((u) => u.label.split(", ").length)).toEqual(
      // "Orroroo/Carrieton" and "Karoonda/East Murray" are one council each.
      rows.map((r) => r.label.split(", ").length)
    )
    expect(
      rebuilt.map((u) => ({ venues: u.premises, machines: u.machines, perVenue: u.avgPerVenue }))
    ).toEqual(
      rows.map((r) => ({
        venues: r.venues,
        // The documented exception: CBS printed 109 machines for Light and Mallala, but the
        // workbook's halves (54.5 + 55) rebuild to 110. scripts/verify_pdfs.py lists it.
        machines: r.label === "Light, Mallala" ? 110 : r.machines,
        perVenue: r.ngrPerVenue,
      }))
    )
    // NGR matches to the cent except where the workbook's equal split lost a cent in rounding
    // (thirds and quarters stored to the cent); verify_pdfs.py allows a cent per workbook row.
    const off = rebuilt
      .map((u, i) => ({
        label: u.label,
        rows: u.workbookRows,
        diff: round(u.ngr - rows[i].ngr, 2),
      }))
      .filter((d) => d.diff !== 0)
    expect(off).toEqual([
      { label: "Mount Remarkable, Orroroo Carrieton, Peterborough", rows: 4, diff: 0.01 },
      { label: "Kangaroo Island, Victor Harbor, Yankalilla", rows: 3, diff: -0.01 },
    ])
    for (const d of off) expect(Math.abs(d.diff)).toBeLessThanOrEqual(0.01 * d.rows + 0.005)
  })

  it("rebuilds as many rows as CBS printed in every release", () => {
    // Counted from the twelve LGA PDFs in original/ (FY 2021/22 wraps one row over two lines).
    const counts = Object.fromEntries(LGA_FYS.map((fy) => [fy, unitsForFy(lgaUnits, fy).length]))
    expect(counts).toEqual({
      "2013-14": 44,
      "2014-15": 44,
      "2015-16": 44,
      "2016-17": 44,
      "2017-18": 44,
      "2018-19": 44,
      "2019-20": 44,
      "2020-21": 44,
      "2021-22": 44,
      "2022-23": 49,
      "2023-24": 48,
      "2024-25": 48,
    })
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
})

describe("area history (a selected area followed through regrouping)", () => {
  const byFy = (members: string[]) =>
    Object.fromEntries(areaHistory(lgaUnits, members).map((y) => [y.fy, y]))

  it("adds Grant and Mount Gambier back together in FY 2022/23, when CBS printed them apart", () => {
    const h = byFy(["Grant", "Mount Gambier"])
    expect(Object.keys(h)).toEqual(LGA_FYS)
    const y = h["2022-23"]
    expect(y.status).toBe("parts")
    expect(y.units.map((u) => u.label)).toEqual(["Grant", "Mount Gambier"])
    // Grant alone was $564,889.60; the area is Grant plus Mount Gambier's $22,169,059.23.
    expect(y.totals).toEqual({
      ngr: 22733948.83,
      machines: 337,
      premises: 14,
      avgPerVenue: 1623853.49,
    })
    expect(measureValue(y.totals!, "ngrPerMachine")).toBeCloseTo(22733948.83 / 337, 6)
    for (const fy of LGA_FYS.filter((f) => f !== "2022-23")) {
      expect(h[fy].status).toBe("same")
      expect(h[fy].units[0].label).toBe("Grant, Mount Gambier")
    }
    expect(h["2023-24"].totals?.ngr).toBe(23131150.12)
  })

  it("never mixes Murray Bridge into Karoonda East Murray and Southern Mallee", () => {
    const h = byFy(["Karoonda East Murray", "Southern Mallee"])
    for (const fy of LGA_FYS) {
      const y = h[fy]
      if (fy < "2022-23") {
        expect(y.status).toBe("wider")
        expect(y.units[0].members).toContain("Murray Bridge")
      } else {
        expect(y.status).toBe("same")
        expect(y.totals!.ngr).toBeLessThan(500_000)
      }
    }
    expect(h["2021-22"].totals?.ngr).toBe(12407989.68)
  })

  it("flags the years Kingston was published with Loxton Waikerie", () => {
    const h = byFy(["Kingston", "Naracoorte Lucindale", "Robe"])
    const wider = LGA_FYS.filter((fy) => h[fy].status === "wider")
    expect(wider).toEqual(["2022-23", "2023-24"])
    expect(h["2022-23"].units.map((u) => u.label)).toEqual([
      "Kingston, Loxton Waikerie",
      "Naracoorte Lucindale, Robe",
    ])
  })

  it("reports no venues for a council with none that year instead of another year's figures", () => {
    const y = areaYear(lgaUnits, ["Orroroo Carrieton"], "2023-24")
    expect(y).toEqual({
      fy: "2023-24",
      status: "none",
      units: [],
      absent: ["Orroroo Carrieton"],
      totals: null,
    })
    expect(areaYear(lgaUnits, ["Orroroo Carrieton"], "2021-22").status).toBe("wider")
  })

  it("keeps a unit's published figures and recomputes NGR per venue only for sums", () => {
    const [u] = unitsForFy(lgaUnits, "2024-25").filter((x) => x.label === "Salisbury")
    expect(combineUnits([u])).toEqual({
      ngr: u.ngr,
      avgPerVenue: u.avgPerVenue,
      machines: u.machines,
      premises: u.premises,
    })
    const covid = unitsForFy(lgaUnits, "2019-20").slice(0, 2)
    expect(combineUnits(covid).machines).toBeNull()
  })

  it("shows every FY 2024/25 area as published that year", () => {
    for (const u of unitsForFy(lgaUnits, "2024-25")) {
      const y = areaYear(lgaUnits, u.members, "2024-25")
      expect(y.status).toBe("same")
      expect(y.units).toEqual([u])
    }
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
