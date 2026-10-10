import { bootstrapMean, type BootstrapOptions, type BootstrapResult } from "./bootstrap"
import { binomialTestTwoSided, tTestPValue } from "./distributions"
import { tInterval, type MeanInterval } from "./intervals"

/**
 * Exact McNemar test for two methods scored on the same items: only the discordant items matter
 * (b = A right and B wrong, c = A wrong and B right), and under H0 b ~ Bin(b + c, 1/2). Matches
 * statsmodels `mcnemar(table, exact=True)`.
 */
export function mcnemarExact(b: number, c: number): number {
  return binomialTestTwoSided(b, b + c, 0.5)
}

export interface PairedSummary {
  n: number
  /** Mean of the paired differences (after − before) with a t interval. */
  t: MeanInterval
  /** The same mean with a percentile bootstrap interval over pairs. */
  bootstrap: BootstrapResult
  /** Two-sided paired t-test p-value. */
  p: number
  /** Standardised mean difference of the pairs, d_z = mean / sd. */
  dz: number
  /** Relative change of the means, mean(after) / mean(before) − 1. */
  relative: number
}

/** Paired comparison of matched observations (for example the same calendar month in two years). */
export function pairedSummary(
  before: readonly number[],
  after: readonly number[],
  options: BootstrapOptions = {}
): PairedSummary {
  if (before.length !== after.length) throw new RangeError("pairs must have equal length")
  const diffs = after.map((a, i) => a - before[i])
  const t = tInterval(diffs)
  const mb = before.reduce((s, x) => s + x, 0) / before.length
  const ma = after.reduce((s, x) => s + x, 0) / after.length
  return {
    n: diffs.length,
    t,
    bootstrap: bootstrapMean(diffs, options),
    p: tTestPValue(t.estimate / t.se, t.df),
    dz: t.estimate / t.sd,
    relative: ma / mb - 1,
  }
}
