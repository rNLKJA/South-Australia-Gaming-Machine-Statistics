import { fyRange } from "./fy"
import { groupBy, mean, sum } from "./stats"
import { LICENCE_CATEGORIES, type FY, type LicenceCategory, type LicenceMonth } from "./types"

export const LICENCE_FIRST_FY: FY = "2009-10"
export const LICENCE_LAST_FY: FY = "2024-25"

export type LicenceMeasure = "entitlements" | "liveMachines" | "licences" | "liveLicences"

export const LICENCE_MEASURES: { id: LicenceMeasure; label: string; help: string }[] = [
  {
    id: "entitlements",
    label: "Entitlements held",
    help: "Machine entitlements held: the number of machines a venue is authorised to operate.",
  },
  {
    id: "liveMachines",
    label: "Live machines",
    help: "Machines actually installed and operating in the market.",
  },
  {
    id: "licences",
    label: "Licences granted",
    help: "Gaming machine licences on issue, including suspended licences.",
  },
  {
    id: "liveLicences",
    label: "Live licences",
    help: "Licensed venues actually operating machines.",
  },
]

export type LicenceAggregation = "mean" | "end"

export interface LicenceYearValue {
  fy: FY
  category: LicenceCategory
  /** Months with a row for this category in the year. */
  months: number
  mean: number | null
  /** The last month available in the year (normally June). */
  end: number | null
  endMonth: string | null
}

/**
 * Annual licence figures per category. Every licence measure is a month-end snapshot (a stock),
 * so a year is summarised by the mean of its snapshots (the workbook's "Average of" pivot) or by
 * the last snapshot, never by the sum.
 */
export function annualLicences(rows: LicenceMonth[], measure: LicenceMeasure): LicenceYearValue[] {
  const out: LicenceYearValue[] = []
  const byKey = groupBy(rows, (r) => `${r.fy}|${r.category}`)
  for (const fy of fyRange(LICENCE_FIRST_FY, LICENCE_LAST_FY)) {
    for (const category of LICENCE_CATEGORIES) {
      const rs = (byKey.get(`${fy}|${category}`) ?? []).sort((a, b) =>
        a.month.localeCompare(b.month)
      )
      const last = rs.at(-1)
      out.push({
        fy,
        category,
        months: rs.length,
        mean: mean(rs.map((r) => r[measure])),
        end: last ? last[measure] : null,
        endMonth: last?.month ?? null,
      })
    }
  }
  return out
}

/** Months (YYYY-MM) in the range that have no licence rows at all. */
export function missingLicenceMonths(rows: LicenceMonth[]): string[] {
  const have = new Set(rows.map((r) => r.month))
  const sorted = [...have].sort()
  const missing: string[] = []
  const [y0, m0] = sorted[0].split("-").map(Number)
  const [y1, m1] = sorted.at(-1)!.split("-").map(Number)
  for (let y = y0, m = m0; y < y1 || (y === y1 && m <= m1);) {
    const key = `${y}-${String(m).padStart(2, "0")}`
    if (!have.has(key)) missing.push(key)
    m++
    if (m > 12) {
      m = 1
      y++
    }
  }
  return missing
}

/** Power BI "SA Gaming Licences" page: Sum of the measure over every month in the year. */
export function licencesAsBuilt(rows: LicenceMonth[], measure: LicenceMeasure) {
  const byKey = groupBy(rows, (r) => `${r.fy}|${r.category}`)
  return [...byKey.entries()].map(([key, rs]) => {
    const [fy, category] = key.split("|") as [FY, LicenceCategory]
    return { fy, category, sum: sum(rs.map((r) => r[measure])), months: rs.length }
  })
}

/** A monthly series per category for charts. */
export function monthlyLicences(rows: LicenceMonth[], measure: LicenceMeasure) {
  const byMonth = groupBy(rows, (r) => r.month)
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, rs]) => {
      const point: Record<string, number | string | null> = { month, fy: rs[0].fy }
      for (const c of LICENCE_CATEGORIES) {
        const r = rs.find((x) => x.category === c)
        point[c] = r ? r[measure] : null
      }
      return point
    })
}
