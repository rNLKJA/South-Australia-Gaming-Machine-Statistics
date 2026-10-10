# /// script
# requires-python = ">=3.12"
# dependencies = ["numpy>=2", "scipy>=1.14", "statsmodels>=0.14", "arch>=7"]
# ///
"""Reference values for the TypeScript statistics helpers in web/src/lib/stats/.

Every number here comes from scipy, statsmodels, arch or numpy (or, for the funnel and broken-stick
helpers, from an independent numpy implementation of the published formula), and is written to
web/src/lib/stats/__fixtures__/reference.json, which stats.test.ts compares against.

    uv run scripts/stats_reference.py     (from the repository root)
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import statsmodels.api as sm
from arch.bootstrap import optimal_block_length
from scipy import stats
from statsmodels.stats.contingency_tables import mcnemar
from statsmodels.stats.proportion import proportion_confint

OUT = Path("web/src/lib/stats/__fixtures__/reference.json")


def f(x) -> float:
    return float(x)


def distributions() -> dict:
    ps = [1e-6, 0.001, 0.025, 0.1, 0.5, 0.9, 0.975, 0.999]
    t_cases = [(p, df) for p in [0.005, 0.025, 0.05, 0.95, 0.975, 0.995] for df in [2, 5, 11, 30, 103]]
    return {
        "normal_quantile": [{"p": p, "q": f(stats.norm.ppf(p))} for p in ps],
        "normal_cdf": [{"x": x, "p": f(stats.norm.cdf(x))} for x in [-6, -1.96, -0.5, 0, 0.3, 2.5, 8]],
        "t_quantile": [{"p": p, "df": df, "q": f(stats.t.ppf(p, df))} for p, df in t_cases],
        "t_cdf": [{"t": t, "df": df, "p": f(stats.t.cdf(t, df))} for t in [-4, -1, 0.7, 2.2] for df in [3, 11, 60]],
        "binom_test": [
            {"k": k, "n": n, "p": f(stats.binomtest(k, n, 0.5).pvalue)}
            for k, n in [(0, 5), (3, 10), (7, 9), (12, 20), (1, 1), (15, 40)]
        ],
    }


def intervals() -> dict:
    rng = np.random.default_rng(7)
    samples = [rng.normal(60_000, 9_000, size=n).round(2).tolist() for n in [3, 8, 11]]
    t_int = []
    for xs in samples:
        a = np.asarray(xs)
        lo, hi = stats.t.interval(0.95, len(a) - 1, loc=a.mean(), scale=stats.sem(a))
        t_int.append({"xs": xs, "mean": f(a.mean()), "lower": f(lo), "upper": f(hi), "sd": f(a.std(ddof=1))})
    wilson = []
    for x, n in [(0, 10), (1, 20), (5, 24), (12, 24), (24, 24), (41, 48)]:
        lo, hi = proportion_confint(x, n, alpha=0.05, method="wilson")
        wilson.append({"x": x, "n": n, "lower": f(lo), "upper": f(hi)})
    quant = [
        {"xs": xs, "p": p, "q": f(np.quantile(xs, p))}
        for xs in [[3.0, 1.0, 2.0], [5.5, 1.25, 9.0, 2.0, 7.75, 4.0], list(range(1, 12))]
        for p in [0.025, 0.1, 0.5, 0.9, 0.975]
    ]
    return {"t_interval": t_int, "wilson": wilson, "quantile": quant}


def paired() -> dict:
    rng = np.random.default_rng(11)
    before = rng.normal(80, 8, size=12).round(3)
    after = (before + rng.normal(5, 4, size=12)).round(3)
    res = stats.ttest_rel(after, before)
    ci = res.confidence_interval(0.95)
    d = after - before
    mc = []
    for b, c in [(3, 1), (0, 4), (5, 5), (9, 2), (0, 0)]:
        table = [[10, b], [c, 6]]
        mc.append({"b": b, "c": c, "p": f(mcnemar(table, exact=True).pvalue)})
    return {
        "paired_t": {
            "before": before.tolist(),
            "after": after.tolist(),
            "mean": f(d.mean()),
            "lower": f(ci.low),
            "upper": f(ci.high),
            "p": f(res.pvalue),
            "dz": f(d.mean() / d.std(ddof=1)),
        },
        "mcnemar": mc,
    }


def regression() -> dict:
    """An interrupted-time-series design like the Analysis page's, on simulated AR(1) data."""
    rng = np.random.default_rng(2020)
    n = 96
    t = np.arange(n, dtype=float)
    post = (t >= 56).astype(float)
    since = np.where(post == 1, t - 56 + 1, 0.0)
    month = (t % 12).astype(int)
    dummies = np.column_stack([(month == m).astype(float) for m in range(1, 12)])
    e = np.zeros(n)
    for i in range(n):
        e[i] = (0.5 * e[i - 1] if i else 0) + rng.normal(0, 2)
    y = 60 - 0.04 * t + 6 * post + 0.3 * since + dummies @ np.linspace(-3, 3, 11) + e
    X = np.column_stack([np.ones(n), t, post, since, dummies])
    names = ["const", "time", "post", "since"] + [f"m{m}" for m in range(1, 12)]
    lag = int(np.floor(4 * (n / 100) ** (2 / 9)))
    hac = sm.OLS(y, X).fit(cov_type="HAC", cov_kwds={"maxlags": lag, "use_correction": False})
    classical = sm.OLS(y, X).fit()
    c = np.zeros(X.shape[1])
    c[2] = 1
    c[3] = 12
    combo_se = float(np.sqrt(c @ hac.cov_params() @ c))
    resid = classical.resid
    return {
        "x": X.round(12).tolist(),
        "y": y.tolist(),
        "names": names,
        "lag": lag,
        "coef": hac.params.tolist(),
        "se_hac": hac.bse.tolist(),
        "se_classical": classical.bse.tolist(),
        "r2": f(classical.rsquared),
        "combo": {"c": c.tolist(), "estimate": f(c @ hac.params), "se": combo_se},
        "durbin_watson": f(sm.stats.durbin_watson(resid)),
        "acf1": f(sm.tsa.acf(resid, nlags=1, fft=False)[1]),
    }


def funnel() -> dict:
    """Pooled within-group scale and Spiegelhalter's winsorised over-dispersion, by the formulas."""
    rng = np.random.default_rng(3)
    groups = []
    for g in range(9):
        k = int(rng.integers(2, 7))
        m = rng.integers(20, 900, size=k).astype(float)
        mu = rng.normal(0, 0.4)
        y = mu + rng.normal(0, 1, size=k) / np.sqrt(m)
        groups.append({"group": f"g{g}", "logRatio": y.tolist(), "exposure": m.tolist()})
    ss = 0.0
    df = 0
    for gr in groups:
        y = np.asarray(gr["logRatio"])
        m = np.asarray(gr["exposure"])
        mean = (m * y).sum() / m.sum()
        ss += (m * (y - mean) ** 2).sum()
        df += len(y) - 1
    c = float(np.sqrt(ss / df))
    # one cross-section for the over-dispersion estimate
    m = rng.integers(15, 1200, size=40).astype(float)
    y = rng.normal(0, 0.3, size=40) + rng.normal(0, 1, size=40) * c / np.sqrt(m)
    z = y * np.sqrt(m) / c
    lo, hi = np.quantile(z, 0.1), np.quantile(z, 0.9)
    zw = np.clip(z, lo, hi)
    phi = float((zw**2).mean())
    w = m / c**2
    tau2 = max(0.0, (len(z) * phi - (len(z) - 1)) / (w.sum() - (w**2).sum() / w.sum()))
    z95 = stats.norm.ppf(0.975)
    z998 = stats.norm.ppf(0.999)
    limits = []
    for mm in [17, 100, 1150]:
        sd = np.sqrt(c**2 / mm + tau2)
        limits.append(
            {
                "m": mm,
                "lower95": f(np.exp(-z95 * sd)),
                "upper95": f(np.exp(z95 * sd)),
                "lower998": f(np.exp(-z998 * sd)),
                "upper998": f(np.exp(z998 * sd)),
            }
        )
    return {
        "groups": groups,
        "c": c,
        "df": df,
        "cross_section": {"logRatio": y.tolist(), "exposure": m.tolist(), "phi": phi, "tau2": tau2},
        "limits": limits,
    }


def hinge() -> dict:
    """Least-squares broken stick by grid search over observed times (min 12 points per side)."""
    rng = np.random.default_rng(5)
    t = np.array([i for i in range(150) if i not in (60, 61, 62)], dtype=float)
    y = 4000 - 18 * t + 25 * np.maximum(0, t - 95) + rng.normal(0, 30, size=len(t))
    grid = np.sort(t)[11 : len(t) - 12]
    best = None
    for tau in grid:
        X = np.column_stack([np.ones_like(t), t, np.maximum(0, t - tau)])
        coef, *_ = np.linalg.lstsq(X, y, rcond=None)
        rss = float(((y - X @ coef) ** 2).sum())
        if best is None or rss < best[0]:
            best = (rss, tau, coef)
    line = np.polyfit(t, y, 1)
    rss_lin = float(((y - np.polyval(line, t)) ** 2).sum())
    rss, tau, coef = best
    return {
        "t": t.tolist(),
        "y": y.tolist(),
        "tau": f(tau),
        "slope_before": f(coef[1]),
        "slope_after": f(coef[1] + coef[2]),
        "rss": rss,
        "rss_linear": rss_lin,
    }


def dependence() -> dict:
    """Politis-White block lengths (arch), autocorrelations (statsmodels), the pooled within-group
    lag-1 autocorrelation (numpy, by the formula) and binomial upper tails (scipy)."""
    rng = np.random.default_rng(17)
    series = []
    for n, phi in [(189, 0.95), (120, 0.5), (60, 0.0), (300, 0.8)]:
        e = np.zeros(n)
        for i in range(n):
            e[i] = (phi * e[i - 1] if i else 0) + rng.normal(0, 1)
        x = 50 + 0.02 * np.arange(n) + e
        ob = optimal_block_length(x)
        series.append(
            {
                "x": x.tolist(),
                "stationary": f(ob["stationary"].iloc[0]),
                "circular": f(ob["circular"].iloc[0]),
                "acf": [f(v) for v in sm.tsa.acf(x, nlags=12, fft=False)],
            }
        )
    groups = []
    for _ in range(12):
        k = int(rng.integers(2, 11))
        g = np.zeros(k)
        for i in range(k):
            g[i] = (0.5 * g[i - 1] if i else 0) + rng.normal(0, 1)
        groups.append((g + rng.normal(0, 2)).tolist())
    num = 0.0
    den = 0.0
    for g in groups:
        a = np.asarray(g) - np.mean(g)
        num += float((a[1:] * a[:-1]).sum())
        den += float((a**2).sum())
    tails = [
        {"k": k, "n": n, "p": p, "sf": f(stats.binom.sf(k - 1, n, p))}
        for k, n, p in [(39, 48, 0.05), (9, 48, 0.05), (3, 48, 0.05), (0, 10, 0.3), (7, 10, 0.3)]
    ]
    return {"series": series, "groups": groups, "pooled_rho": num / den, "binom_upper": tails}


def main() -> None:
    out = {
        "generated_by": "scripts/stats_reference.py",
        "versions": {
            "numpy": np.__version__,
            "scipy": __import__("scipy").__version__,
            "statsmodels": sm.__version__ if hasattr(sm, "__version__") else __import__("statsmodels").__version__,
            "arch": __import__("arch").__version__,
        },
        "distributions": distributions(),
        "intervals": intervals(),
        "paired": paired(),
        "regression": regression(),
        "funnel": funnel(),
        "hinge": hinge(),
        "dependence": dependence(),
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, separators=(",", ":")) + "\n")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
