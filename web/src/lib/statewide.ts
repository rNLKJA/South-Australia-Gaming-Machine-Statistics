import { realTermsFactor } from "./cpi"
import { fyRange } from "./fy"
import { groupBy, mean, round, sum } from "./stats"
import type { CpiPoint, FY, Month, StatewideMonth } from "./types"

export const STATEWIDE_FIRST_FY: FY = "2009-10"
export const STATEWIDE_LAST_FY: FY = "2024-25"
/** No CBS statewide release for FY 2014/15 is archived, so the workbook has no rows for it. */
export const STATEWIDE_MISSING_FY: FY = "2014-15"
/** Venues closed under COVID-19 restrictions from late March 2020. */
export const COVID_FY: FY = "2019-20"

export type StatewideMeasure =
  "ngr" | "tax" | "venueShare" | "machines" | "venues" | "ngrPerMachine"

export const MONEY_MEASURES: StatewideMeasure[] = ["ngr", "tax", "venueShare"]

export interface StatewideYear {
  fy: FY
  /** Monthly rows present for the year (12, or 0 for the missing year). */
  months: number
  /** Flow measures: sums of the monthly values, $ million. */
  ngr: number | null
  tax: number | null
  venueShare: number | null
  /** Stock measures: the mean of monthly snapshots (the workbook's "Average of") and June. */
  machinesMean: number | null
  machinesJune: number | null
  venuesMean: number | null
  venuesJune: number | null
  /** Months in which CBS reported zero machines (COVID-19 closures). */
  zeroMachineMonths: number
  /** NGR per machine in dollars: annual NGR / mean machines. */
  ngrPerMachine: number | null
  /** Tax as a share of NGR. */
  taxRate: number | null
  /** Change in NGR against the previous financial year (null when that year is missing). */
  ngrChange: number | null
}

function lastMonth(rows: StatewideMonth[]): StatewideMonth | undefined {
  return [...rows].sort((a, b) => a.month.localeCompare(b.month)).at(-1)
}

/**
 * Annual statewide figures. Flows (NGR, tax, venue share) are summed over months; stocks
 * (machines, venues) are averaged, never summed. Pass `real` to restate dollars in average
 * `real.baseFy` dollars using the Adelaide CPI.
 */
export function annualStatewide(
  rows: StatewideMonth[],
  real?: { cpi: CpiPoint[]; baseFy: FY }
): StatewideYear[] {
  const byFy = groupBy(rows, (r) => r.fy)
  const out: StatewideYear[] = []
  let prevNgr: number | null = null
  for (const fy of fyRange(STATEWIDE_FIRST_FY, STATEWIDE_LAST_FY)) {
    const rs = byFy.get(fy) ?? []
    if (rs.length === 0) {
      out.push({
        fy,
        months: 0,
        ngr: null,
        tax: null,
        venueShare: null,
        machinesMean: null,
        machinesJune: null,
        venuesMean: null,
        venuesJune: null,
        zeroMachineMonths: 0,
        ngrPerMachine: null,
        taxRate: null,
        ngrChange: null,
      })
      prevNgr = null
      continue
    }
    const money = (pick: (r: StatewideMonth) => number) =>
      round(
        sum(
          rs.map((r) => {
            const f = real ? realTermsFactor(real.cpi, r.month, real.baseFy) : 1
            return pick(r) * (f ?? NaN)
          })
        ),
        real ? 4 : 2
      )
    const ngr = money((r) => r.ngr)
    const tax = money((r) => r.tax)
    const venueShare = money((r) => r.venueShare)
    const machinesMean = mean(rs.map((r) => r.machines))
    const june = lastMonth(rs)
    const ngrPerMachine = machinesMean ? (ngr * 1e6) / machinesMean : null
    out.push({
      fy,
      months: rs.length,
      ngr,
      tax,
      venueShare,
      machinesMean,
      machinesJune: june?.machines ?? null,
      venuesMean: mean(rs.map((r) => r.venues)),
      venuesJune: june?.venues ?? null,
      zeroMachineMonths: rs.filter((r) => r.machines === 0).length,
      ngrPerMachine,
      taxRate: ngr ? tax / ngr : null,
      ngrChange: prevNgr ? ngr / prevNgr - 1 : null,
    })
    prevNgr = ngr
  }
  return out
}

/** The value a measure takes for one month (dollars optionally restated in base-FY dollars). */
export function monthlyValue(
  row: StatewideMonth,
  measure: StatewideMeasure,
  real?: { cpi: CpiPoint[]; baseFy: FY }
): number | null {
  const f = real ? realTermsFactor(real.cpi, row.month, real.baseFy) : 1
  if (f == null) return null
  switch (measure) {
    case "ngr":
    case "tax":
    case "venueShare":
      return row[measure] * f
    case "machines":
    case "venues":
      return row[measure]
    case "ngrPerMachine":
      return row.machines > 0 ? (row.ngr * 1e6 * f) / row.machines : null
  }
}

export interface MonthlyPoint {
  month: Month
  fy: FY
  value: number | null
}

export function monthlySeries(
  rows: StatewideMonth[],
  measure: StatewideMeasure,
  real?: { cpi: CpiPoint[]; baseFy: FY }
): MonthlyPoint[] {
  return [...rows]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((r) => ({ month: r.month, fy: r.fy, value: monthlyValue(r, measure, real) }))
}

export function annualValue(year: StatewideYear, measure: StatewideMeasure): number | null {
  switch (measure) {
    case "machines":
      return year.machinesMean
    case "venues":
      return year.venuesMean
    default:
      return year[measure]
  }
}

/**
 * What the Power BI "SA Gaming Statistics" page shows: the default Sum aggregation over every
 * monthly row in a financial year, for every measure (including the stocks).
 */
export function statewideAsBuilt(rows: StatewideMonth[]) {
  const byFy = groupBy(rows, (r) => r.fy)
  return [...byFy.entries()].map(([fy, rs]) => ({
    fy,
    ngr: round(sum(rs.map((r) => r.ngr)), 2),
    tax: round(sum(rs.map((r) => r.tax)), 2),
    venueShare: round(sum(rs.map((r) => r.venueShare)), 2),
    machines: sum(rs.map((r) => r.machines)),
    venues: sum(rs.map((r) => r.venues)),
  }))
}
