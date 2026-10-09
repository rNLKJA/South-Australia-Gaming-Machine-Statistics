# Model card

This site has no trained machine-learning model. It has three statistical models on the Analysis pages and one AI feature that uses a third-party language model. This card describes all four.

## 1. Interrupted time series of monthly NGR

- **Intended use:** describing how statewide net gambling revenue (NGR) changed in level and trend after the 2020 venue closures, with intervals.
- **Data:** CBS statewide monthly NGR, July 2015 to June 2025, in average FY 2024/25 dollars (ABS CPI, Adelaide); March to June 2020 left out; n = 116 months (56 before, 60 after).
- **Model:** segmented regression with a linear trend, a level change and a slope change from July 2020, and calendar-month effects; Newey–West standard errors (lag 4); 95% t intervals.
- **Evaluation:** coefficients and standard errors match statsmodels to 1e-9 on a simulated design (`scripts/stats_reference.py`). R² is 0.77 for the primary specification. Three sensitivity specifications are shown with it.
- **Results:** level change at reopening +$9.3m a month (95% CI +$5.8m to +$12.8m); trend change +$3.4m a year (+$2.2m to +$4.6m).
- **Known failure modes:** residual autocorrelation (lag-1 about 0.4) may be under-corrected by a lag-4 window; the linear pre-trend is an assumption; the model cannot attribute the break to the closures rather than to other changes in 2020 and 2021.

## 2. Council funnel limits and ratios

- **Intended use:** showing which council areas' NGR per machine differs from the state rate by more than their size would explain, so small councils are not over-read.
- **Data:** CBS LGA releases FY 2013/14 to FY 2024/25 without FY 2019/20 (no machine counts); 44 to 49 published areas a year, combined groups kept whole.
- **State rate:** the published areas' total NGR divided by their total machines at 30 June, the same basis as each area's own rate (CBS publishes council machine counts at 30 June). It is not the Statewide page's NGR per machine, which divides by the year's mean machine count ([DR-002](decisions/DR-002-stock-vs-flow-aggregation.md)): $85,936 against $85,858 in FY 2024/25.
- **Model:** log(area rate / state rate) has variance c² / machines, with c = 1.05 pooled from each area's year-to-year variation (437 degrees of freedom); optional between-area variance τ² (Spiegelhalter 2005, 10% winsorisation). Each area's typical ratio has a t interval across its years, widened by 1.58 for the lag-1 autocorrelation of 0.43 within areas.
- **Evaluation:** the formulas match an independent numpy implementation to 1e-12. The variance assumption is checked on the data: the standard deviation of the log ratio falls with size at a slope of −0.51 (95% CI −0.68 to −0.34) against an assumed −0.5.
- **Results:** in FY 2024/25, 39 of 48 areas fall outside the year-to-year 95% limits, where chance alone would put about 2.4; with the between-area variance, 9. Of 55 areas with three or more years, 14 are consistently above the state rate, 34 below and 7 unclear.
- **Known failure modes:** areas that change CBS group have short histories; a council's rate reflects its venues, not its residents; the over-dispersed limits are estimated from the same areas they are used to judge; the dependence adjustment uses one pooled autocorrelation, estimated from short series, for every area.

## 3. Broken-stick change point in market concentration

- **Intended use:** dating the turn from falling to rising manufacturer concentration (HHI).
- **Data:** CBS monthly manufacturer counts, 189 months from July 2009 to June 2025 (October to December 2023 missing).
- **Model:** continuous two-segment linear fit with the break chosen by least squares (at least 24 months each side); moving-block bootstrap of residuals (1,000 resamples, seed 20090701) for the break and both slopes, with 20-month blocks chosen from the residuals by Politis and White's automatic rule.
- **Evaluation:** the grid search matches numpy exactly on a simulated series, and the block-length rule matches the Python `arch` package. The two-segment fit leaves 96% less squared error than one line. The residuals' autocorrelation is 0.96 at lag 1 and 0.33 at lag 12; the page shows the break's interval for 6-, 12-, 20- and 24-month blocks.
- **Results:** break in December 2015 (95% CI August 2015 to June 2016); −224 points a year before, +36 after.
- **Known failure modes:** the interval assumes the two-line shape; a smooth turn would give a wider range of plausible turning points. Block bootstraps assume stationary residuals, and the October to December 2023 gap is treated as if the months were consecutive.

## 4. Text-to-SQL ("Ask the data")

- **Intended use:** turning a plain-English question about these tables into one read-only SQLite query that the visitor reviews before running. Optional: the site works fully without it.
- **Models:** chosen by the visitor and called with the visitor's own key, directly from the browser. Defaults: Anthropic Claude Haiku 4.5 (`claude-haiku-4-5`); Claude Sonnet 5.5 (`claude-sonnet-5-5`, low effort, server-side refusal fallback) as an option; or any OpenAI Chat Completions model with JSON-schema output (default `gpt-5-mini`).
- **Training data:** not known to this site; the providers' own model documentation applies. No data from this site is used to train anything.
- **Inputs sent to the provider:** the question, a system prompt with the table schema and domain notes. No personal data, no key in the prompt. The audit log records a SHA-256 hash of the system prompt and output schema, and the site build, with every call.
- **Evaluation:** 28 fixed questions with reference SQL: 20 answerable in three categories (look-up, aggregate or join, needs a domain rule) and 8 that should be declined. The prompt's rule for declining names no examples, but its first sentence states the scope (South Australian gaming-machine statistics, FY 2009-10 to FY 2024-25), and three of the 8 lean on it (another state, online betting, a forecast). The other 5 are reported separately as the cleaner test of declining. Execution accuracy has a Wilson interval over the questions. The question set can be repeated three times, because model output varies between calls; each question then scores its pass rate, the interval stays a Wilson interval over the 28 questions (repeats don't narrow it), and the run-to-run spread is shown separately ([DR-006](decisions/DR-006-evaluation-unit-is-the-question.md)). Runs are compared question by question (bootstrap difference, plus McNemar's exact test for two single runs), and a "bare schema" ablation shows what the domain notes are worth. No accuracy figure is published because the site has no budget to run it; visitors can run it with their own key and export the results.
- **Safeguards:** a token-level allow-list, a read-only database, a five-second limit and a 500-row cap; the SQL is shown and editable before anything runs; outputs are labelled AI-generated or AI-assisted; every call is in the AI log with the visitor's decision.
- **Known failure modes:** plausible queries that answer a different question (for example summing monthly machine counts, or dividing a combined group); misreading financial years; answering questions the data can't answer instead of declining; provider errors and browser network blocks (CORS).

## Ethical considerations

The subject is gambling. None of these models measures harm, and none is suitable for decisions about individual venues or people. The AI feature is told not to give advice about gambling, and the support line is shown on every page. The AI use statement on the Methods page sets out what the AI does and never does; it is informed by the Australian Government's policy for the responsible use of AI in government, the EU AI Act's transparency principles and the NIST AI Risk Management Framework, without claiming compliance with any of them.
