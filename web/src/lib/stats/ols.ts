import { tQuantile, tTestPValue } from "./distributions"
import type { Interval } from "./intervals"

/**
 * Ordinary least squares for small designs (a few dozen columns at most), with classical and
 * Newey–West (HAC) covariance matrices. Checked against statsmodels in stats.test.ts.
 */

export type Matrix = number[][]

/** Inverse of a symmetric positive-definite matrix by Gauss–Jordan elimination with pivoting. */
export function invert(a: Matrix): Matrix {
  const n = a.length
  const m = a.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))])
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let r = col + 1; r < n; r++) if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r
    if (Math.abs(m[pivot][col]) < 1e-12) throw new Error("singular design matrix")
    ;[m[col], m[pivot]] = [m[pivot], m[col]]
    const p = m[col][col]
    for (let j = 0; j < 2 * n; j++) m[col][j] /= p
    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const f = m[r][col]
      if (f === 0) continue
      for (let j = 0; j < 2 * n; j++) m[r][j] -= f * m[col][j]
    }
  }
  return m.map((row) => row.slice(n))
}

function crossProduct(x: Matrix): Matrix {
  const p = x[0].length
  const out = Array.from({ length: p }, () => new Array<number>(p).fill(0))
  for (const row of x) {
    for (let i = 0; i < p; i++) {
      const ri = row[i]
      if (ri === 0) continue
      for (let j = i; j < p; j++) out[i][j] += ri * row[j]
    }
  }
  for (let i = 0; i < p; i++) for (let j = 0; j < i; j++) out[i][j] = out[j][i]
  return out
}

function sandwich(bread: Matrix, meat: Matrix): Matrix {
  const p = bread.length
  const tmp = bread.map((row) =>
    Array.from({ length: p }, (_, j) => row.reduce((s, v, k) => s + v * meat[k][j], 0))
  )
  return tmp.map((row) =>
    Array.from({ length: p }, (_, j) => row.reduce((s, v, k) => s + v * bread[k][j], 0))
  )
}

export interface OlsFit {
  names: string[]
  n: number
  p: number
  coef: number[]
  fitted: number[]
  residuals: number[]
  /** Residual degrees of freedom, n − p. */
  df: number
  /** (X'X)^-1. */
  xtxInv: Matrix
  /** Classical covariance σ²(X'X)^-1 with σ² = RSS / (n − p). */
  covClassical: Matrix
  rss: number
  r2: number
}

export function ols(x: Matrix, y: readonly number[], names?: string[]): OlsFit {
  const n = x.length
  const p = x[0]?.length ?? 0
  if (n !== y.length) throw new RangeError("x and y must have the same number of rows")
  if (n <= p) throw new RangeError("need more observations than columns")
  const xtxInv = invert(crossProduct(x))
  const xty = new Array<number>(p).fill(0)
  for (let i = 0; i < n; i++) for (let j = 0; j < p; j++) xty[j] += x[i][j] * y[i]
  const coef = xtxInv.map((row) => row.reduce((s, v, k) => s + v * xty[k], 0))
  const fitted = x.map((row) => row.reduce((s, v, k) => s + v * coef[k], 0))
  const residuals = y.map((v, i) => v - fitted[i])
  const rss = residuals.reduce((s, e) => s + e * e, 0)
  const ybar = y.reduce((s, v) => s + v, 0) / n
  const tss = y.reduce((s, v) => s + (v - ybar) ** 2, 0)
  const sigma2 = rss / (n - p)
  return {
    names: names ?? Array.from({ length: p }, (_, j) => `x${j}`),
    n,
    p,
    coef,
    fitted,
    residuals,
    df: n - p,
    xtxInv,
    covClassical: xtxInv.map((row) => row.map((v) => v * sigma2)),
    rss,
    r2: tss > 0 ? 1 - rss / tss : NaN,
  }
}

/** Newey and West's (1994) rule-of-thumb lag, floor(4 (n / 100)^(2/9)). */
export function neweyWestLag(n: number): number {
  return Math.floor(4 * (n / 100) ** (2 / 9))
}

/**
 * Newey–West heteroskedasticity- and autocorrelation-consistent covariance with Bartlett weights
 * 1 − l / (L + 1), without a small-sample adjustment. Equals statsmodels
 * `cov_type="HAC", cov_kwds={"maxlags": L, "use_correction": False}` and R
 * `sandwich::NeweyWest(fit, lag = L, prewhite = FALSE, adjust = FALSE)`.
 */
export function neweyWestCovariance(fit: OlsFit, x: Matrix, lag: number): Matrix {
  const p = fit.p
  const e = fit.residuals
  const meat = Array.from({ length: p }, () => new Array<number>(p).fill(0))
  const scores = x.map((row, t) => row.map((v) => v * e[t]))
  for (let l = 0; l <= lag; l++) {
    const w = l === 0 ? 1 : 1 - l / (lag + 1)
    for (let t = l; t < scores.length; t++) {
      const a = scores[t]
      const b = scores[t - l]
      for (let i = 0; i < p; i++) {
        for (let j = 0; j < p; j++) {
          const v = a[i] * b[j]
          meat[i][j] += l === 0 ? v : w * (v + b[i] * a[j])
        }
      }
    }
  }
  return sandwich(fit.xtxInv, meat)
}

export interface Estimate extends Interval {
  se: number
  t: number
  p: number
  df: number
}

/**
 * A linear combination c'β with its standard error from a covariance matrix and a t interval on
 * the residual degrees of freedom.
 */
export function linearCombination(
  fit: OlsFit,
  cov: Matrix,
  c: readonly number[],
  confidence = 0.95
): Estimate {
  const est = c.reduce((s, v, j) => s + v * fit.coef[j], 0)
  let v = 0
  for (let i = 0; i < c.length; i++) for (let j = 0; j < c.length; j++) v += c[i] * cov[i][j] * c[j]
  const se = Math.sqrt(Math.max(0, v))
  const q = tQuantile(1 - (1 - confidence) / 2, fit.df)
  const t = est / se
  return {
    estimate: est,
    lower: est - q * se,
    upper: est + q * se,
    se,
    t,
    p: tTestPValue(t, fit.df),
    df: fit.df,
  }
}

/** One coefficient by name. */
export function coefficient(fit: OlsFit, cov: Matrix, name: string, confidence = 0.95): Estimate {
  const j = fit.names.indexOf(name)
  if (j < 0) throw new RangeError(`no coefficient named ${name}`)
  return linearCombination(
    fit,
    cov,
    fit.coef.map((_, k) => (k === j ? 1 : 0)),
    confidence
  )
}

/** Lag-1 autocorrelation of a series (residuals), the usual ACF estimator. */
export function lag1Autocorrelation(xs: readonly number[]): number {
  const n = xs.length
  const m = xs.reduce((s, v) => s + v, 0) / n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    den += (xs[i] - m) ** 2
    if (i > 0) num += (xs[i] - m) * (xs[i - 1] - m)
  }
  return den > 0 ? num / den : NaN
}

/** Durbin–Watson statistic of residuals. */
export function durbinWatson(e: readonly number[]): number {
  let num = 0
  let den = 0
  for (let i = 0; i < e.length; i++) {
    den += e[i] * e[i]
    if (i > 0) num += (e[i] - e[i - 1]) ** 2
  }
  return num / den
}
