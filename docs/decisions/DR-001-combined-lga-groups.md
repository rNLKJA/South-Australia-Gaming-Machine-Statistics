# DR-001: Keep CBS's combined council groups whole

- **Status:** Accepted
- **Date:** 2026-10-09
- **Decision:** Rebuild every row CBS published from the workbook's per-council rows, show and map combined groups as one area, and never present a member council's equal share of a group as that council's own figure.

## Context

Consumer and Business Services (CBS) publishes net gambling revenue (NGR), machines and venues for each local government area once a year. To protect venue confidentiality it combines councils with few venues into groups: fewer than five venues in the FY 2013/14 to 2021/22 releases, fewer than three from FY 2022/23. In FY 2024/25, 12 of the 48 published areas are groups, holding 10.8% of NGR; before the rule changed, 16 of 44 areas were groups, holding about 20%.

When I built the workbook in 2025 I needed one row per council for a Power BI map, so I divided each group's figures equally between its members. Barunga West and Copper Coast, for example, were published as one row in FY 2013/14 and stored as two rows of half the NGR each. That is why 75 to 79 workbook rows a year sit behind 44 published areas, and why some rows have fractional machine counts such as 85.5. The split is not an observation: CBS never said that the councils in a group were equal, and the point of grouping is that it can't be known.

## Decision

The site groups the workbook rows back together. Rows of one year with an identical NGR and NGR per venue were made by the same split, so they form one published row (`rebuildUnits` in `web/src/lib/lga.ts`, mirrored in `scripts/build_data.py`). Each rebuilt row is mapped to its ABS 2024 council codes through a hand-checked crosswalk, and the map draws a group as one dissolved shape. Tables, downloads and the text-to-SQL database all carry the group as one row with its members listed.

The 2026 analysis follows the same rule. In the funnel plots each group is one point. When the same council belongs to different groups in different years, each composition is its own unit in the year-to-year analysis, so no figure is ever divided.

## Options considered

- **Keep the equal split.** It is the simplest to map and matches the 2025 report, but it invents a figure for every member council and makes small councils look identical.
- **Allocate a group's figures by population or venue counts.** This looks more realistic, but it is still a model of data CBS chose not to publish, and it could be read as revealing what the grouping protects.
- **Leave the groups out.** Clean, but it drops 10% to 20% of state NGR and every small rural council.
- **Rebuild the published rows (chosen).** It matches the releases exactly and needs no assumption beyond the one the split itself made.

## Why

The site's promise is that every figure can be found in a CBS release. Only the rebuilt rows keep that promise. They also make the map honest: a shaded group says "these councils together", which is what CBS published.

## What happened

The rebuilt row counts match the number of rows CBS printed in every year, and every rebuilt NGR figure is found in its PDF except one: Prospect and Walkerville in FY 2015/16, where the workbook is $80.01 higher than the release. For Light and Mallala in FY 2013/14 the split stored 54.5 and 55 machines, which add to 109.5 rather than the printed 109, so the rebuilt group shows 110.

The cost is shorter histories. Group membership changes between years under the same rule (Grant and Mount Gambier were separate in FY 2022/23 and combined again the year after), and the FY 2022/23 rule change broke up several groups. Campbelltown, for instance, appears once inside a group with Tea Tree Gully (eight years) and once on its own (three years). In the analysis of each area's typical ratio to the state rate, 55 units have three or more years, but some have only three, so their intervals are wide.

## What I'd change

I would build a stable analysis geography: the smallest set of council clusters that nests every year's groups, so that all twelve years can be compared on the same units, at the cost of coarser areas. I would also ask CBS for a history of which councils fell under the threshold each year, rather than inferring it from the releases.
