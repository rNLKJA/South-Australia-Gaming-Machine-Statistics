# Original archive (September 2025)

This folder is the original version of the project, moved here unchanged with `git mv` so the file
history is kept. The revived website in [`../web`](../web) is built from these files by the scripts
in [`../scripts`](../scripts).

| Path                                                    | What it is                                                                                    |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `SA Gaming Data/`                                       | The Consumer and Business Services (CBS) PDF releases, archived by report family (see below). |
| `SA Gaming Statistics.xlsx`                             | The consolidated workbook transcribed from those PDFs: one sheet per family plus `INFO`.      |
| `SA Gaming Dashboard.pbix`                              | The Power BI report built on the workbook.                                                    |
| `README-2025.md`                                        | The repository README as it stood in 2025.                                                    |
| `_archive/README.original.md`                           | The very first README.                                                                        |

## The four PDF families

The PDFs are public releases from Consumer and Business Services, Government of South Australia
(<https://www.cbs.sa.gov.au/sections/LGL/gaming-statistics>). They are kept here as the evidence
trail for the workbook. The website never serves them.

| Folder                                    | Release                                                     | Files                                                                                                   |
| ----------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `Gaming Statistics Statewide/`            | Monthly statewide NGR, gaming tax, venue share, machines and venues, one PDF per financial year | FY 2009-10 to FY 2024-25; **FY 2014-15 is missing**                              |
| `Gaming Manufacturer’s Market Reports /`  | Machines in the field by manufacturer, monthly (note the curly apostrophe and the trailing space in the folder name) | FY 2009-10 to FY 2024-25; 2023-24 is quarterly, and the file named `2023-24 Q2.pdf` actually repeats Quarter 1 |
| `Gaming Machine License Statistics/`      | Licences, entitlements, live licences and live machines by licence category, monthly, one PDF per quarter | 2009-10 Q1 to 2024-25 Q4; **2017-18 Q1 is missing**                    |
| `Gaming Machine Revenue by ABS LGA/`      | Annual NGR, NGR per venue, machines and premises by Local Government Area (small councils are published as combined groups) | FY 2013-14 to FY 2024-25                         |

## The workbook

`SA Gaming Statistics.xlsx` flattens the PDFs into tidy sheets:

| Sheet                          | Rows  | Columns                                                                                                    |
| ------------------------------ | ----- | ---------------------------------------------------------------------------------------------------------- |
| `INFO`                         | –     | Data dictionary, coverage notes, citation guidance and the pivot tables used to check the Power BI pages  |
| `Gaming Machine Licence`       | 642   | Date, Financial Year, Category (Hotels / Clubs / Special Circumstances / Casino), Gaming Machine Licences, Entitlements Held, Live Gaming Machine Licences, Live Machines |
| `Gaming Manufacturer’s Market` | 1,633 | Quarter, Month, Year, Financial Year, Manufacturer, No. of GMs, % of Total, Month Total GMs               |
| `Gaming Statistics Statewide`  | 180   | Quarter, Month Label, Month Start Date, Financial Year, Net Gambling Revenue (mil), Gaming Tax Liability (mil), Venue Share (mil), Machines, Venues |
| `Gaming Machine Revenue`       | 913   | Local Government Area (LGA), Aggregated NGR by LGA (AUD), Average NGR per Venue (AUD), Number of Gaming Machines, Premises Count, Financial Year |

Two things to know before using the LGA sheet directly:

- Where CBS published a combined group (for example "Barunga West, Copper Coast"), the workbook
  repeats the group's figures across each member name after dividing them equally. Those per-council
  numbers are an equal split, not an observation. The same happens to single councils whose name
  contains a comma or slash (for example "Norwood Payneham & St Peters" became three rows).
- The sheet's used range is padded to about a million rows, so read only the non-empty rows.

## The Power BI report

`SA Gaming Dashboard.pbix` has four pages: **SA Gaming Licences**, **SA Gaming Revenue by LGA**,
**SA Gaming Manufacturer** and **SA Gaming Statistics**. Several visuals use the default `Sum`
aggregation on stock measures (entitlements held, live licences, machines, venues and manufacturer
`% of Total`), which adds up twelve monthly snapshots per financial year. The website shows mean
and end-of-year values instead and explains the difference on its Data quality page.

## How to open the originals

1. Read any PDF directly from `SA Gaming Data/`.
2. Open `SA Gaming Statistics.xlsx` in Excel, LibreOffice or Numbers.
3. Open `SA Gaming Dashboard.pbix` in [Power BI Desktop](https://powerbi.microsoft.com/desktop/)
   (Windows). If you refresh it, point the data source at your local copy of the workbook.

To regenerate the website's data from these files, see the root [README](../README.md#how-the-data-is-generated).
