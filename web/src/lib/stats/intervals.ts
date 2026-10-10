import { normalQuantile, tQuantile } from "./distributions"

export interface Interval {
  estimate: number
  lower: number
  upper: number
}

/**
 * Wilson score interval for a binomial proportion (no continuity correction). Matches statsmodels
 * `proportion_confint(method="wilson")` and R `prop.test(correct = FALSE)`.
 */
export function wilsonInterval(successes: number, n: number, confidence = 0.95): Interval {
  if (n <= 0) return { estimate: NaN, lower: 0, upper: 1 }
  if (successes < 0 || successes > n) throw new RangeError("successes must lie in [0, n]")
  const z = normalQuantile(1 - (1 - confidence) / 2)
  const p = successes / n
  const z2 = z * z
  const denom = 1 + z2 / n
  const centre = (p + z2 / (2 * n)) / denom
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom
  return { estimate: p, lower: Math.max(0, centre - half), upper: Math.min(1, centre + half) }
}

export interface MeanInterval extends Interval {
  n: number
  sd: number
  se: number
  df: number
}

/** Sample mean with a Student t interval (scipy `stats.t.interval(conf, n-1, mean, sem)`). */
export function tInterval(xs: readonly number[], confidence = 0.95): MeanInterval {
  const n = xs.length
  if (n < 2) {
    const m = n ? xs[0] : NaN
    return { estimate: m, lower: NaN, upper: NaN, n, sd: NaN, se: NaN, df: n - 1 }
  }
  const m = xs.reduce((s, x) => s + x, 0) / n
  const sd = Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (n - 1))
  const se = sd / Math.sqrt(n)
  const q = tQuantile(1 - (1 - confidence) / 2, n - 1)
  return { estimate: m, lower: m - q * se, upper: m + q * se, n, sd, se, df: n - 1 }
}
