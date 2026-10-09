/**
 * Serial dependence: how strongly neighbouring observations move together, and what that does to
 * resampling and standard errors.
 */

export interface BlockLength {
  /** Optimal expected block length for the stationary bootstrap. */
  stationary: number
  /** Optimal block length for the circular (and, to first order, the moving) block bootstrap. */
  circular: number
  /** The bandwidth M chosen for the flat-top lag window. */
  bandwidth: number
}

/**
 * Automatic block length of Politis and White (2004), with the correction of Patton, Politis and
 * White (2009). A line-by-line port of `arch.bootstrap.optimal_block_length` (Python `arch`), which
 * the tests check against. The bandwidth is twice the first lag after which `kn` successive
 * autocorrelations are all insignificant (|ρ| < 2·√(log10 n / n)); the long-run variance and its
 * derivative are then estimated with a flat-top window, and the block length is capped at
 * min(3√n, n/3).
 */
export function optimalBlockLength(xs: readonly number[]): BlockLength {
  const n = xs.length
  if (n < 9) throw new RangeError("series too short for an automatic block length")
  const mean = xs.reduce((s, v) => s + v, 0) / n
  const eps = xs.map((v) => v - mean)
  const bMax = Math.ceil(Math.min(3 * Math.sqrt(n), n / 3))
  const kn = Math.max(5, Math.trunc(Math.log10(n)))
  const mMax = Math.ceil(Math.sqrt(n)) + kn
  const cv = 2 * Math.sqrt(Math.log10(n) / n)
  const acv = new Array<number>(mMax + 1).fill(0)
  const absAcorr = new Array<number>(mMax + 1).fill(0)
  let optM: number | null = null
  const dot = (a0: number, b0: number, len: number) => {
    let s = 0
    for (let k = 0; k < len; k++) s += eps[a0 + k] * eps[b0 + k]
    return s
  }
  for (let i = 0; i <= mMax; i++) {
    // as arch: v1 = eps[i+1:]·eps[i+1:], v2 = eps[:-(i+1)]·eps[:-(i+1)], cross = eps[i:]·eps[:n-i]
    const len = n - (i + 1)
    const v1 = dot(i + 1, i + 1, len)
    const v2 = dot(0, 0, len)
    const cross = dot(i, 0, n - i)
    acv[i] = cross / n
    absAcorr[i] = Math.abs(cross) / Math.sqrt(v1 * v2)
    if (i >= kn && optM === null) {
      let allSmall = true
      for (let k = i - kn; k < i; k++) if (!(absAcorr[k] < cv)) allSmall = false
      if (allSmall) optM = i - kn
    }
  }
  let m = optM !== null ? 2 * Math.max(optM, 1) : mMax
  m = Math.min(m, mMax)
  let g = 0
  let lrAcv = acv[0]
  for (let k = 1; k <= m; k++) {
    const lam = k / m <= 1 / 2 ? 1 : 2 * (1 - k / m)
    g += 2 * lam * k * acv[k]
    lrAcv += 2 * lam * acv[k]
  }
  const dSb = 2 * lrAcv ** 2
  const dCb = (4 / 3) * lrAcv ** 2
  const cube = (x: number) => Math.cbrt(x)
  const bSb = cube((2 * g ** 2) / dSb) * cube(n)
  const bCb = cube((2 * g ** 2) / dCb) * cube(n)
  return { stationary: Math.min(bSb, bMax), circular: Math.min(bCb, bMax), bandwidth: m }
}

/** Sample autocorrelation at `lag` (the same estimator as statsmodels `acf`, denominator n). */
export function autocorrelation(xs: readonly number[], lag: number): number {
  const n = xs.length
  const m = xs.reduce((s, v) => s + v, 0) / n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    den += (xs[i] - m) ** 2
    if (i >= lag) num += (xs[i] - m) * (xs[i - lag] - m)
  }
  return den > 0 ? num / den : NaN
}

/**
 * Pooled within-group lag-1 autocorrelation: each group's series is centred on its own mean, and
 * the lag-1 cross-products and the squares are summed over all groups before dividing. A null marks
 * a missing period: it breaks the series, so no pair spans it. Groups with fewer than two values add
 * nothing. On short series the estimate is biased towards zero (by about −(1 + 3ρ)/T), so it
 * understates the dependence rather than overstating it.
 */
export function pooledLag1Autocorrelation(groups: readonly (readonly (number | null)[])[]): {
  rho: number
  pairs: number
  groups: number
} {
  let num = 0
  let den = 0
  let pairs = 0
  let used = 0
  for (const g of groups) {
    const vals = g.filter((v): v is number => v !== null)
    if (vals.length < 2) continue
    used++
    const m = vals.reduce((s, v) => s + v, 0) / vals.length
    for (let i = 0; i < g.length; i++) {
      const x = g[i]
      if (x === null) continue
      den += (x - m) ** 2
      const prev = i > 0 ? g[i - 1] : null
      if (prev !== null) {
        num += (x - m) * (prev - m)
        pairs++
      }
    }
  }
  return { rho: den > 0 ? num / den : NaN, pairs, groups: used }
}

/**
 * How much an AR(1) process with lag-1 autocorrelation ρ inflates the standard error of a mean,
 * against independent observations: √((1 + ρ) / (1 − ρ)) (the large-sample factor; it is a little
 * conservative for short series). Negative ρ is treated as 0, so the adjustment never narrows an
 * interval.
 */
export function ar1SeInflation(rho: number): number {
  const r = Math.min(Math.max(rho, 0), 0.99)
  return Math.sqrt((1 + r) / (1 - r))
}
