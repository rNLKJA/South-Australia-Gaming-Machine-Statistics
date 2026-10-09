import { calendarQuarter, monthsOfFy } from "./fy"
import type { CpiPoint, FY, Month } from "./types"

/** Index for the calendar quarter containing `month`, or null if the ABS series doesn't cover it. */
export function cpiForMonth(series: CpiPoint[], month: Month): number | null {
  const q = calendarQuarter(month)
  return series.find((p) => p.quarter === q)?.index ?? null
}

/** Mean of the four quarterly indexes in a financial year. */
export function fyAverageCpi(series: CpiPoint[], fy: FY): number | null {
  const quarters = new Set(monthsOfFy(fy).map(calendarQuarter))
  const pts = series.filter((p) => quarters.has(p.quarter))
  if (pts.length !== 4) return null
  return pts.reduce((s, p) => s + p.index, 0) / 4
}

/**
 * Multiplier that converts a dollar amount in `month` into average `baseFy` dollars:
 * real = nominal × CPI(base FY average) / CPI(quarter of month).
 */
export function realTermsFactor(series: CpiPoint[], month: Month, baseFy: FY): number | null {
  const base = fyAverageCpi(series, baseFy)
  const idx = cpiForMonth(series, month)
  if (base == null || idx == null) return null
  return base / idx
}
