import { movingBlockIndices, summariseReplicates, type BootstrapResult } from "./bootstrap"
import { autocorrelation, optimalBlockLength } from "./dependence"
import { invert } from "./ols"
import { DEFAULT_SEED, mulberry32 } from "./rng"

/**
 * Broken-stick (continuous piecewise-linear) regression with one unknown break:
 * y = a + b·t + d·(t − τ)₊ + e. The break τ is found by least squares over a grid of the observed
 * times; uncertainty for τ and the slopes comes from a moving-block bootstrap of the residuals,
 * which keeps their autocorrelation (the break is re-estimated in every resample). By default the
 * block length is chosen from the residuals themselves (Politis and White's automatic rule), because
 * a fixed rule of thumb such as n^(1/3) is far too short for a slowly moving series and gives an
 * interval that is too narrow.
 */

export interface HingeFit {
  /** Estimated break (a value of t). */
  tau: number
  intercept: number
  /** Slope before the break, b. */
  slopeBefore: number
  /** Slope after the break, b + d. */
  slopeAfter: number
  rss: number
  /** RSS of a single straight line, for comparison. */
  rssLinear: number
  fitted: number[]
}

function fitAt(t: readonly number[], y: readonly number[], tau: number) {
  const n = t.length
  // normal equations for [1, t, (t - tau)+]
  const xtx = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]
  const xty = [0, 0, 0]
  for (let i = 0; i < n; i++) {
    const row = [1, t[i], Math.max(0, t[i] - tau)]
    for (let a = 0; a < 3; a++) {
      xty[a] += row[a] * y[i]
      for (let b = 0; b < 3; b++) xtx[a][b] += row[a] * row[b]
    }
  }
  const inv = invert(xtx)
  const coef = inv.map((r) => r.reduce((s, v, k) => s + v * xty[k], 0))
  let rss = 0
  const fitted = new Array<number>(n)
  for (let i = 0; i < n; i++) {
    fitted[i] = coef[0] + coef[1] * t[i] + coef[2] * Math.max(0, t[i] - tau)
    rss += (y[i] - fitted[i]) ** 2
  }
  return { coef, rss, fitted }
}

/** Candidate breaks: observed times leaving at least `minSegment` points on each side. */
export function candidateBreaks(t: readonly number[], minSegment: number): number[] {
  const sorted = [...t].sort((a, b) => a - b)
  return sorted.slice(minSegment - 1, sorted.length - minSegment)
}

export function fitHinge(t: readonly number[], y: readonly number[], minSegment = 12): HingeFit {
  if (t.length !== y.length) throw new RangeError("t and y must have the same length")
  const grid = candidateBreaks(t, minSegment)
  if (!grid.length) throw new RangeError("series too short for the minimum segment length")
  let best: { tau: number; coef: number[]; rss: number; fitted: number[] } | null = null
  for (const tau of grid) {
    const f = fitAt(t, y, tau)
    if (!best || f.rss < best.rss) best = { tau, ...f }
  }
  // straight line for comparison: a hinge beyond the data is a plain line
  const n = t.length
  const tm = t.reduce((s, v) => s + v, 0) / n
  const ym = y.reduce((s, v) => s + v, 0) / n
  let sxy = 0
  let sxx = 0
  for (let i = 0; i < n; i++) {
    sxy += (t[i] - tm) * (y[i] - ym)
    sxx += (t[i] - tm) ** 2
  }
  const slope = sxy / sxx
  const rssLinear = y.reduce((s, v, i) => s + (v - (ym + slope * (t[i] - tm))) ** 2, 0)
  const b = best!
  return {
    tau: b.tau,
    intercept: b.coef[0],
    slopeBefore: b.coef[1],
    slopeAfter: b.coef[1] + b.coef[2],
    rss: b.rss,
    rssLinear,
    fitted: b.fitted,
  }
}

export interface HingeBootstrap {
  fit: HingeFit
  tau: BootstrapResult
  slopeBefore: BootstrapResult
  slopeAfter: BootstrapResult
  slopeChange: BootstrapResult
  blockLength: number
  /** "auto": Politis–White on the residuals (circular-block estimate, rounded); "fixed": given. */
  blockRule: "auto" | "fixed"
  /** Residual autocorrelation at lags 1, 3, 6 and 12, which the block length has to respect. */
  residualAcf: { lag: number; acf: number }[]
  minSegment: number
}

/** The automatic block length for a residual series: Politis–White (circular), rounded, ≥ 2. */
export function autoBlockLength(resid: readonly number[]): number {
  return Math.max(2, Math.round(optimalBlockLength(resid).circular))
}

export function bootstrapHinge(
  t: readonly number[],
  y: readonly number[],
  {
    B = 1000,
    seed = DEFAULT_SEED,
    blockLength: blockOption = "auto",
    minSegment = 12,
    confidence = 0.95,
  }: {
    B?: number
    seed?: number
    /** Block length in observations, or "auto" for the Politis–White choice on the residuals. */
    blockLength?: number | "auto"
    minSegment?: number
    confidence?: number
  } = {}
): HingeBootstrap {
  const fit = fitHinge(t, y, minSegment)
  const resid = y.map((v, i) => v - fit.fitted[i])
  const blockLength = blockOption === "auto" ? autoBlockLength(resid) : blockOption
  const rng = mulberry32(seed)
  const taus: number[] = []
  const before: number[] = []
  const after: number[] = []
  const change: number[] = []
  for (let b = 0; b < B; b++) {
    const idx = movingBlockIndices(t.length, blockLength, rng)
    const ys = fit.fitted.map((f, i) => f + resid[idx[i]])
    const f = fitHinge(t, ys, minSegment)
    taus.push(f.tau)
    before.push(f.slopeBefore)
    after.push(f.slopeAfter)
    change.push(f.slopeAfter - f.slopeBefore)
  }
  return {
    fit,
    tau: summariseReplicates(fit.tau, taus, B, seed, confidence),
    slopeBefore: summariseReplicates(fit.slopeBefore, before, B, seed, confidence),
    slopeAfter: summariseReplicates(fit.slopeAfter, after, B, seed, confidence),
    slopeChange: summariseReplicates(fit.slopeAfter - fit.slopeBefore, change, B, seed, confidence),
    blockLength,
    blockRule: blockOption === "auto" ? "auto" : "fixed",
    residualAcf: [1, 3, 6, 12]
      .filter((lag) => lag < resid.length)
      .map((lag) => ({ lag, acf: autocorrelation(resid, lag) })),
    minSegment,
  }
}
