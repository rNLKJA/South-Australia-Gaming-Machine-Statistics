import { fyRange } from "./fy"
import { round, sum } from "./stats"
import type { CrosswalkEntry, FY, LgaRow, LgaUnit, LgaUnitKind } from "./types"

export const LGA_FIRST_FY: FY = "2013-14"
export const LGA_LAST_FY: FY = "2024-25"
export const LGA_FYS = fyRange(LGA_FIRST_FY, LGA_LAST_FY)
/** The FY 2019/20 LGA release has no machine column; the workbook stores 0 for every area. */
export const LGA_NO_MACHINES_FY: FY = "2019-20"
/**
 * The first release with CBS's lower grouping threshold. FY 2013/14 to 2021/22 releases say an
 * LGA with "less than 5 venues" is grouped with another; FY 2022/23 onwards say "less than 3".
 */
export const GROUPING_RULE_CHANGE_FY: FY = "2022-23"

/** The venue count below which CBS says it merges a council with a neighbour, for a year. */
export function groupingThreshold(fy: FY): number {
  return fy >= GROUPING_RULE_CHANGE_FY ? 3 : 5
}

export type LgaMeasure = "ngr" | "ngrPerMachine" | "machines" | "premises" | "avgPerVenue"

export const LGA_MEASURES: { id: LgaMeasure; label: string; short: string; help: string }[] = [
  {
    id: "ngr",
    label: "Net gambling revenue",
    short: "NGR",
    help: "Total NGR (player losses) across the area's venues in the financial year.",
  },
  {
    id: "ngrPerMachine",
    label: "NGR per machine",
    short: "NGR / machine",
    help: "Annual NGR divided by machines at 30 June. Not available for FY 2019/20.",
  },
  {
    id: "avgPerVenue",
    label: "NGR per venue",
    short: "NGR / venue",
    help: "The average NGR per venue as published by CBS.",
  },
  {
    id: "machines",
    label: "Gaming machines",
    short: "Machines",
    help: "Machines in the area's venues at 30 June. Not published for FY 2019/20.",
  },
  {
    id: "premises",
    label: "Venues",
    short: "Venues",
    help: "Venues (premises) with gaming-machine activity during the year.",
  },
]

export function measureValue(unit: LgaUnit, measure: LgaMeasure): number | null {
  switch (measure) {
    case "ngr":
      return unit.ngr
    case "avgPerVenue":
      return unit.avgPerVenue
    case "premises":
      return unit.premises
    case "machines":
      return unit.machines
    case "ngrPerMachine":
      return unit.machines ? unit.ngr / unit.machines : null
  }
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

/**
 * TypeScript port of scripts/build_data.py `build_units`: rebuild the rows CBS published from the
 * workbook's per-name rows. Members of one published row share an identical (NGR, NGR per venue)
 * signature within a year because the workbook divided the group's figures equally across names.
 */
export function rebuildUnits(rows: LgaRow[], crosswalk: CrosswalkEntry[]): LgaUnit[] {
  const xw = new Map(crosswalk.map((c) => [c.workbookName, c]))
  const fys = [...new Set(rows.map((r) => r.fy))].sort()
  const units: LgaUnit[] = []
  for (const fy of fys) {
    const rs = rows.filter((r) => r.fy === fy)
    const machinesPublished = rs.some((r) => (r.machines ?? 0) > 0)
    const buckets = new Map<string, LgaRow[]>()
    for (const r of rs) {
      const sig = `${r.ngr}|${r.avgPerVenue}`
      const b = buckets.get(sig)
      if (b) b.push(r)
      else buckets.set(sig, [r])
    }
    for (const members of buckets.values()) {
      const names = members.map((m) => m.name)
      const entries = names.map((n) => {
        const e = xw.get(n)
        if (!e) throw new Error(`crosswalk has no entry for ${n}`)
        return e
      })
      const display = [...new Set(entries.map((e) => e.displayName))]
      const displaySorted = [...display].sort()
      const codes = [...new Set(entries.filter((e) => e.geometry).map((e) => e.absCode))].sort()
      const kind: LgaUnitKind = display.length > 1 ? "group" : names.length > 1 ? "split" : "single"
      units.push({
        fy,
        id: slug(displaySorted.join(" + ")),
        label: displaySorted.join(", "),
        members: displaySorted,
        kind,
        workbookNames: names,
        workbookRows: names.length,
        codes,
        geoKey: codes.join("+"),
        ngr: round(sum(members.map((m) => m.ngr)), 2),
        avgPerVenue: members[0].avgPerVenue,
        machines: machinesPublished ? Math.round(sum(members.map((m) => m.machines))) : null,
        premises: Math.round(sum(members.map((m) => m.premises))),
        perRowNgr: members[0].ngr,
        relations: [...new Set(entries.map((e) => e.relation))].sort(),
      })
    }
  }
  return units
}

export function unitsForFy(units: LgaUnit[], fy: FY): LgaUnit[] {
  return units.filter((u) => u.fy === fy)
}

export type SortDir = "asc" | "desc"
export type LgaSortCol = "label" | LgaMeasure
export interface LgaSort {
  col: LgaSortCol
  dir: SortDir
}

/** Rank units by a measure; units without a value sink to the bottom. */
export function rankUnits(units: LgaUnit[], measure: LgaMeasure, dir: SortDir = "desc"): LgaUnit[] {
  return [...units].sort((a, b) => {
    const va = measureValue(a, measure)
    const vb = measureValue(b, measure)
    if (va == null && vb == null) return a.label.localeCompare(b.label)
    if (va == null) return 1
    if (vb == null) return -1
    return dir === "desc" ? vb - va : va - vb
  })
}

/** Order units for the ranked table: by area name, or by a measure. */
export function sortUnits(units: LgaUnit[], sort: LgaSort): LgaUnit[] {
  if (sort.col !== "label") return rankUnits(units, sort.col, sort.dir)
  const r = [...units].sort((a, b) => a.label.localeCompare(b.label))
  return sort.dir === "asc" ? r : r.reverse()
}

/**
 * The table sort after the map measure changes: a name sort is kept, any measure sort follows
 * the new measure (largest first), so the "Ranked" table stays ranked by what is on screen.
 */
export function sortForMeasure(sort: LgaSort, measure: LgaMeasure): LgaSort {
  return sort.col === "label" ? sort : { col: measure, dir: "desc" }
}

/** For each year, the published unit that contains an ABS council code (or null). */
export function unitHistory(units: LgaUnit[], code: string): { fy: FY; unit: LgaUnit | null }[] {
  return LGA_FYS.map((fy) => ({
    fy,
    unit: units.find((u) => u.fy === fy && u.codes.includes(code)) ?? null,
  }))
}

export interface Reconciliation {
  fy: FY
  /** Sum of the workbook's LGA rows, $. */
  lgaTotal: number
  /** Sum of the rebuilt published units, $. */
  unitTotal: number
  /** Annual statewide NGR from the monthly series, $ (null where the statewide year is missing). */
  statewide: number | null
  /** lgaTotal − statewide, $. */
  difference: number | null
}

export function reconcile(
  rows: LgaRow[],
  units: LgaUnit[],
  statewideByFy: Map<FY, number | null>
): Reconciliation[] {
  return LGA_FYS.map((fy) => {
    const lgaTotal = round(sum(rows.filter((r) => r.fy === fy).map((r) => r.ngr)), 2)
    const unitTotal = round(sum(units.filter((u) => u.fy === fy).map((u) => u.ngr)), 2)
    const sw = statewideByFy.get(fy)
    const statewide = sw == null ? null : round(sw * 1e6, 2)
    return {
      fy,
      lgaTotal,
      unitTotal,
      statewide,
      difference: statewide == null ? null : round(lgaTotal - statewide, 2),
    }
  })
}
