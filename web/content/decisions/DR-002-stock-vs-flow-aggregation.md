# DR-002: Average stocks, sum flows

- **Status:** Accepted
- **Date:** 2026-10-09
- **Decision:** Summarise a financial year's flows (NGR, gaming tax, venue share) by adding the months, and its stocks (machines, venues, licences, entitlements, market shares) by the mean of the monthly snapshots or the June value, never by adding them.

## Context

The original Power BI report put a financial-year axis on tables that hold one row per month and used Power BI's default aggregation, Sum, for every field. That is right for NGR, which accumulates over the year. It is wrong for anything counted at a point in time. Twelve monthly machine counts added together give 140,948 "machines" for FY 2024/25, when about 11,750 were in venues; hotel entitlements summed to 137,693 against 11,480 held at the end of the year; Aristocrat's monthly shares summed to more than 500%.

I didn't notice this in 2025 because the report's totals looked like big numbers rather than wrong ones, and the workbook's own INFO pivots (which use "Average of") were never compared with the report.

## Decision

`web/src/lib/statewide.ts`, `licences.ts` and `manufacturers.ts` keep the two kinds of measure apart. Flows are summed over months. Stocks are reported as the mean of the year's months (what the workbook's INFO pivots use) and, where it matters, the June or last-month value. Shares are averaged, with months a manufacturer is absent counted as zero. The Data quality page shows the report's as-built figures next to the corrected ones, and the CSV read-me and the text-to-SQL prompt both state the rule.

## Options considered

- **Keep the report's sums and add a caveat.** Faithful to the 2025 file, but the numbers would still be read as machine counts.
- **June values only.** Matches how CBS often quotes stocks, but throws away eleven months and is fragile when June is unusual (June 2020 had zero machines).
- **Monthly mean, with June alongside (chosen).** The mean is what the workbook already used; June is there when a point-in-time figure is the natural question.

## Why

A machine counted in July is the same machine in August. Adding snapshots counts it twelve times. The mean answers "how many machines were there in a typical month of the year", and NGR divided by that mean gives a sensible NGR per machine.

## What happened

The unit tests check that the statewide as-built sums of machines and venues equal the workbook's own pivot values exactly, and that the licence and manufacturer as-built sums are twelve times the monthly mean for a full year. The corrected FY 2024/25 machine figure (11,746 on average, 11,735 in June) agrees with the separate licence statistics' 11,735 live machines in June 2025.

The rule needs care around the COVID-19 closures. CBS reported zero machines for March to June 2020 while those months still carry NGR, so FY 2019/20's mean machine count is an average over closed and open months, and NGR per machine for that year is left blank rather than computed against an artificially low denominator.

## What I'd change

I would store the measure type (flow or stock) as metadata in the data dictionary and have the code read it, rather than encoding it separately in each module, so a new column can't silently be summed.
