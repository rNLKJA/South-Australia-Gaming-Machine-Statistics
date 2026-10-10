import { normalQuantile } from "./distributions"
import { quantile } from "./quantile"

/**
 * Funnel plots for a rate per unit of exposure (NGR per machine, exposure = machines), on the log
 * scale: an area's log rate ratio against the reference rate is treated as having variance c² / m
 * for m machines, so control limits are θ0 · exp(± z · c / √m). The scale c is estimated from
 * year-to-year variation within areas; optional over-dispersion follows Spiegelhalter (2005),
 * "Handling over-dispersion of performance indicators", Qual Saf Health Care 14: 347–351.
 */

export interface ExposureObservation {
  /** Grouping key (one area followed over several years). */
  group: string
  /** log(rate / reference rate) for the observation. */
  logRatio: number
  /** Exposure (machines). */
  exposure: number
}

export interface PooledScale {
  /** Pooled scale c: the year-to-year SD of the log ratio for one unit of exposure. */
  c: number
  /** Residual degrees of freedom, Σ (n_i − 1). */
  df: number
  /** Groups with two or more observations. */
  groups: number
}

/**
 * Pooled within-group scale. With Var(y_iy) = c² / m_iy and a group mean μ_i, the weighted sum
 * Σ_y m_iy (y_iy − ȳ_i)² / c² is χ² on n_i − 1 degrees of freedom, where ȳ_i is the exposure-
 * weighted mean, so c² = Σ_i Σ_y m_iy (y_iy − ȳ_i)² / Σ_i (n_i − 1).
 */
export function pooledWithinScale(obs: readonly ExposureObservation[]): PooledScale {
  const byGroup = new Map<string, ExposureObservation[]>()
  for (const o of obs) {
    const list = byGroup.get(o.group)
    if (list) list.push(o)
    else byGroup.set(o.group, [o])
  }
  let ss = 0
  let df = 0
  let groups = 0
  for (const list of byGroup.values()) {
    if (list.length < 2) continue
    const wsum = list.reduce((s, o) => s + o.exposure, 0)
    const mean = list.reduce((s, o) => s + o.exposure * o.logRatio, 0) / wsum
    ss += list.reduce((s, o) => s + o.exposure * (o.logRatio - mean) ** 2, 0)
    df += list.length - 1
    groups++
  }
  return { c: df > 0 ? Math.sqrt(ss / df) : NaN, df, groups }
}

export interface Overdispersion {
  /** Winsorised mean of squared z-scores (1 means no over-dispersion). */
  phi: number
  /** Additive between-area variance τ² on the log scale (0 if φ ≤ (N − 1) / N). */
  tau2: number
  n: number
  winsorProportion: number
}

/**
 * Spiegelhalter's additive random-effects estimate: z-scores against the reference, winsorised at
 * the `p` and 1 − `p` quantiles, φ = mean(z²), and
 * τ² = max(0, (Nφ − (N − 1)) / (Σw − Σw² / Σw)) with w_i = 1 / s_i² = m_i / c².
 */
export function overdispersion(
  logRatios: readonly number[],
  exposures: readonly number[],
  c: number,
  p = 0.1
): Overdispersion {
  const n = logRatios.length
  const z = logRatios.map((y, i) => (y * Math.sqrt(exposures[i])) / c)
  const lo = quantile(z, p)
  const hi = quantile(z, 1 - p)
  const zw = z.map((v) => Math.min(hi, Math.max(lo, v)))
  const phi = zw.reduce((s, v) => s + v * v, 0) / n
  const w = exposures.map((m) => m / (c * c))
  const sw = w.reduce((s, v) => s + v, 0)
  const sw2 = w.reduce((s, v) => s + v * v, 0)
  const tau2 = Math.max(0, (n * phi - (n - 1)) / (sw - sw2 / sw))
  return { phi, tau2, n, winsorProportion: p }
}

export type LimitKind = "noise" | "overdispersed"

export interface FunnelLimits {
  lower95: number
  upper95: number
  lower998: number
  upper998: number
}

/** Two-sided 95% and 99.8% limits for exposure m around the reference rate θ0. */
export function funnelLimits(theta0: number, m: number, c: number, tau2 = 0): FunnelLimits {
  const sd = Math.sqrt((c * c) / m + tau2)
  const z95 = normalQuantile(0.975)
  const z998 = normalQuantile(0.999)
  return {
    lower95: theta0 * Math.exp(-z95 * sd),
    upper95: theta0 * Math.exp(z95 * sd),
    lower998: theta0 * Math.exp(-z998 * sd),
    upper998: theta0 * Math.exp(z998 * sd),
  }
}

export type FunnelZone = "above998" | "above95" | "within" | "below95" | "below998"

export function funnelZone(rate: number, limits: FunnelLimits): FunnelZone {
  if (rate > limits.upper998) return "above998"
  if (rate > limits.upper95) return "above95"
  if (rate < limits.lower998) return "below998"
  if (rate < limits.lower95) return "below95"
  return "within"
}
