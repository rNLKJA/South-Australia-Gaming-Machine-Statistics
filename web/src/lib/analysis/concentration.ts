import { fyRange, monthsOfFy } from "../fy"
import { monthlyShares, type MonthShares } from "../manufacturers"
import { bootstrapMean, type BootstrapResult } from "../stats/bootstrap"
import { DEFAULT_SEED } from "../stats/rng"
import { bootstrapHinge, type HingeBootstrap } from "../stats/segmented"
import type { FY, ManufacturerMonth, Month } from "../types"

/**
 * Market concentration (HHI) with its uncertainty: annual means with a bootstrap over months, and
 * a broken-stick change-point check on the monthly series.
 */

export const FIRST_MONTH: Month = "2009-07"

export interface HhiYear {
  fy: FY
  months: number
  hhi: BootstrapResult
}

export function hhiByYear(
  months: readonly MonthShares[],
  { B = 2000, seed = DEFAULT_SEED }: { B?: number; seed?: number } = {}
): HhiYear[] {
  const fys = fyRange(months[0].fy, months.at(-1)!.fy)
  return fys
    .map((fy) => {
      const ms = months.filter((m) => m.fy === fy)
      return {
        fy,
        months: ms.length,
        hhi: bootstrapMean(
          ms.map((m) => m.hhi),
          { B, seed }
        ),
      }
    })
    .filter((y) => y.months > 0)
}

/** Months since July 2009 (0 = July 2009). */
export function monthIndex(month: Month): number {
  const [y, m] = month.split("-").map(Number)
  return (y - 2009) * 12 + (m - 7)
}

export function monthFromIndex(i: number): Month {
  const total = 2009 * 12 + 6 + Math.round(i)
  const y = Math.floor(total / 12)
  const m = (total % 12) + 1
  return `${y}-${String(m).padStart(2, "0")}`
}

export interface ConcentrationVariant {
  id: "published" | "lineage"
  label: string
  monthly: { month: Month; hhi: number }[]
  annual: HhiYear[]
  breakpoint: HingeBootstrap
  /** Fitted broken-stick values by month, for drawing. */
  fitted: { month: Month; fitted: number }[]
}

export function concentrationVariant(
  rows: readonly ManufacturerMonth[],
  merge: boolean,
  {
    B = 1000,
    seed = DEFAULT_SEED,
    minSegment = 24,
  }: { B?: number; seed?: number; minSegment?: number } = {}
): ConcentrationVariant {
  const months = monthlyShares([...rows], merge)
  const t = months.map((m) => monthIndex(m.month))
  const y = months.map((m) => m.hhi)
  const breakpoint = bootstrapHinge(t, y, { B, seed, minSegment })
  return {
    id: merge ? "lineage" : "published",
    label: merge ? "Light & Wonder lineage combined" : "Names as published",
    monthly: months.map((m) => ({ month: m.month, hhi: m.hhi })),
    annual: hhiByYear(months, { B: 2000, seed }),
    breakpoint,
    fitted: months.map((m, i) => ({ month: m.month, fitted: breakpoint.fit.fitted[i] })),
  }
}

/** Every month of the manufacturer series' span, for charts with gaps. */
export function allMonths(first: FY, last: FY): Month[] {
  return fyRange(first, last).flatMap(monthsOfFy)
}
