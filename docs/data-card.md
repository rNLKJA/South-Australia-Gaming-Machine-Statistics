# Data card: SA gaming machine statistics, tidy tables

## Summary

Eight tidy tables derived from Consumer and Business Services (CBS) gaming machine statistics for South Australia, FY 2009/10 to FY 2024/25, plus the ABS consumer price index for Adelaide and ABS council boundaries. They are the CSV files on the Downloads page and the tables in the browser SQL database on Ask the data.

| Table                        | Rows  | One row per                           |
| ---------------------------- | ----- | ------------------------------------- |
| `statewide_monthly`          | 180   | month (hotels and clubs)              |
| `statewide_annual`           | 16    | financial year                        |
| `licences_monthly`           | 642   | month and licence category            |
| `licences_annual`            | 55    | financial year and licence category   |
| `manufacturers_monthly`      | 1,633 | month and manufacturer                |
| `manufacturer_concentration` | 189   | month                                 |
| `lga_published_areas`        | 541   | financial year and area CBS published |
| `lga_crosswalk`              | 94    | council name used in the workbook     |

## Sources and licence

- **Gaming statistics:** CBS, Government of South Australia, gaming statistics pages. The PDFs were transcribed by hand into `original/SA Gaming Statistics.xlsx` in September 2025. Treat CBS as authoritative. The PDFs carry no licence statement, and I could not confirm CBS's reuse terms (its website blocks automated access). Many South Australian Government websites publish under CC BY 4.0 unless otherwise noted, but I have not confirmed that this covers the gaming statistics, so treat the figures as © Government of South Australia, attribute them to CBS, and check CBS's copyright statement before reusing them.
- **Council boundaries:** Australian Bureau of Statistics, ASGS Edition 3 Local Government Areas 2024, CC BY 4.0.
- **Consumer price index:** ABS, All groups, Adelaide, quarterly, CC BY 4.0.
- **Code and derived tables:** the code (including the transformations that build the tables) is under the MIT licence. The figures in the derived tables remain CBS's and ABS's: their reuse is subject to the source terms above, with attribution. The site is not affiliated with or endorsed by CBS.

## Collection and processing

1. About 110 PDF releases were transcribed into the workbook (four sheets plus an INFO sheet of pivot tables).
2. `scripts/verify_pdfs.py` searches each PDF for the figures transcribed from it: 4,406 of 4,409 values are found. The three exceptions and one image-only PDF are listed on the Data quality page and left as transcribed.
3. `scripts/build_data.py` rebuilds the council rows CBS published from the workbook's equal-split rows, maps 94 council names to ABS 2024 codes, simplifies boundaries, and writes JSON for the site.
4. The CSVs and the SQL tables are generated at build time from that JSON by `web/src/lib/downloads.ts`.

## Crosswalk

Each of the 94 council names in the workbook maps to one ABS Local Government Area. 65 match directly; the rest are spelling variants (3), council-type suffixes (5), renamed councils (2), fragments of one council created by splitting names at commas or slashes (17), and the two parts of the unincorporated area (2). The relation and a note are kept for every name in `lga_crosswalk`.

## Combined council groups

CBS publishes councils with fewer than five venues (FY 2013/14 to 2021/22) or fewer than three (from FY 2022/23) as combined groups. `lga_published_areas` keeps each group as one row (`kind = 'group'`) with its members in `member_councils`; the workbook's equal split is never presented as a council's own figure ([DR-001](decisions/DR-001-combined-lga-groups.md)). Group membership changes between years.

## Gaps and breaks

- No statewide release for FY 2014/15 (all twelve months missing; [DR-003](decisions/DR-003-fy-2014-15-gap.md)).
- Licence statistics for July to September 2017 and manufacturer reports for October to December 2023 are missing.
- FY 2019/20: venues closed from late March 2020; statewide machines are 0 for March to June 2020 and the LGA release has no machine counts.
- Special Circumstances entitlements jump by about 1,000 during 2014 while casino entitlements are first listed separately in January 2015.
- The FY 2021/22 LGA release totals 603 venues against 484 and 488 either side. Shown as published.
- CBS reissued the FY 2022/23 LGA release in January 2024; the archive holds the reissue.

## Known issues

- Three transcription differences (Prospect and Walkerville FY 2015/16, $80.01; Light and Mallala machines FY 2013/14; hotel entitlements April 2025) are kept as transcribed.
- Manufacturer names change within one corporate lineage (Stargames, SGS, Light & Wonder); names are kept as published, with a lineage-combined HHI alongside.
- Machine counts are snapshots and must be averaged, not summed, over months ([DR-002](decisions/DR-002-stock-vs-flow-aggregation.md)).

## Intended use

Describing and comparing gaming-machine activity across time, councils and manufacturers in South Australia, and teaching or checking statistical methods on a small, documented public dataset.

## Not suitable for

Judging individual venues (there are none in the data), measuring gambling harm, or drawing conclusions about individual people. Council figures describe where machines are, not where the people who use them live.

## Ethical considerations

The data concern gambling, which harms many people. The site takes no position for or against gambling and shows the Gambling Help Line (1800 858 858) on every page. CBS groups small councils to protect venue confidentiality; the site keeps those groups whole and does not try to recover the hidden figures.
