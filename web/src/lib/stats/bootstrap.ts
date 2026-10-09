import type { Interval } from "./intervals"
import { quantile } from "./quantile"
import { DEFAULT_SEED, mulberry32, randomInt, type Rng } from "./rng"

export interface BootstrapOptions {
  /** Number of resamples. */
  B?: number
  seed?: number
  confidence?: number
}

export interface BootstrapResult extends Interval {
  B: number
  seed: number
  confidence: number
  /** Bootstrap standard error (sd of the replicates). */
  se: number
}

export function summariseReplicates(
  estimate: number,
  reps: readonly number[],
  B: number,
  seed: number,
  confidence: number
): BootstrapResult {
  const ok = reps.filter(Number.isFinite)
  const a = (1 - confidence) / 2
  const m = ok.reduce((s, x) => s + x, 0) / ok.length
  const se = Math.sqrt(ok.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, ok.length - 1))
  return { estimate, lower: quantile(ok, a), upper: quantile(ok, 1 - a), B, seed, confidence, se }
}

/**
 * Percentile bootstrap for a statistic of n exchangeable units. `statistic` receives how many times
 * each unit was drawn (weights summing to n), so a ratio of sums or a mean is one pass over the
 * units per resample.
 */
export function bootstrap(
  n: number,
  statistic: (weights: Float64Array) => number,
  { B = 2000, seed = DEFAULT_SEED, confidence = 0.95 }: BootstrapOptions = {}
): BootstrapResult {
  const estimate = statistic(new Float64Array(n).fill(1))
  const rng = mulberry32(seed)
  const reps: number[] = []
  const w = new Float64Array(n)
  for (let b = 0; b < B; b++) {
    w.fill(0)
    for (let i = 0; i < n; i++) w[randomInt(rng, n)] += 1
    reps.push(statistic(w))
  }
  return summariseReplicates(estimate, reps, B, seed, confidence)
}

/** Percentile bootstrap of a mean. */
export function bootstrapMean(
  xs: readonly number[],
  options: BootstrapOptions = {}
): BootstrapResult {
  return bootstrap(
    xs.length,
    (w) => {
      let s = 0
      let n = 0
      for (let i = 0; i < xs.length; i++) {
        s += w[i] * xs[i]
        n += w[i]
      }
      return s / n
    },
    options
  )
}

/**
 * Percentile bootstrap of a ratio of sums, Σ num / Σ den (for example annual NGR per machine as
 * twelve months of NGR over twelve monthly machine counts). Resampling whole months keeps each
 * month's numerator and denominator together.
 */
export function bootstrapRatio(
  num: readonly number[],
  den: readonly number[],
  scale = 1,
  options: BootstrapOptions = {}
): BootstrapResult {
  if (num.length !== den.length) throw new RangeError("num and den must have the same length")
  return bootstrap(
    num.length,
    (w) => {
      let a = 0
      let b = 0
      for (let i = 0; i < num.length; i++) {
        a += w[i] * num[i]
        b += w[i] * den[i]
      }
      return (scale * a) / b
    },
    options
  )
}

/** Default moving-block length for a series of n observations: round(n^(1/3)), at least 2. */
export function defaultBlockLength(n: number): number {
  return Math.max(2, Math.round(Math.cbrt(n)))
}

/**
 * Indices of one moving-block bootstrap resample of a series of length n (Künsch 1989): blocks of
 * `blockLength` consecutive positions with uniformly random starts, concatenated and cut to n.
 * Keeps short-range dependence (autocorrelation) inside each block.
 */
export function movingBlockIndices(n: number, blockLength: number, rng: Rng): number[] {
  const L = Math.min(Math.max(1, Math.floor(blockLength)), n)
  const starts = n - L + 1
  const out: number[] = []
  while (out.length < n) {
    const s = randomInt(rng, starts)
    for (let j = 0; j < L && out.length < n; j++) out.push(s + j)
  }
  return out
}
