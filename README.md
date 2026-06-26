<div align="center">

# South Australia Gaming Machine Statistics

**A consolidated archive and Power BI dashboard for South Australia's poker-machine (EGM) statistics**, drawn from the official Consumer and Business Services (CBS) gaming-statistics releases, FY 2009–FY 2025.

[![Power BI](https://img.shields.io/badge/Power%20BI-Dashboard-F2C811?logo=powerbi&logoColor=black)](https://powerbi.microsoft.com/)
[![Excel](https://img.shields.io/badge/Excel-Workbook-217346?logo=microsoftexcel&logoColor=white)](https://www.microsoft.com/microsoft-365/excel)
[![Data](<https://img.shields.io/badge/Data-SA%20Gov%20(CBS)-1f6feb>)](https://www.cbs.sa.gov.au/sections/LGL/gaming-statistics)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

## Overview

South Australia's gambling regulator publishes gaming-machine statistics as a scatter of individual PDF reports — one (or one per quarter) for each financial year, split across several report families. That format makes it hard to see a trend across more than a decade.

This repository pulls those releases together: the **original CBS PDFs** are archived by report family and year, the figures are consolidated into a single **Excel workbook**, and a **Power BI dashboard** (`SA Gaming Dashboard.pbix`) sits on top for interactive exploration of licences, revenue, tax and manufacturer market share over time.

It is a personal data-collection and visualisation project. The PDFs are public South Australian Government documents — always treat the [official CBS portal](https://www.cbs.sa.gov.au/sections/LGL/gaming-statistics) as the authoritative source.

## Highlights

- **16 financial years of coverage** — FY 2009–FY 2025 (LGA revenue series from FY 2013), gathered into one place.
- **Four report families archived** — statewide statistics, manufacturer market reports, gaming-machine licence statistics (quarterly), and gaming-machine revenue by ABS Local Government Area.
- **One consolidated workbook** — `SA Gaming Statistics.xlsx` flattens the PDFs into tidy sheets (licence, manufacturer market, statewide, revenue) ready for analysis.
- **Interactive dashboard** — `SA Gaming Dashboard.pbix` for slicing the consolidated data by year and category.

## Repository Structure

| Path                                                   | Contents                                                   |
| ------------------------------------------------------ | ---------------------------------------------------------- |
| `SA Gaming Data/Gaming Statistics Statewide/`          | Annual statewide gaming statistics (FY 2009–FY 2025)       |
| `SA Gaming Data/Gaming Manufacturer’s Market Reports/` | Annual + recent quarterly manufacturer market reports      |
| `SA Gaming Data/Gaming Machine License Statistics/`    | Quarterly gaming-machine licence statistics                |
| `SA Gaming Data/Gaming Machine Revenue by ABS LGA/`    | Annual gaming-machine revenue by ABS Local Government Area |
| `SA Gaming Statistics.xlsx`                            | Consolidated workbook (INFO + four data sheets)            |
| `SA Gaming Dashboard.pbix`                             | Power BI dashboard built on the consolidated workbook      |
| `_archive/`                                            | Preserved copy of the original README                      |

## Source & Scope

- **Official portal:** <https://www.cbs.sa.gov.au/sections/LGL/gaming-statistics>
- **Jurisdiction:** South Australia
- **Temporal coverage:**
  - Licence, manufacturer and statewide revenue/tax: FY 2009–FY 2025
  - LGA revenue series: FY 2013–FY 2025
- **Financial year:** 1 July – 30 June (e.g. FY 2024/25 → 1 Jul 2024 – 30 Jun 2025).

## Getting Started

1. **Browse the source PDFs** under `SA Gaming Data/` to read any individual CBS release.
2. **Open `SA Gaming Statistics.xlsx`** in Excel (or any spreadsheet tool) for the consolidated, analysis-ready tables.
3. **Open `SA Gaming Dashboard.pbix`** in [Power BI Desktop](https://powerbi.microsoft.com/desktop/) to explore the data interactively. If you refresh, point the data source at your local copy of the workbook.

## License

Released under the [MIT License](LICENSE) for the consolidation and dashboard work. The underlying PDF reports remain © the Government of South Australia (Consumer and Business Services).

<p align="right">2025 @rNLKJA</p>
