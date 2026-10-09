import { realTermsFactor } from "../cpi"
import { fyRange, monthsOfFy } from "../fy"
import { bootstrapRatio, type BootstrapResult } from "../stats/bootstrap"
import {
  coefficient,
  durbinWatson,
  lag1Autocorrelation,
  linearCombination,
  neweyWestCovariance,
  neweyWestLag,
  ols,
  type Estimate,
} from "../stats/ols"
import { pairedSummary, type PairedSummary } from "../stats/paired"
import { DEFAULT_SEED } from "../stats/rng"
import { stl, stlStrength } from "../stats/stl"
import { COVID_FY, STATEWIDE_FIRST_FY, STATEWIDE_LAST_FY, STATEWIDE_MISSING_FY } from "../statewide"
import type { CpiPoint, FY, Month, StatewideMonth } from "../types"

/**
 * Trend analysis of statewide NGR: an STL decomposition, an interrupted time series around the
 * 2020 venue closures, paired year-on-year comparisons and annual NGR per machine with bootstrap
 * intervals. Every function is pure; the Analysis pages pass in the data and CPI series.
 */

export const BASE_FY: FY = STATEWIDE_LAST_FY
/** Venues closed from late March 2020 and reopened at the end of June 2020. */
export const CLOSURE_MONTHS: Month[] = ["2020-03", "2020-04", "2020-05", "2020-06"]
export const REOPENING: Month = "2020-07"
/** Short South Australian lockdowns after reopening (a few days each). */
export const LOCKDOWN_MONTHS: Month[] = ["2020-11", "2021-07"]
/** The statewide series restarts after the missing FY 2014/15 here. */
export const SEGMENT_STARTS: Month[] = ["2009-07", "2015-07"]

export interface RealMonth {
  month: Month
  fy: FY
  /** NGR, $ million in average FY 2024/25 dollars. */
  ngrReal: number
  ngrNominal: number
  machines: number
  /** Real NGR per machine for the month, $ (null when no machines were reported). */
  perMachineReal: number | null
}

export function realMonths(rows: readonly StatewideMonth[], cpi: readonly CpiPoint[]): RealMonth[] {
  return [...rows]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((r) => {
      const f = realTermsFactor([...cpi], r.month, BASE_FY)
      if (f == null) throw new Error(`no CPI for ${r.month}`)
      return {
        month: r.month,
        fy: r.fy,
        ngrReal: r.ngr * f,
        ngrNominal: r.ngr,
        machines: r.machines,
        perMachineReal: r.machines > 0 ? (r.ngr * 1e6 * f) / r.machines : null,
      }
    })
}

/* ------------------------------------------------------------------------------------------ */
/* STL                                                                                        */
/* ------------------------------------------------------------------------------------------ */

export const STL_SETTINGS = { period: 12, sWindow: 13, robust: true } as const

export interface StlPoint {
  month: Month
  observed: number
  trend: number
  seasonal: number
  remainder: number
  weight: number
}

export interface StlSegment {
  from: Month
  to: Month
  points: StlPoint[]
  /** Strength of trend and seasonality, leaving out the closure months. */
  strength: { trend: number; seasonal: number; n: number }
  /** Months the robust fit gave a weight below 0.5 (treated as unusual). */
  lowWeight: Month[]
  /** Mean seasonal effect for each calendar month (Jan = index 0), $ million. */
  seasonalProfile: number[]
  params: { sWindow: number; tWindow: number; lWindow: number; inner: number; outer: number }
}

/** Contiguous runs of months (the FY 2014/15 gap splits the series in two). */
export function contiguousSegments(months: readonly RealMonth[]): RealMonth[][] {
  const out: RealMonth[][] = []
  for (const m of months) {
    const last = out.at(-1)?.at(-1)
    if (last && nextMonth(last.month) === m.month) out.at(-1)!.push(m)
    else out.push([m])
  }
  return out
}

export function nextMonth(month: Month): Month {
  const [y, m] = month.split("-").map(Number)
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`
}

export function stlSegments(months: readonly RealMonth[]): StlSegment[] {
  return contiguousSegments(months).map((seg) => {
    const r = stl(
      seg.map((m) => m.ngrReal),
      STL_SETTINGS
    )
    const points = seg.map((m, i) => ({
      month: m.month,
      observed: m.ngrReal,
      trend: r.trend[i],
      seasonal: r.seasonal[i],
      remainder: r.remainder[i],
      weight: r.weights[i],
    }))
    const profile = Array.from({ length: 12 }, (_, k) => {
      const vals = points.filter((p) => Number(p.month.slice(5)) === k + 1).map((p) => p.seasonal)
      return vals.reduce((s, v) => s + v, 0) / vals.length
    })
    return {
      from: seg[0].month,
      to: seg.at(-1)!.month,
      points,
      strength: stlStrength(r, (i) => !CLOSURE_MONTHS.includes(seg[i].month)),
      lowWeight: points.filter((p) => p.weight < 0.5).map((p) => p.month),
      seasonalProfile: profile,
      params: {
        sWindow: r.params.sWindow,
        tWindow: r.params.tWindow,
        lWindow: r.params.lWindow,
        inner: r.params.inner,
        outer: r.params.outer,
      },
    }
  })
}

/* ------------------------------------------------------------------------------------------ */
/* Interrupted time series                                                                    */
/* ------------------------------------------------------------------------------------------ */

export type ItsOutcome = "ngrReal" | "ngrNominal" | "perMachineReal"

export interface ItsSpec {
  id: string
  label: string
  outcome: ItsOutcome
  /** Months left out on top of the closure months. */
  exclude: Month[]
  note: string
}

export const ITS_SPECS: ItsSpec[] = [
  {
    id: "primary",
    label: "Real NGR (primary)",
    outcome: "ngrReal",
    exclude: [],
    note: "Monthly NGR in FY 2024/25 dollars, July 2015 to June 2025, closure months left out.",
  },
  {
    id: "nominal",
    label: "Nominal NGR",
    outcome: "ngrNominal",
    exclude: [],
    note: "The same model without the CPI adjustment, so post-2020 inflation stays in the trend.",
  },
  {
    id: "lockdowns",
    label: "Real NGR, short lockdowns left out",
    outcome: "ngrReal",
    exclude: LOCKDOWN_MONTHS,
    note: "Also leaves out November 2020 and July 2021, which had short statewide lockdowns.",
  },
  {
    id: "per-machine",
    label: "Real NGR per machine",
    outcome: "perMachineReal",
    exclude: [],
    note: "Monthly NGR per machine in FY 2024/25 dollars, so the smaller post-2020 fleet is allowed for.",
  },
]

export interface ItsResult {
  spec: ItsSpec
  n: number
  nPre: number
  nPost: number
  lag: number
  /** Immediate change in level at reopening (July 2020). */
  level: Estimate
  /** Change in the monthly trend after reopening, per year (12 × monthly slope change). */
  slopePerYear: Estimate
  /** Pre-closure trend per year. */
  preTrendPerYear: Estimate
  /** Observed-minus-counterfactual gap in June 2025. */
  gapAtEnd: Estimate
  /** Counterfactual (pre-closure trend carried forward) for June 2025. */
  counterfactualAtEnd: number
  residualAcf1: number
  durbinWatson: number
  r2: number
  /** Unit of the outcome: "$m" per month, or "$" per machine per month. */
  unit: "$m" | "$"
  series: {
    month: Month
    observed: number | null
    fitted: number | null
    counterfactual: number | null
    excluded: boolean
  }[]
}

const MONTH_DUMMIES = ["01", "02", "03", "04", "05", "06", "08", "09", "10", "11", "12"]

/**
 * Segmented regression: y_t = β0 + β1·time + β2·post + β3·since + month-of-year effects + e_t,
 * with July as the reference month, time in months from July 2015, post = 1 from July 2020 and
 * since = months since July 2020 (0 in July 2020). Standard errors are Newey–West with the
 * rule-of-thumb lag; intervals use t on n − p degrees of freedom.
 */
export function interruptedTimeSeries(months: readonly RealMonth[], spec: ItsSpec): ItsResult {
  const start = SEGMENT_STARTS[1]
  const window = months.filter((m) => m.month >= start)
  const months0 = window.map((m) => m.month)
  const timeOf = (m: Month) => months0.indexOf(m)
  const t0 = timeOf(REOPENING)
  const excluded = new Set([...CLOSURE_MONTHS, ...spec.exclude])
  const used = window.filter(
    (m) => !excluded.has(m.month) && m[spec.outcome] != null && Number.isFinite(m[spec.outcome])
  )
  const design = (m: Month, counterfactual = false) => {
    const t = timeOf(m)
    const post = !counterfactual && t >= t0 ? 1 : 0
    const since = post ? t - t0 : 0
    const mm = m.slice(5)
    return [1, t, post, since, ...MONTH_DUMMIES.map((d) => (mm === d ? 1 : 0))]
  }
  const names = ["const", "time", "post", "since", ...MONTH_DUMMIES.map((d) => `m${d}`)]
  const x = used.map((m) => design(m.month))
  const y = used.map((m) => m[spec.outcome] as number)
  const fit = ols(x, y, names)
  const lag = neweyWestLag(used.length)
  const cov = neweyWestCovariance(fit, x, lag)
  const p = names.length
  const unitVec = (j: number, scale = 1) =>
    Array.from({ length: p }, (_, k) => (k === j ? scale : 0))
  const endMonth = months0.at(-1)!
  const endSince = timeOf(endMonth) - t0
  const gapVec = Array.from({ length: p }, (_, k) => (k === 2 ? 1 : k === 3 ? endSince : 0))
  const predict = (row: number[]) => row.reduce((s, v, k) => s + v * fit.coef[k], 0)
  return {
    spec,
    n: used.length,
    nPre: used.filter((m) => m.month < REOPENING).length,
    nPost: used.filter((m) => m.month >= REOPENING).length,
    lag,
    level: coefficient(fit, cov, "post"),
    slopePerYear: linearCombination(fit, cov, unitVec(3, 12)),
    preTrendPerYear: linearCombination(fit, cov, unitVec(1, 12)),
    gapAtEnd: linearCombination(fit, cov, gapVec),
    counterfactualAtEnd: predict(design(endMonth, true)),
    residualAcf1: lag1Autocorrelation(fit.residuals),
    durbinWatson: durbinWatson(fit.residuals),
    r2: fit.r2,
    unit: spec.outcome === "perMachineReal" ? "$" : "$m",
    series: window.map((m) => {
      const isExcluded = excluded.has(m.month)
      const obs = m[spec.outcome]
      return {
        month: m.month,
        observed: obs ?? null,
        fitted: isExcluded ? null : predict(design(m.month)),
        counterfactual: m.month >= REOPENING ? predict(design(m.month, true)) : null,
        excluded: isExcluded,
      }
    }),
  }
}

/* ------------------------------------------------------------------------------------------ */
/* Paired before/after comparisons                                                            */
/* ------------------------------------------------------------------------------------------ */

export interface PairedComparison {
  id: string
  label: string
  before: FY
  after: FY
  measure: "ngrReal" | "perMachineReal"
  unit: "$m" | "$"
  summary: PairedSummary
  beforeMean: number
  afterMean: number
}

const PAIRS: Omit<PairedComparison, "summary" | "beforeMean" | "afterMean">[] = [
  {
    id: "ngr-first-year",
    label: "Real NGR: first full year after reopening against the last full year before COVID-19",
    before: "2018-19",
    after: "2020-21",
    measure: "ngrReal",
    unit: "$m",
  },
  {
    id: "ngr-latest",
    label: "Real NGR: FY 2024/25 against FY 2018/19",
    before: "2018-19",
    after: "2024-25",
    measure: "ngrReal",
    unit: "$m",
  },
  {
    id: "per-machine-latest",
    label: "Real NGR per machine: FY 2024/25 against FY 2018/19",
    before: "2018-19",
    after: "2024-25",
    measure: "perMachineReal",
    unit: "$",
  },
]

/** Each calendar month of one year paired with the same month of another (n = 12). */
export function pairedComparisons(
  months: readonly RealMonth[],
  seed = DEFAULT_SEED
): PairedComparison[] {
  const byMonth = new Map(months.map((m) => [m.month, m]))
  return PAIRS.map((p) => {
    const b = monthsOfFy(p.before).map((m) => byMonth.get(m)!)
    const a = monthsOfFy(p.after).map((m) => byMonth.get(m)!)
    const bv = b.map((m) => m[p.measure] as number)
    const av = a.map((m) => m[p.measure] as number)
    return {
      ...p,
      summary: pairedSummary(bv, av, { B: 4000, seed }),
      beforeMean: bv.reduce((s, v) => s + v, 0) / bv.length,
      afterMean: av.reduce((s, v) => s + v, 0) / av.length,
    }
  })
}

/* ------------------------------------------------------------------------------------------ */
/* NGR per machine by financial year                                                          */
/* ------------------------------------------------------------------------------------------ */

export interface PerMachineYear {
  fy: FY
  months: number
  /** Annual NGR per machine, $ (12 × Σ NGR / Σ machines over the year's months). */
  nominal: BootstrapResult | null
  real: BootstrapResult | null
  note: string | null
}

/**
 * Annual NGR per machine with a percentile bootstrap over the year's months. The point estimate is
 * the Statewide page's figure (annual NGR over the mean monthly machine count); resampling months
 * shows how much it depends on month-to-month variation. The data are a census, so the interval is
 * about stability across months, not sampling error.
 */
export function perMachineByYear(
  rows: readonly StatewideMonth[],
  cpi: readonly CpiPoint[],
  { B = 2000, seed = DEFAULT_SEED }: { B?: number; seed?: number } = {}
): PerMachineYear[] {
  const byFy = new Map<FY, StatewideMonth[]>()
  for (const r of rows) byFy.set(r.fy, [...(byFy.get(r.fy) ?? []), r])
  return fyRange(STATEWIDE_FIRST_FY, STATEWIDE_LAST_FY).map((fy) => {
    const rs = (byFy.get(fy) ?? []).sort((a, b) => a.month.localeCompare(b.month))
    if (fy === STATEWIDE_MISSING_FY || rs.length === 0)
      return { fy, months: 0, nominal: null, real: null, note: "No statewide release archived" }
    if (fy === COVID_FY || rs.some((r) => r.machines === 0))
      return {
        fy,
        months: rs.length,
        nominal: null,
        real: null,
        note: "Not computed: NGR recorded against zero machines (COVID-19 closures)",
      }
    // annual NGR ($m × 1e6) over the mean machine count = n × 1e6 × Σ NGR / Σ machines
    const scale = rs.length * 1e6
    const den = rs.map((r) => r.machines)
    const nominal = bootstrapRatio(
      rs.map((r) => r.ngr),
      den,
      scale,
      { B, seed }
    )
    const real = bootstrapRatio(
      rs.map((r) => r.ngr * (realTermsFactor([...cpi], r.month, BASE_FY) ?? NaN)),
      den,
      scale,
      { B, seed }
    )
    return { fy, months: rs.length, nominal, real, note: null }
  })
}
