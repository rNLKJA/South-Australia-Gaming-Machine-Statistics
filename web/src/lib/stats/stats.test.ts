import { describe, expect, it } from "vitest"

import ref from "./__fixtures__/reference.json"
import stlRef from "./__fixtures__/stl-reference.json"
import {
  bootstrap,
  bootstrapMean,
  bootstrapRatio,
  defaultBlockLength,
  movingBlockIndices,
} from "./bootstrap"
import {
  ar1SeInflation,
  autocorrelation,
  optimalBlockLength,
  pooledLag1Autocorrelation,
} from "./dependence"
import {
  binomialTestTwoSided,
  binomialUpperTail,
  normalCdf,
  normalQuantile,
  tCdf,
  tQuantile,
} from "./distributions"
import { funnelLimits, funnelZone, overdispersion, pooledWithinScale } from "./funnel"
import { tInterval, wilsonInterval } from "./intervals"
import {
  coefficient,
  durbinWatson,
  lag1Autocorrelation,
  linearCombination,
  neweyWestCovariance,
  neweyWestLag,
  ols,
} from "./ols"
import { mcnemarExact, pairedSummary } from "./paired"
import { median, quantile } from "./quantile"
import { DEFAULT_SEED, mulberry32 } from "./rng"
import { autoBlockLength, bootstrapHinge, candidateBreaks, fitHinge } from "./segmented"
import { nextOdd, psort, stl, stlStrength } from "./stl"

function close(a: number, b: number, tol: number) {
  expect(Math.abs(a - b), `${a} vs ${b}`).toBeLessThanOrEqual(tol * Math.max(1, Math.abs(b)))
}

describe("distributions (against scipy)", () => {
  const d = ref.distributions
  it("normal CDF and quantile", () => {
    for (const r of d.normal_cdf) close(normalCdf(r.x), r.p, 1e-12)
    for (const r of d.normal_quantile) close(normalQuantile(r.p), r.q, 1e-9)
  })
  it("Student t CDF and quantile", () => {
    for (const r of d.t_cdf) close(tCdf(r.t, r.df), r.p, 1e-12)
    for (const r of d.t_quantile) close(tQuantile(r.p, r.df), r.q, 1e-9)
  })
  it("exact two-sided binomial test", () => {
    for (const r of d.binom_test) close(binomialTestTwoSided(r.k, r.n), r.p, 1e-10)
  })
  it("binomial upper tail, including very small tails", () => {
    for (const r of ref.dependence.binom_upper) {
      const got = binomialUpperTail(r.k, r.n, r.p)
      expect(Math.abs(got - r.sf), `${r.k}/${r.n}`).toBeLessThanOrEqual(
        1e-9 * Math.max(r.sf, 1e-300)
      )
    }
    expect(binomialUpperTail(49, 48, 0.05)).toBe(0)
  })
})

describe("serial dependence (against arch and statsmodels)", () => {
  const dep = ref.dependence
  it("Politis–White automatic block lengths match arch", () => {
    for (const s of dep.series) {
      const b = optimalBlockLength(s.x)
      close(b.stationary, s.stationary, 1e-9)
      close(b.circular, s.circular, 1e-9)
    }
    expect(() => optimalBlockLength([1, 2, 3])).toThrow()
  })
  it("autocorrelations match statsmodels acf", () => {
    for (const s of dep.series) {
      for (let k = 1; k <= 12; k++) close(autocorrelation(s.x, k), s.acf[k], 1e-10)
    }
  })
  it("pools the within-group lag-1 autocorrelation and inflates standard errors", () => {
    const p = pooledLag1Autocorrelation([...dep.groups, [3]])
    close(p.rho, dep.pooled_rho, 1e-12)
    expect(p.groups).toBe(dep.groups.length)
    expect(p.pairs).toBe(dep.groups.reduce((s, g) => s + g.length - 1, 0))
    // a null breaks the series: no pair spans it, but both sides count towards the mean
    const gap = pooledLag1Autocorrelation([[1, 2, null, 4, 5]])
    expect(gap.pairs).toBe(2)
    close(gap.rho, (-2 * -1 + 1 * 2) / (4 + 1 + 1 + 4), 1e-12)
    close(ar1SeInflation(0.46), Math.sqrt(1.46 / 0.54), 1e-12)
    expect(ar1SeInflation(-0.3)).toBe(1)
  })
})

describe("intervals (against scipy and statsmodels)", () => {
  it("t interval for a mean", () => {
    for (const r of ref.intervals.t_interval) {
      const ci = tInterval(r.xs)
      close(ci.estimate, r.mean, 1e-12)
      close(ci.sd, r.sd, 1e-10)
      close(ci.lower, r.lower, 1e-9)
      close(ci.upper, r.upper, 1e-9)
    }
    expect(Number.isNaN(tInterval([5]).lower)).toBe(true)
  })
  it("Wilson interval", () => {
    for (const r of ref.intervals.wilson) {
      const ci = wilsonInterval(r.x, r.n)
      close(ci.lower, r.lower, 1e-12)
      close(ci.upper, r.upper, 1e-12)
    }
    expect(() => wilsonInterval(6, 5)).toThrow()
    expect(wilsonInterval(0, 0).estimate).toBeNaN()
  })
  it("type-7 quantiles match numpy", () => {
    for (const r of ref.intervals.quantile) close(quantile(r.xs, r.p), r.q, 1e-12)
    expect(median([5, 1, 3])).toBe(3)
    expect(() => quantile([1], 2)).toThrow()
  })
})

describe("paired comparisons", () => {
  it("paired t interval, p-value and d_z match scipy", () => {
    const r = ref.paired.paired_t
    const s = pairedSummary(r.before, r.after, { B: 500 })
    close(s.t.estimate, r.mean, 1e-12)
    close(s.t.lower, r.lower, 1e-9)
    close(s.t.upper, r.upper, 1e-9)
    close(s.p, r.p, 1e-9)
    close(s.dz, r.dz, 1e-10)
    expect(s.bootstrap.lower).toBeLessThan(s.t.estimate)
    expect(s.bootstrap.upper).toBeGreaterThan(s.t.estimate)
  })
  it("exact McNemar matches statsmodels", () => {
    for (const r of ref.paired.mcnemar) close(mcnemarExact(r.b, r.c), r.p, 1e-10)
  })
})

describe("bootstrap", () => {
  it("is reproducible from its seed and differs across seeds", () => {
    const xs = [3, 9, 4, 12, 7, 1, 8, 15, 6, 2, 11, 5]
    const a = bootstrapMean(xs, { B: 400, seed: 42 })
    const b = bootstrapMean(xs, { B: 400, seed: 42 })
    const c = bootstrapMean(xs, { B: 400, seed: 43 })
    expect(a).toEqual(b)
    expect(a.lower).not.toBe(c.lower)
    expect(a.estimate).toBeCloseTo(83 / 12, 12)
    expect(a.seed).toBe(42)
    expect(DEFAULT_SEED).toBe(20090701)
  })
  it("ratio of sums keeps the point estimate of the plain ratio", () => {
    const num = [70, 72, 68, 75]
    const den = [12000, 12100, 11900, 12050]
    const r = bootstrapRatio(num, den, 12, { B: 300 })
    close(r.estimate, (12 * 285) / 48050, 1e-12)
    expect(r.lower).toBeLessThanOrEqual(r.estimate)
    expect(r.upper).toBeGreaterThanOrEqual(r.estimate)
    expect(() => bootstrapRatio([1], [1, 2])).toThrow()
  })
  it("percentile bootstrap of a mean is close to the t interval for a large sample", () => {
    const rng = mulberry32(9)
    const xs = Array.from({ length: 400 }, () => rng() * 10)
    const bs = bootstrap(xs.length, (w) => xs.reduce((s, x, i) => s + w[i] * x, 0) / xs.length, {
      B: 2000,
    })
    const t = tInterval(xs)
    close(bs.lower, t.lower, 0.01)
    close(bs.upper, t.upper, 0.01)
  })
  it("moving blocks are contiguous runs of the series", () => {
    const idx = movingBlockIndices(20, 5, mulberry32(1))
    expect(idx).toHaveLength(20)
    for (let b = 0; b < 4; b++) {
      for (let j = 1; j < 5; j++) expect(idx[b * 5 + j]).toBe(idx[b * 5] + j)
    }
    expect(Math.max(...idx)).toBeLessThan(20)
    expect(defaultBlockLength(189)).toBe(6)
  })
})

describe("OLS with Newey–West errors (against statsmodels)", () => {
  const r = ref.regression
  const fit = ols(r.x, r.y, r.names)
  it("matches the coefficients, classical and HAC standard errors", () => {
    expect(neweyWestLag(r.y.length)).toBe(r.lag)
    const hac = neweyWestCovariance(fit, r.x, r.lag)
    r.coef.forEach((b, j) => close(fit.coef[j], b, 1e-9))
    r.se_classical.forEach((se, j) => close(Math.sqrt(fit.covClassical[j][j]), se, 1e-9))
    r.se_hac.forEach((se, j) => close(Math.sqrt(hac[j][j]), se, 1e-9))
    close(fit.r2, r.r2, 1e-10)
  })
  it("gives linear combinations with the HAC covariance", () => {
    const hac = neweyWestCovariance(fit, r.x, r.lag)
    const combo = linearCombination(fit, hac, r.combo.c)
    close(combo.estimate, r.combo.estimate, 1e-9)
    close(combo.se, r.combo.se, 1e-9)
    const post = coefficient(fit, hac, "post")
    expect(post.lower).toBeLessThan(post.estimate)
    expect(() => coefficient(fit, hac, "nope")).toThrow()
  })
  it("residual diagnostics match statsmodels", () => {
    close(durbinWatson(fit.residuals), r.durbin_watson, 1e-10)
    close(lag1Autocorrelation(fit.residuals), r.acf1, 1e-10)
  })
  it("refuses singular or too-small designs", () => {
    expect(() =>
      ols(
        [
          [1, 2],
          [2, 4],
          [3, 6],
        ],
        [1, 2, 3]
      )
    ).toThrow()
    expect(() => ols([[1]], [1])).toThrow()
  })
})

describe("STL (against R's stats::stl)", () => {
  it("rounds windows up to odd numbers as R does", () => {
    expect(nextOdd(12)).toBe(13)
    expect(nextOdd(20.4)).toBe(21)
  })
  for (const c of stlRef.cases) {
    it(c.name, () => {
      const jump = c.jump1 ? 1 : undefined
      const r = stl(c.x, {
        period: c.period,
        sWindow: c.sWindow,
        sDegree: c.sDegree as 0 | 1,
        tWindow: c.tWindow ?? undefined,
        robust: c.robust,
        sJump: jump,
        tJump: jump,
        lJump: jump,
      })
      expect(r.params.sWindow).toBe(c.used.sWindow)
      expect(r.params.tWindow).toBe(c.used.tWindow)
      expect(r.params.lWindow).toBe(c.used.lWindow)
      expect(r.params.inner).toBe(c.used.inner)
      expect(r.params.outer).toBe(c.used.outer)
      c.seasonal.forEach((v, i) => close(r.seasonal[i], v, 1e-8))
      c.trend.forEach((v, i) => close(r.trend[i], v, 1e-8))
      c.remainder.forEach((v, i) => close(r.remainder[i], v, 1e-8))
      c.weights.forEach((v, i) => close(r.weights[i], v, 1e-8))
    })
  }
  it("psort places the requested order statistics (ascending positions)", () => {
    const rng = mulberry32(3)
    for (let n = 2; n <= 70; n++) {
      const vals = Array.from({ length: n }, () => Math.round(rng() * 40))
      const sorted = [...vals].sort((a, b) => a - b)
      const positions = [...new Set([1, Math.ceil(n / 3), Math.floor(n / 2) + 1, n])].sort(
        (a, b) => a - b
      )
      const a = Float64Array.from([0, ...vals])
      psort(a, n, positions)
      for (const p of positions) expect(a[p]).toBe(sorted[p - 1])
    }
  })
  it("reports trend and seasonal strength between 0 and 1, and rejects bad input", () => {
    const c = stlRef.cases[0]
    const s = stlStrength(stl(c.x, { period: 12, sWindow: 7 }))
    expect(s.seasonal).toBeGreaterThan(0.9)
    expect(s.trend).toBeGreaterThanOrEqual(0)
    expect(() => stl([1, 2, 3], { period: 12, sWindow: 7 })).toThrow()
    expect(() => stl([...c.x.slice(0, 30), NaN], { period: 12, sWindow: 7 })).toThrow()
  })
})

describe("funnel helpers (against the published formulas in numpy)", () => {
  const f = ref.funnel
  it("pools the within-group scale", () => {
    const obs = f.groups.flatMap((g) =>
      g.logRatio.map((y, i) => ({ group: g.group, logRatio: y, exposure: g.exposure[i] }))
    )
    const p = pooledWithinScale(obs)
    close(p.c, f.c, 1e-12)
    expect(p.df).toBe(f.df)
  })
  it("estimates Spiegelhalter's winsorised over-dispersion", () => {
    const o = overdispersion(f.cross_section.logRatio, f.cross_section.exposure, f.c)
    close(o.phi, f.cross_section.phi, 1e-12)
    close(o.tau2, f.cross_section.tau2, 1e-12)
  })
  it("draws limits on the log scale and classifies zones", () => {
    for (const l of f.limits) {
      const lim = funnelLimits(1, l.m, f.c, f.cross_section.tau2)
      close(lim.lower95, l.lower95, 1e-12)
      close(lim.upper95, l.upper95, 1e-12)
      close(lim.lower998, l.lower998, 1e-12)
      close(lim.upper998, l.upper998, 1e-12)
    }
    const lim = funnelLimits(100, 400, 1)
    expect(funnelZone(100, lim)).toBe("within")
    expect(funnelZone(lim.upper95 + 0.01, lim)).toBe("above95")
    expect(funnelZone(lim.upper998 + 0.01, lim)).toBe("above998")
    expect(funnelZone(lim.lower95 - 0.01, lim)).toBe("below95")
    expect(funnelZone(lim.lower998 - 0.01, lim)).toBe("below998")
    // limits narrow as exposure grows
    expect(funnelLimits(1, 1000, 1).upper95).toBeLessThan(funnelLimits(1, 20, 1).upper95)
  })
})

describe("broken-stick regression", () => {
  const h = ref.hinge
  it("finds the least-squares break found by numpy", () => {
    const fit = fitHinge(h.t, h.y, 12)
    expect(fit.tau).toBe(h.tau)
    close(fit.slopeBefore, h.slope_before, 1e-9)
    close(fit.slopeAfter, h.slope_after, 1e-9)
    close(fit.rss, h.rss, 1e-9)
    close(fit.rssLinear, h.rss_linear, 1e-9)
  })
  it("bootstraps the break with moving blocks, reproducibly", () => {
    const a = bootstrapHinge(h.t, h.y, { B: 60, seed: 7 })
    const b = bootstrapHinge(h.t, h.y, { B: 60, seed: 7 })
    expect(a.tau).toEqual(b.tau)
    expect(a.tau.lower).toBeLessThanOrEqual(h.tau)
    expect(a.tau.upper).toBeGreaterThanOrEqual(h.tau)
    expect(a.slopeChange.lower).toBeGreaterThan(0)
    expect(a.blockRule).toBe("auto")
    expect(a.residualAcf.map((r) => r.lag)).toEqual([1, 3, 6, 12])
    const fixed = bootstrapHinge(h.t, h.y, { B: 60, seed: 7, blockLength: 5 })
    expect(fixed.blockLength).toBe(5)
    expect(fixed.blockRule).toBe("fixed")
  })
  it("chooses longer blocks for strongly autocorrelated residuals", () => {
    // a weakly dependent series gets shorter blocks than an AR(0.95) one
    const series = ref.dependence.series
    const ar = series[0].x
    const weak = series[2].x
    expect(autoBlockLength(ar.map((v) => v - 50))).toBeGreaterThan(autoBlockLength(weak))
    expect(autoBlockLength(ar)).toBe(Math.round(series[0].circular))
  })
  it("keeps a minimum number of points on each side", () => {
    expect(candidateBreaks([1, 2, 3, 4, 5, 6], 2)).toEqual([2, 3, 4])
    expect(() => fitHinge([1, 2, 3], [1, 2, 3], 12)).toThrow()
  })
})
