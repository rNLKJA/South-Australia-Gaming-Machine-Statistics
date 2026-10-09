import { LGA_FYS, LGA_NO_MACHINES_FY } from "../lga"
import {
  funnelLimits,
  funnelZone,
  overdispersion,
  pooledWithinScale,
  type FunnelZone,
  type Overdispersion,
  type PooledScale,
} from "../stats/funnel"
import { tInterval, wilsonInterval, type Interval } from "../stats/intervals"
import { ols, type OlsFit } from "../stats/ols"
import { tQuantile } from "../stats/distributions"
import type { FY, LgaUnit, LgaUnitKind } from "../types"

/**
 * Council-level NGR per machine, read with its uncertainty. An area's rate is compared with the
 * state rate of the same year (rate ratio), which removes inflation, COVID-19 and every other
 * statewide movement; what is left is the area's own deviation plus year-to-year noise. Combined
 * CBS groups stay whole: each published composition is one unit.
 */

/** Years with machine counts (FY 2019/20 was published without them). */
export const FUNNEL_FYS: FY[] = LGA_FYS.filter((fy) => fy !== LGA_NO_MACHINES_FY)

export interface AreaYear {
  id: string
  label: string
  kind: LgaUnitKind
  fy: FY
  machines: number
  ngr: number
  /** NGR per machine, $. */
  rate: number
  /** State NGR per machine that year, $. */
  stateRate: number
  /** log(rate / state rate). */
  logRatio: number
}

export function areaYears(units: readonly LgaUnit[]): AreaYear[] {
  const usable = units.filter((u) => FUNNEL_FYS.includes(u.fy) && (u.machines ?? 0) > 0)
  const state = new Map<FY, number>()
  for (const fy of FUNNEL_FYS) {
    const us = usable.filter((u) => u.fy === fy)
    state.set(fy, us.reduce((s, u) => s + u.ngr, 0) / us.reduce((s, u) => s + (u.machines ?? 0), 0))
  }
  return usable.map((u) => {
    const machines = u.machines as number
    const rate = u.ngr / machines
    const stateRate = state.get(u.fy)!
    return {
      id: u.id,
      label: u.label,
      kind: u.kind,
      fy: u.fy,
      machines,
      ngr: u.ngr,
      rate,
      stateRate,
      logRatio: Math.log(rate / stateRate),
    }
  })
}

export function yearToYearScale(rows: readonly AreaYear[]): PooledScale {
  return pooledWithinScale(
    rows.map((r) => ({ group: r.id, logRatio: r.logRatio, exposure: r.machines }))
  )
}

export interface ScalingCheck {
  /** Areas with at least four years. */
  n: number
  /** Slope of log(SD of the log rate ratio across years) on log(mean machines). */
  slope: Interval & { se: number }
  /** The slope the funnel's variance model assumes. */
  assumed: number
}

/**
 * Does year-to-year variation shrink like 1 / √machines, as the funnel assumes? Regress the log of
 * each area's SD of log rate ratios on the log of its mean machine count; the model predicts a
 * slope of −0.5.
 */
export function scalingCheck(rows: readonly AreaYear[], minYears = 4): ScalingCheck {
  const byId = groupRows(rows)
  const pts: { x: number; y: number }[] = []
  for (const list of byId.values()) {
    if (list.length < minYears) continue
    const ci = tInterval(list.map((r) => r.logRatio))
    const meanMachines = list.reduce((s, r) => s + r.machines, 0) / list.length
    if (ci.sd > 0) pts.push({ x: Math.log(meanMachines), y: Math.log(ci.sd) })
  }
  const fit: OlsFit = ols(
    pts.map((p) => [1, p.x]),
    pts.map((p) => p.y),
    ["const", "logMachines"]
  )
  const se = Math.sqrt(fit.covClassical[1][1])
  const q = tQuantile(0.975, fit.df)
  return {
    n: pts.length,
    slope: { estimate: fit.coef[1], lower: fit.coef[1] - q * se, upper: fit.coef[1] + q * se, se },
    assumed: -0.5,
  }
}

function groupRows(rows: readonly AreaYear[]): Map<string, AreaYear[]> {
  const out = new Map<string, AreaYear[]>()
  for (const r of rows) out.set(r.id, [...(out.get(r.id) ?? []), r])
  return out
}

export interface FunnelPoint {
  id: string
  label: string
  kind: LgaUnitKind
  machines: number
  rate: number
  ratio: number
  zone: Record<"noise" | "overdispersed", FunnelZone>
}

export interface ZoneCount {
  zone: FunnelZone
  count: number
}

export interface FunnelYear {
  fy: FY
  stateRate: number
  c: number
  overdispersion: Overdispersion
  points: FunnelPoint[]
  /** Limit curves sampled on a log grid of machine counts, for drawing. */
  curves: {
    machines: number
    noise: ReturnType<typeof funnelLimits>
    overdispersed: ReturnType<typeof funnelLimits>
  }[]
  /** Areas outside the 95% limits under year-to-year noise alone, with a Wilson interval. */
  outside95: Interval & { count: number; n: number }
  outside95Overdispersed: Interval & { count: number; n: number }
  zones: Record<"noise" | "overdispersed", ZoneCount[]>
}

const ZONES: FunnelZone[] = ["above998", "above95", "within", "below95", "below998"]

export function funnelYears(rows: readonly AreaYear[]): FunnelYear[] {
  const { c } = yearToYearScale(rows)
  return FUNNEL_FYS.map((fy) => {
    const ys = rows.filter((r) => r.fy === fy)
    const stateRate = ys[0].stateRate
    const od = overdispersion(
      ys.map((r) => r.logRatio),
      ys.map((r) => r.machines),
      c
    )
    const points: FunnelPoint[] = ys
      .map((r) => ({
        id: r.id,
        label: r.label,
        kind: r.kind,
        machines: r.machines,
        rate: r.rate,
        ratio: r.rate / stateRate,
        zone: {
          noise: funnelZone(r.rate, funnelLimits(stateRate, r.machines, c)),
          overdispersed: funnelZone(r.rate, funnelLimits(stateRate, r.machines, c, od.tau2)),
        },
      }))
      .sort((a, b) => a.machines - b.machines)
    const grid = Array.from({ length: 61 }, (_, i) => Math.round(10 * 10 ** (i * (2.2 / 60))))
    const curves = [...new Set(grid)].map((m) => ({
      machines: m,
      noise: funnelLimits(stateRate, m, c),
      overdispersed: funnelLimits(stateRate, m, c, od.tau2),
    }))
    const outside = (k: "noise" | "overdispersed") => {
      const count = points.filter((p) => p.zone[k] !== "within").length
      return { ...wilsonInterval(count, points.length), count, n: points.length }
    }
    const zones = (k: "noise" | "overdispersed") =>
      ZONES.map((zone) => ({ zone, count: points.filter((p) => p.zone[k] === zone).length }))
    return {
      fy,
      stateRate,
      c,
      overdispersion: od,
      points,
      curves,
      outside95: outside("noise"),
      outside95Overdispersed: outside("overdispersed"),
      zones: { noise: zones("noise"), overdispersed: zones("overdispersed") },
    }
  })
}

export interface PersistentRatio {
  id: string
  label: string
  kind: LgaUnitKind
  years: number
  firstFy: FY
  lastFy: FY
  meanMachines: number
  /** Geometric mean of rate / state rate across years, with a t interval on the log scale. */
  ratio: Interval
  /** Whether the interval excludes 1 (consistently above or below the state rate). */
  direction: "above" | "below" | "unclear"
}

/** Each area's typical NGR per machine relative to the state, with its year-to-year uncertainty. */
export function persistentRatios(rows: readonly AreaYear[], minYears = 3): PersistentRatio[] {
  const out: PersistentRatio[] = []
  for (const [id, list] of groupRows(rows)) {
    if (list.length < minYears) continue
    const sorted = [...list].sort((a, b) => a.fy.localeCompare(b.fy))
    const ci = tInterval(sorted.map((r) => r.logRatio))
    const ratio = {
      estimate: Math.exp(ci.estimate),
      lower: Math.exp(ci.lower),
      upper: Math.exp(ci.upper),
    }
    out.push({
      id,
      label: sorted.at(-1)!.label,
      kind: sorted.at(-1)!.kind,
      years: sorted.length,
      firstFy: sorted[0].fy,
      lastFy: sorted.at(-1)!.fy,
      meanMachines: sorted.reduce((s, r) => s + r.machines, 0) / sorted.length,
      ratio,
      direction: ratio.lower > 1 ? "above" : ratio.upper < 1 ? "below" : "unclear",
    })
  }
  return out.sort((a, b) => b.ratio.estimate - a.ratio.estimate)
}
