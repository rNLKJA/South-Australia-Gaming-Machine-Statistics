# Methods

How the numbers on this site were made, what they assume and where they fall short. The decision records linked below give the reasoning behind the choices that matter most.

## Data provenance

All gaming figures come from public Consumer and Business Services (CBS) releases for FY 2009/10 to FY 2024/25: the monthly statewide report, quarterly gaming machine licence statistics, the monthly manufacturers' market report and the annual release by local government area. In September 2025 I collected about 110 of those PDFs and transcribed them into one workbook (`original/SA Gaming Statistics.xlsx`); the PDFs, the workbook and the 2025 Power BI report are kept unchanged in `original/`.

`scripts/build_data.py` reads the workbook, rebuilds the council rows CBS published (see [DR-001](decisions/DR-001-combined-lga-groups.md)), maps council names to ABS Local Government Areas 2024 through a hand-checked crosswalk, and adds the ABS consumer price index for Adelaide. `scripts/verify_pdfs.py` looks for every workbook figure in the PDF it came from and finds 4,406 of 4,409. The [data card](data-card.md) describes the resulting tables.

## What the site computes

The explorer pages report the published figures with two corrections: point-in-time counts are averaged rather than summed ([DR-002](decisions/DR-002-stock-vs-flow-aggregation.md)), and combined council groups stay whole. Real-terms dollars use the quarterly Adelaide CPI and are expressed in average FY 2024/25 dollars.

The Analysis pages add:

- **Trend and seasonality.** STL (seasonal-trend decomposition by LOESS) with robustness weights, run separately on the two unbroken parts of the series because FY 2014/15 is missing ([DR-003](decisions/DR-003-fy-2014-15-gap.md)).
- **The 2020 closures.** An interrupted time series (segmented regression with calendar-month effects) on July 2015 to June 2025, with Newey–West standard errors, plus paired comparisons of the same calendar months in two financial years.
- **NGR per machine.** Annual ratios with percentile bootstrap intervals over the year's months.
- **Councils.** Each area's NGR per machine relative to the state rate of the same year, funnel plots with control limits scaled by year-to-year variation, and each area's typical ratio with a t interval across years, widened for the dependence between an area's consecutive years.
- **Market concentration.** Annual Herfindahl–Hirschman index with bootstrap intervals, and a broken-stick change-point fit with a moving-block bootstrap whose block length is chosen from the residuals' autocorrelation.

The model choices are recorded in [DR-005](decisions/DR-005-analysis-design.md).

## Evaluation design

Every statistical helper in `web/src/lib/stats/` is unit-tested against reference values produced by scipy, statsmodels, arch and numpy (`scripts/stats_reference.py`) and by R 4.6 (`scripts/stl_reference.R`): distributions to about 1e-12, Newey–West standard errors to 1e-9, and STL components to eight significant figures. The analysis modules are tested for consistency with the published figures: the bootstrap point estimates equal the Statewide and Manufacturers pages' figures exactly.

The text-to-SQL feature has its own benchmark: 28 fixed questions (20 answerable, 8 that should be declined) with reference SQL. Each reference answer is checked in the unit tests against the figure the site computes in TypeScript. A model passes a question when its query returns the reference values (execution accuracy). The prompt's rule for declining names no examples, so declines measure recognition rather than instruction-following. The prompt's first sentence does state the scope (South Australian gaming-machine statistics, FY 2009-10 to FY 2024-25), so the three should-decline questions that lean on it are reported apart from the other five. Accuracy gets a Wilson interval over the questions. Because model output varies between calls, the set can be repeated; each question then scores its pass rate, the interval is still Wilson's over the questions (asking the same questions again doesn't narrow it), and the run-to-run spread is reported separately. Two runs are compared question by question with a paired bootstrap, and with McNemar's exact test when both are single runs ([DR-004](decisions/DR-004-browser-text-to-sql.md), [DR-006](decisions/DR-006-evaluation-unit-is-the-question.md)). The [model card](model-card.md) covers the statistical models and the text-to-SQL feature.

## Uncertainty conventions

- Proportions get Wilson 95% intervals (including the text-to-SQL accuracy, a mean of per-question pass rates); means of small samples get t intervals; ratios and other statistics get percentile bootstrap intervals.
- Every resampled interval states its number of resamples and its seed. All use seed 20090701 (the first month of the series), so pages are identical on every build.
- Sample sizes are stated next to estimates. Where two periods are compared, the comparison is paired by calendar month.
- Effect sizes come first: differences in dollars with intervals, and the standardised mean difference d_z for paired comparisons. p-values are secondary.

## Assumptions

- The CBS releases are accurate and consistently defined across years, apart from the changes the Data quality page lists.
- Month-to-month variation is a fair yardstick for the stability of annual figures. The data are a census, so intervals describe variation, not sampling error.
- Before the 2020 closures, real NGR followed a linear trend with a fixed seasonal pattern; after reopening the level and slope may change, and nothing else broke at the same time.
- An area's year-to-year swings in NGR per machine are proportional to its rate and shrink like 1/√machines (checked: slope −0.51, 95% CI −0.68 to −0.34, against an assumed −0.5).

## Limitations

- **Causality.** The interrupted time series describes a break in the series; it can't separate the closures from income support, closed alternatives, border closures and inflation in the same months.
- **Short runs.** STL on July 2009 to June 2014 has five cycles. The text-to-SQL benchmark has 28 questions, so its intervals are wide.
- **Autocorrelation.** Residuals of the interrupted time series keep a lag-1 autocorrelation of about 0.4, and the bootstrap over months within a year ignores autocorrelation altogether.
- **Independence assumed in places.** The paired calendar-month comparisons treat their twelve monthly differences as independent, although neighbouring months share trend and shocks, so their intervals are probably too narrow. The council ratios allow for dependence between consecutive years with one pooled lag-1 autocorrelation (0.43), estimated from short series and so more likely too small than too large. The moving-block bootstrap for the concentration break assumes stationary residuals.
- **Group changes.** Councils that move between CBS groups have shorter histories in the council analysis.
- **Not covered.** Venue-level data, the Adelaide Casino's revenue, and anything about who gambles or how much harm results. Nothing here measures harm.

## What I'd change

I would add an ARMA error model as a second check on the regression intervals, a stable council geography that nests every year's groups, ABS covariates (population, socio-economic disadvantage) for the council comparison, and a published run of the text-to-SQL benchmark once there is a small budget for it.
