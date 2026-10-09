import { groupBy, mean, round, sum } from "./stats"
import type { FY, ManufacturerMonth, Month } from "./types"

/**
 * Stargames, SGS (Scientific Games) and Light & Wonder are successive names of one corporate
 * lineage; CBS labels changed between months. Merging them is optional and off by default so the
 * figures match the releases.
 */
export const LINEAGE_MEMBERS = ["Stargames", "SGS", "Light & Wonder"] as const
export const LINEAGE_LABEL = "Light & Wonder (incl. SGS, Stargames)"

export function canonicalMaker(name: string, mergeLineage: boolean): string {
  if (mergeLineage && (LINEAGE_MEMBERS as readonly string[]).includes(name)) return LINEAGE_LABEL
  return name
}

export interface MonthShares {
  month: Month
  fy: FY
  /** Sum of the manufacturer counts listed for the month (the share denominator). */
  total: number
  /** The month total CBS printed (can differ slightly, see the Data quality page). */
  printedTotal: number
  /** Sum of the printed "% of Total" column. */
  printedShareSum: number
  counts: Record<string, number>
  shares: Record<string, number>
  /** Herfindahl–Hirschman index on a 0–10,000 scale. */
  hhi: number
}

/** Herfindahl–Hirschman index from shares expressed as fractions: Σ (100 · s)². */
export function hhi(shares: number[]): number {
  return sum(shares.map((s) => (100 * s) ** 2))
}

export function monthlyShares(rows: ManufacturerMonth[], mergeLineage = false): MonthShares[] {
  const byMonth = groupBy(rows, (r) => r.month)
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, rs]) => {
      const counts: Record<string, number> = {}
      for (const r of rs) {
        const k = canonicalMaker(r.manufacturer, mergeLineage)
        counts[k] = (counts[k] ?? 0) + r.machines
      }
      const total = sum(Object.values(counts))
      const shares: Record<string, number> = {}
      for (const [k, v] of Object.entries(counts)) shares[k] = total ? v / total : 0
      return {
        month,
        fy: rs[0].fy,
        total,
        printedTotal: rs[0].monthTotal,
        printedShareSum: round(sum(rs.map((r) => r.pct)), 4),
        counts,
        shares,
        hhi: hhi(Object.values(shares)),
      }
    })
}

export interface ManufacturerYear {
  fy: FY
  months: number
  /** Mean monthly share per manufacturer (months a maker is absent count as zero). */
  shares: Record<string, number>
  /** Mean monthly HHI. */
  hhi: number
  /** Manufacturers listed at least once in the year. */
  makers: number
}

export function annualManufacturers(months: MonthShares[]): ManufacturerYear[] {
  const byFy = groupBy(months, (m) => m.fy)
  return [...byFy.entries()].map(([fy, ms]) => {
    const makers = new Set(ms.flatMap((m) => Object.keys(m.shares)))
    const shares: Record<string, number> = {}
    for (const k of makers) shares[k] = sum(ms.map((m) => m.shares[k] ?? 0)) / ms.length
    return {
      fy,
      months: ms.length,
      shares,
      hhi: mean(ms.map((m) => m.hhi)) ?? 0,
      makers: makers.size,
    }
  })
}

/**
 * The workbook's INFO pivot "Average of No. of GMs": the mean machine count per manufacturer
 * over the months in which that manufacturer is listed.
 */
export function pivotAverageMachines(
  rows: ManufacturerMonth[]
): Record<string, Record<FY, number>> {
  const out: Record<string, Record<FY, number>> = {}
  for (const [key, rs] of groupBy(rows, (r) => `${r.manufacturer}|${r.fy}`)) {
    const [maker, fy] = key.split("|")
    out[maker] ??= {}
    out[maker][fy] = mean(rs.map((r) => r.machines)) ?? 0
  }
  return out
}

/** Power BI "SA Gaming Manufacturer" page: Sum of "% of Total" by financial year. */
export function manufacturersAsBuilt(rows: ManufacturerMonth[]) {
  const out: Record<string, Record<FY, number>> = {}
  for (const [key, rs] of groupBy(rows, (r) => `${r.manufacturer}|${r.fy}`)) {
    const [maker, fy] = key.split("|")
    out[maker] ??= {}
    out[maker][fy] = round(sum(rs.map((r) => r.pct)), 4)
  }
  return out
}

/**
 * Manufacturers that ever reach `threshold` share in a month get their own series; the rest are
 * pooled as "Other". Ordered by mean share, largest first.
 */
export function leadingMakers(months: MonthShares[], threshold = 0.025): string[] {
  const peak = new Map<string, number>()
  const total = new Map<string, number>()
  for (const m of months) {
    for (const [k, s] of Object.entries(m.shares)) {
      peak.set(k, Math.max(peak.get(k) ?? 0, s))
      total.set(k, (total.get(k) ?? 0) + s)
    }
  }
  return [...peak.entries()]
    .filter(([, p]) => p >= threshold)
    .map(([k]) => k)
    .sort((a, b) => (total.get(b) ?? 0) - (total.get(a) ?? 0))
}

/** Months between the first and last month that have no manufacturer rows. */
export function missingManufacturerMonths(rows: ManufacturerMonth[]): Month[] {
  const have = new Set(rows.map((r) => r.month))
  const sorted = [...have].sort()
  const out: Month[] = []
  let [y, m] = sorted[0].split("-").map(Number)
  const last = sorted.at(-1)!
  for (;;) {
    const key = `${y}-${String(m).padStart(2, "0")}`
    if (key > last) break
    if (!have.has(key)) out.push(key)
    m++
    if (m > 12) {
      m = 1
      y++
    }
  }
  return out
}
