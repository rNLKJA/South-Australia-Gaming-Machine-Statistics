/**
 * STL: seasonal-trend decomposition by LOESS (Cleveland, Cleveland, McRae and Terpenning, 1990).
 *
 * A line-by-line port of the Fortran routines R's `stats::stl()` calls (stl.f: stl, stlstp, stlss,
 * stlfts, stlma, stless, stlest, stlrwt), so the same parameters give the same components.
 * stats.test.ts checks it against R 4.x on two series (scripts/stl_reference.R), with and without
 * robustness iterations. Positions inside the routines are 1-based, as in the Fortran.
 */

export interface StlOptions {
  /** Seasonal period (12 for monthly data). */
  period: number
  /** Seasonal smoothing window (odd, at least 7 recommended). */
  sWindow: number
  sDegree?: 0 | 1
  /** Trend window; defaults to R's nextodd(ceiling(1.5 period / (1 − 1.5 / sWindow))). */
  tWindow?: number
  tDegree?: 0 | 1
  /** Low-pass window; defaults to nextodd(period). */
  lWindow?: number
  lDegree?: 0 | 1
  sJump?: number
  tJump?: number
  lJump?: number
  /** Robustness iterations (bisquare weights from the remainder), as `robust = TRUE` in R. */
  robust?: boolean
  inner?: number
  outer?: number
}

export interface StlResult {
  seasonal: number[]
  trend: number[]
  remainder: number[]
  /** Final robustness weights (all 1 without robustness iterations). */
  weights: number[]
  /** The parameters actually used, after R's defaults and odd-number rules. */
  params: {
    period: number
    sWindow: number
    tWindow: number
    lWindow: number
    sDegree: number
    tDegree: number
    lDegree: number
    inner: number
    outer: number
    robust: boolean
  }
}

/** R's nextodd(): round, then add one if even. */
export function nextOdd(x: number): number {
  let r = Math.round(x)
  if (r % 2 === 0) r += 1
  return r
}

type Vec = Float64Array

/**
 * The Fortran writes these thresholds as default-precision (single) literals, .999 and .001, so
 * R compares against their float32 values; using the same values keeps borderline weights equal.
 */
const F999 = Math.fround(0.999)
const F001 = Math.fround(0.001)

/** LOESS estimate at position xs from y[nleft..nright] (1-based); writes weights into w. */
function est(
  y: Vec,
  yOff: number,
  n: number,
  len: number,
  ideg: number,
  xs: number,
  nleft: number,
  nright: number,
  w: Vec,
  userw: boolean,
  rw: Vec,
  rwOff: number
): { ok: boolean; ys: number } {
  const range = n - 1
  let h = Math.max(xs - nleft, nright - xs)
  if (len > n) h += Math.floor((len - n) / 2)
  const h9 = 0.999 * h
  const h1 = 0.001 * h
  let a = 0
  for (let j = nleft; j <= nright; j++) {
    w[j - 1] = 0
    const r = Math.abs(j - xs)
    if (r <= h9) {
      w[j - 1] = r <= h1 ? 1 : (1 - (r / h) ** 3) ** 3
      if (userw) w[j - 1] *= rw[rwOff + j - 1]
      a += w[j - 1]
    }
  }
  if (a <= 0) return { ok: false, ys: 0 }
  for (let j = nleft; j <= nright; j++) w[j - 1] /= a
  if (h > 0 && ideg > 0) {
    let mean = 0
    for (let j = nleft; j <= nright; j++) mean += w[j - 1] * j
    let b = xs - mean
    let c = 0
    for (let j = nleft; j <= nright; j++) c += w[j - 1] * (j - mean) ** 2
    if (Math.sqrt(c) > 0.001 * range) {
      b /= c
      for (let j = nleft; j <= nright; j++) w[j - 1] *= b * (j - mean) + 1
    }
  }
  let ys = 0
  for (let j = nleft; j <= nright; j++) ys += w[j - 1] * y[yOff + j - 1]
  return { ok: true, ys }
}

/** LOESS smooth of y[1..n] into ys[1..n] (written at ysOff), with optional jumps. */
function ess(
  y: Vec,
  yOff: number,
  n: number,
  len: number,
  ideg: number,
  njump: number,
  userw: boolean,
  rw: Vec,
  rwOff: number,
  ys: Vec,
  ysOff: number,
  res: Vec
): void {
  if (n < 2) {
    ys[ysOff] = y[yOff]
    return
  }
  const at = (i: number, nleft: number, nright: number) => {
    const r = est(y, yOff, n, len, ideg, i, nleft, nright, res, userw, rw, rwOff)
    ys[ysOff + i - 1] = r.ok ? r.ys : y[yOff + i - 1]
  }
  const newnj = Math.min(njump, n - 1)
  // the window of the last fitted point is reused for the end point, as in the Fortran
  let nleft = 1
  let nright = n
  if (len >= n) {
    for (let i = 1; i <= n; i += newnj) at(i, nleft, nright)
  } else if (newnj === 1) {
    const nsh = Math.floor((len + 1) / 2)
    nright = len
    for (let i = 1; i <= n; i++) {
      if (i > nsh && nright !== n) {
        nleft++
        nright++
      }
      at(i, nleft, nright)
    }
  } else {
    const nsh = Math.floor((len + 1) / 2)
    for (let i = 1; i <= n; i += newnj) {
      if (i < nsh) {
        nleft = 1
        nright = len
      } else if (i >= n - nsh + 1) {
        nleft = n - len + 1
        nright = n
      } else {
        nleft = i - nsh + 1
        nright = len + i - nsh
      }
      at(i, nleft, nright)
    }
  }
  if (newnj !== 1) {
    for (let i = 1; i <= n - newnj; i += newnj) {
      const delta = (ys[ysOff + i + newnj - 1] - ys[ysOff + i - 1]) / newnj
      for (let j = i + 1; j <= i + newnj - 1; j++) {
        ys[ysOff + j - 1] = ys[ysOff + i - 1] + delta * (j - i)
      }
    }
    const k = Math.floor((n - 1) / newnj) * newnj + 1
    if (k !== n) {
      at(n, nleft, nright)
      if (k !== n - 1) {
        const delta = (ys[ysOff + n - 1] - ys[ysOff + k - 1]) / (n - k)
        for (let j = k + 1; j <= n - 1; j++) ys[ysOff + j - 1] = ys[ysOff + k - 1] + delta * (j - k)
      }
    }
  }
}

/** Moving average of length len: x[1..n] -> ave[1..n-len+1]. */
function ma(x: Vec, n: number, len: number, ave: Vec): void {
  const newn = n - len + 1
  let v = 0
  for (let i = 0; i < len; i++) v += x[i]
  ave[0] = v / len
  let k = len
  let m = 0
  for (let j = 2; j <= newn; j++) {
    k++
    m++
    v = v - x[m - 1] + x[k - 1]
    ave[j - 1] = v / len
  }
}

/** Low-pass filter: moving averages of length np, np and 3. */
function fts(x: Vec, n: number, np: number, trend: Vec, work: Vec): void {
  ma(x, n, np, trend)
  ma(trend, n - np + 1, np, work)
  ma(work, n - 2 * np + 2, 3, trend)
}

/** Smooth each cycle-subseries, extended by one period at each end. season has n + 2np slots. */
function ss(
  y: Vec,
  n: number,
  np: number,
  ns: number,
  isdeg: number,
  nsjump: number,
  userw: boolean,
  rw: Vec,
  season: Vec,
  work1: Vec,
  work2: Vec,
  work3: Vec,
  work4: Vec
): void {
  for (let j = 1; j <= np; j++) {
    const k = Math.floor((n - j) / np) + 1
    for (let i = 1; i <= k; i++) work1[i - 1] = y[(i - 1) * np + j - 1]
    if (userw) for (let i = 1; i <= k; i++) work3[i - 1] = rw[(i - 1) * np + j - 1]
    ess(work1, 0, k, ns, isdeg, nsjump, userw, work3, 0, work2, 1, work4)
    const nright = Math.min(ns, k)
    const left = est(work1, 0, k, ns, isdeg, 0, 1, nright, work4, userw, work3, 0)
    work2[0] = left.ok ? left.ys : work2[1]
    const nleft = Math.max(1, k - ns + 1)
    const right = est(work1, 0, k, ns, isdeg, k + 1, nleft, k, work4, userw, work3, 0)
    work2[k + 1] = right.ok ? right.ys : work2[k]
    for (let m = 1; m <= k + 2; m++) season[(m - 1) * np + j - 1] = work2[m - 1]
  }
}

/**
 * Singleton's partial sort as in stl.f (`psort`): rearranges a[1..n] so that the positions listed
 * in ind hold the values a full sort would put there. 1-based (a[0] is unused); the states follow
 * the Fortran's labels: 161 outer, 166 pop, 173 loop, 10 partition, 209 insertion sort.
 */
export function psort(a: Float64Array, n: number, ind: number[]): void {
  const ni = ind.length
  if (n < 2 || ni === 0) return
  const indu = new Array<number>(17).fill(0)
  const indl = new Array<number>(17).fill(0)
  const iu = new Array<number>(17).fill(0)
  const il = new Array<number>(17).fill(0)
  const at = (k: number) => ind[k - 1]
  let jl = 1
  let ju = ni
  indl[1] = 1
  indu[1] = ni
  let i = 1
  let j = n
  let m = 1
  let state: "outer" | "pop" | "loop" | "partition" | "insert" = "outer"
  for (let guard = 0; guard < 10_000_000; guard++) {
    switch (state) {
      case "outer":
        state = i < j ? "partition" : "pop"
        break
      case "pop":
        m -= 1
        if (m === 0) return
        i = il[m]
        j = iu[m]
        jl = indl[m]
        ju = indu[m]
        if (jl <= ju) state = "loop"
        break
      case "loop":
        if (j - i > 10) state = "partition"
        else if (i !== 1) {
          i -= 1
          state = "insert"
        } else state = "outer"
        break
      case "partition": {
        let k = i
        const ij = Math.floor((i + j) / 2)
        let t = a[ij]
        if (a[i] > t) {
          a[ij] = a[i]
          a[i] = t
          t = a[ij]
        }
        let l = j
        if (a[j] < t) {
          a[ij] = a[j]
          a[j] = t
          t = a[ij]
          if (a[i] > t) {
            a[ij] = a[i]
            a[i] = t
            t = a[ij]
          }
        }
        for (;;) {
          l -= 1
          if (a[l] <= t) {
            const tt = a[l]
            do k += 1
            while (!(a[k] >= t))
            if (k > l) break
            a[l] = a[k]
            a[k] = tt
          }
        }
        indl[m] = jl
        indu[m] = ju
        const p = m
        m += 1
        state = "loop"
        if (l - i <= j - k) {
          il[p] = k
          iu[p] = j
          j = l
          while (jl <= ju && at(ju) > j) ju -= 1
          if (jl > ju) state = "pop"
          else indl[p] = ju + 1
        } else {
          il[p] = i
          iu[p] = l
          i = k
          while (jl <= ju && at(jl) < i) jl += 1
          if (jl > ju) state = "pop"
          else indu[p] = jl - 1
        }
        break
      }
      case "insert": {
        i += 1
        if (i === j) {
          state = "pop"
          break
        }
        const t = a[i + 1]
        if (a[i] <= t) break
        let k = i
        do {
          a[k + 1] = a[k]
          k -= 1
        } while (t < a[k])
        a[k + 1] = t
        break
      }
    }
  }
  throw new Error("psort did not terminate")
}

/**
 * Bisquare robustness weights from the remainder, scaled by six times its median absolute value.
 * Like stl.f, the "median" comes from psort called with the two middle positions in descending
 * order (n/2 + 1, then n/2); psort expects them ascending, so for an even n the value can differ
 * slightly from the exact median. The port keeps that behaviour so it reproduces R.
 */
function rwt(y: Vec, n: number, fit: Vec, rw: Vec): void {
  const a = new Float64Array(n + 1)
  for (let i = 0; i < n; i++) a[i + 1] = Math.abs(y[i] - fit[i])
  const mid1 = Math.floor(n / 2) + 1
  const mid2 = n - mid1 + 1
  psort(a, n, [mid1, mid2])
  const cmad = 3 * (a[mid1] + a[mid2])
  const c9 = F999 * cmad
  const c1 = F001 * cmad
  for (let i = 0; i < n; i++) {
    const r = Math.abs(y[i] - fit[i])
    rw[i] = r <= c1 ? 1 : r <= c9 ? (1 - (r / cmad) ** 2) ** 2 : 0
  }
}

/** Decompose y (regular, no missing values) into seasonal + trend + remainder. */
export function stl(values: readonly number[], options: StlOptions): StlResult {
  const n = values.length
  const period = options.period
  if (!Number.isInteger(period) || period < 2) throw new RangeError("period must be an integer ≥ 2")
  if (n <= 2 * period) throw new RangeError("series must span more than two periods")
  if (values.some((v) => !Number.isFinite(v))) throw new RangeError("STL needs complete data")
  const robust = options.robust ?? false
  const sWindow = options.sWindow
  const sDegree = options.sDegree ?? 0
  const tDegree = options.tDegree ?? 1
  const lDegree = options.lDegree ?? tDegree
  const tWindow = options.tWindow ?? nextOdd(Math.ceil((1.5 * period) / (1 - 1.5 / sWindow)))
  const lWindow = options.lWindow ?? nextOdd(period)
  const sJump = options.sJump ?? Math.ceil(sWindow / 10)
  const tJump = options.tJump ?? Math.ceil(tWindow / 10)
  const lJump = options.lJump ?? Math.ceil(lWindow / 10)
  const inner = options.inner ?? (robust ? 1 : 2)
  const outer = options.outer ?? (robust ? 15 : 0)

  const odd = (v: number) => {
    const m = Math.max(3, v)
    return m % 2 === 0 ? m + 1 : m
  }
  const ns = odd(sWindow)
  const nt = odd(tWindow)
  const nl = odd(lWindow)
  const np = Math.max(2, period)

  const y = Float64Array.from(values)
  const rw = new Float64Array(n)
  const season = new Float64Array(n)
  const trend = new Float64Array(n)
  const m = n + 2 * np
  const w1 = new Float64Array(m)
  const w2 = new Float64Array(m)
  const w3 = new Float64Array(m)
  const w4 = new Float64Array(m)
  const w5 = new Float64Array(m)

  const step = (userw: boolean) => {
    for (let it = 0; it < inner; it++) {
      for (let i = 0; i < n; i++) w1[i] = y[i] - trend[i]
      ss(w1, n, np, ns, sDegree, sJump, userw, rw, w2, w3, w4, w5, season)
      fts(w2, m, np, w3, w1)
      ess(w3, 0, n, nl, lDegree, lJump, false, w4, 0, w1, 0, w5)
      for (let i = 0; i < n; i++) season[i] = w2[np + i] - w1[i]
      for (let i = 0; i < n; i++) w1[i] = y[i] - season[i]
      ess(w1, 0, n, nt, tDegree, tJump, userw, rw, 0, trend, 0, w3)
    }
  }

  let userw = false
  for (let k = 0; ;) {
    step(userw)
    k++
    if (k > outer) break
    for (let i = 0; i < n; i++) w1[i] = trend[i] + season[i]
    rwt(y, n, w1, rw)
    userw = true
  }
  if (outer <= 0) rw.fill(1)

  const seasonal = Array.from(season)
  const tr = Array.from(trend)
  return {
    seasonal,
    trend: tr,
    remainder: values.map((v, i) => v - seasonal[i] - tr[i]),
    weights: Array.from(rw),
    params: {
      period,
      sWindow: ns,
      tWindow: nt,
      lWindow: nl,
      sDegree,
      tDegree,
      lDegree,
      inner,
      outer,
      robust,
    },
  }
}

function variance(xs: readonly number[]): number {
  const m = xs.reduce((s, v) => s + v, 0) / xs.length
  return xs.reduce((s, v) => s + (v - m) ** 2, 0) / (xs.length - 1)
}

/**
 * Strength of trend and seasonality (Wang, Smith and Hyndman 2006): 1 − Var(R) / Var(T + R) and
 * 1 − Var(R) / Var(S + R), floored at 0. Close to 1 means the component dominates the noise.
 * `include` can leave out known structural breaks (for example months when venues were closed),
 * which would otherwise swamp the remainder variance.
 */
export function stlStrength(
  r: StlResult,
  include: (index: number) => boolean = () => true
): { trend: number; seasonal: number; n: number } {
  const keep = r.remainder.map((_, i) => i).filter(include)
  const rem = keep.map((i) => r.remainder[i])
  const tr = keep.map((i) => r.trend[i] + r.remainder[i])
  const se = keep.map((i) => r.seasonal[i] + r.remainder[i])
  return {
    trend: Math.max(0, 1 - variance(rem) / variance(tr)),
    seasonal: Math.max(0, 1 - variance(rem) / variance(se)),
    n: keep.length,
  }
}
