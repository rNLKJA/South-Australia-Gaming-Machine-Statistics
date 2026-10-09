# DR-005: Specify the trend, council and concentration analyses

- **Status:** Accepted
- **Date:** 2026-10-09
- **Decision:** Use real dollars and a segmented regression with Newey–West errors for the 2020 break, log-scale funnel limits scaled by year-to-year variation for councils, and a broken-stick fit with a moving-block bootstrap for market concentration; fix every seed at 20090701.

## Context

The 2026 upgrade adds uncertainty to figures that are a census. CBS reports every machine and every dollar, so there is no sampling error in the textbook sense. The useful questions are about variation: is a change bigger than month-to-month noise, is a council's rate further from the state's than its size would explain, did a trend really turn. Each method below had real alternatives, and the choices change the numbers.

## Decision

**Interrupted time series.** Monthly NGR from July 2015 to June 2025 in average FY 2024/25 dollars, leaving out March to June 2020. The model has a linear trend, a level change and a slope change from July 2020, and eleven calendar-month effects. Standard errors are Newey–West with the rule-of-thumb lag floor(4 (n/100)^(2/9)) = 4, and intervals use t on n − 15 degrees of freedom. Three sensitivity specifications (nominal dollars, short lockdowns left out, NGR per machine) are shown next to it.

**Councils.** Each area's NGR per machine is divided by the state rate of the same year, and the funnel limits are the state rate × exp(± z · c / √machines). The scale c is pooled from every area's year-to-year variation, and a second set of limits adds Spiegelhalter's between-area variance τ². Each area's typical ratio is a geometric mean across years with a t interval.

**Concentration.** A continuous two-segment line through the monthly HHI, with the break found by least squares (at least 24 months each side) and a moving-block bootstrap (blocks of 6 months, 1,000 resamples) for the break and both slopes. Annual HHI and NGR per machine get percentile bootstrap intervals over months (2,000 resamples).

## Options considered

- **Nominal or real dollars for the break.** Nominal keeps the published figures, but post-2021 inflation then looks like a steeper post-COVID trend. Real is primary; nominal is shown as a sensitivity row.
- **Bootstrap or Newey–West for the regression.** A block bootstrap would also allow for autocorrelation, but Newey–West is standard, has a closed form, and can be checked exactly against statsmodels.
- **Funnel variance: Poisson-like, additive or proportional.** NGR isn't a count, so Poisson limits don't apply. A check across 44 areas showed that the standard deviation of an area's log ratio falls with size at a slope of −0.51 (95% CI −0.68 to −0.34), close to the −0.5 that proportional (log-scale) variance implies, so the limits are on the log scale.
- **Funnel scale from the cross-section or from years.** Estimating c from the spread between councils would make about 5% of areas fall outside by construction. Estimating it from each area's own year-to-year movement gives limits that mean something independent of the cross-section.
- **Change point: mean shift (CUSUM, binary segmentation) or broken stick.** The HHI series falls and then rises, so a mean-shift method would cut a trend into steps. A broken stick asks the actual question: when did the direction change.

## Why

Each choice answers the question the page asks, can be explained in a sentence, and can be checked against a reference implementation (statsmodels for the regression, numpy for the funnel formulas and the grid search, R for STL).

## What happened

The primary interrupted time series puts the level change at reopening at +$9.3m a month (95% CI +$5.8m to +$12.8m) and the trend change at +$3.4m a year (+$2.2m to +$4.6m). The direction holds in every specification, but the size moves: leaving out the two lockdown months raises the level change to +$11.0m, and in nominal dollars the trend change is +$5.5m a year. The residuals keep a lag-1 autocorrelation of 0.39 (0.60 when the lockdown months are left out), which is what Newey–West is for, but the lag-4 window may still be short for that much persistence.

In the councils, 39 of 48 areas sit outside the year-to-year 95% limits in FY 2024/25, so the funnel mostly shows that council differences are lasting rather than noise. With the between-area variance added, 9 areas are outside, all of them below the state rate. That is useful, but the second set of limits partly re-estimates what it then tests, so I describe it as "unusual among councils", not as a significance test.

The HHI breaks in December 2015 (95% CI September 2015 to March 2016): −224 points a year before, +36 after. The interval treats the two-line shape as given, so it is narrower than an honest "when did it turn" interval would be under a smoother model.

## What I'd change

I would fit the interrupted time series with an explicit ARMA error model as a second check on the Newey–West intervals, given the residual autocorrelation. For councils I would add covariates CBS doesn't publish but the ABS does (population, socio-economic index) to see how much of the spread they explain. For concentration I would compare the broken stick with a smooth spline to show how much the "turning point" depends on the two-line assumption.
