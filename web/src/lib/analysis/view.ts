import "server-only"

import { cpi, lgaUnits, manufacturers, statewide } from "../data"
import { fyRange, monthsOfFy } from "../fy"
import { DEFAULT_SEED } from "../stats/rng"
import { concentrationVariant, monthFromIndex } from "./concentration"
import { areaYears, funnelYears, persistentRatios, scalingCheck, yearToYearScale } from "./councils"
import {
  interruptedTimeSeries,
  ITS_SPECS,
  pairedComparisons,
  perMachineByYear,
  realMonths,
  stlSegments,
} from "./trends"

/**
 * Page-sized results for the Analysis pages, computed once per build (every input is static and
 * every resample is seeded, so the pages are prerendered and reproducible).
 */

const triple = (e: { estimate: number; lower: number; upper: number }) =>
  [e.estimate, e.lower, e.upper] as [number, number, number]

let trendsCache: ReturnType<typeof buildTrends> | null = null
let councilsCache: ReturnType<typeof buildCouncils> | null = null
let concentrationCache: ReturnType<typeof buildConcentration> | null = null

function buildTrends() {
  const months = realMonths(statewide, cpi)
  const segments = stlSegments(months)
  const byMonth = new Map(segments.flatMap((s) => s.points.map((p) => [p.month, p] as const)))
  const stlRows = fyRange("2009-10", "2024-25")
    .flatMap(monthsOfFy)
    .map((month) => {
      const p = byMonth.get(month)
      return {
        month,
        observed: p?.observed ?? null,
        trend: p?.trend ?? null,
        seasonal: p?.seasonal ?? null,
        remainder: p?.remainder ?? null,
        setAside: p && p.weight < 0.5 ? p.observed : null,
      }
    })
  const its = ITS_SPECS.map((spec) => interruptedTimeSeries(months, spec))
  return {
    segments,
    stlRows,
    its,
    itsViews: its.map((r) => ({
      id: r.spec.id,
      label: r.spec.label,
      note: r.spec.note,
      unit: r.unit,
      n: r.n,
      lag: r.lag,
      level: triple(r.level),
      slopePerYear: triple(r.slopePerYear),
      gapAtEnd: triple(r.gapAtEnd),
      series: r.series,
    })),
    paired: pairedComparisons(months, DEFAULT_SEED),
    perMachine: perMachineByYear(statewide, cpi, { B: 2000, seed: DEFAULT_SEED }),
  }
}

export function trendsView() {
  trendsCache ??= buildTrends()
  return trendsCache
}

function buildCouncils() {
  const rows = areaYears(lgaUnits)
  return {
    scale: yearToYearScale(rows),
    scaling: scalingCheck(rows),
    funnels: funnelYears(rows),
    persistent: persistentRatios(rows),
  }
}

export function councilsView() {
  councilsCache ??= buildCouncils()
  return councilsCache
}

function buildConcentration() {
  const variants = [
    concentrationVariant(manufacturers, false, { B: 1000, seed: DEFAULT_SEED }),
    concentrationVariant(manufacturers, true, { B: 1000, seed: DEFAULT_SEED }),
  ]
  return {
    variants,
    breaks: variants.map((v) => ({
      id: v.id,
      label: v.label,
      tau: monthFromIndex(v.breakpoint.tau.estimate),
      tauLower: monthFromIndex(v.breakpoint.tau.lower),
      tauUpper: monthFromIndex(v.breakpoint.tau.upper),
    })),
  }
}

export function concentrationView() {
  concentrationCache ??= buildConcentration()
  return concentrationCache
}

export { DEFAULT_SEED }
