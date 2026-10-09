import "server-only"

import { realTermsFactor } from "./cpi"
import { toCsv, type CsvColumn } from "./csv"
import { cpi, crosswalk, licences, lgaUnits, manufacturers, meta, statewide } from "./data"
import { annualLicences, LICENCE_MEASURES } from "./licences"
import { monthlyShares } from "./manufacturers"
import { site } from "./site"
import { round } from "./stats"
import { annualStatewide } from "./statewide"

export type Cell = string | number | boolean | null | undefined

export interface Download {
  file: string
  title: string
  description: string
  rows: number
  columns: string[]
  body: () => string
  /** The same rows as typed cells (CSV tables only), for the browser SQL database on /ask. */
  values?: () => Cell[][]
}

function csv<T>(columns: CsvColumn<T>[], rows: T[]) {
  return {
    columns: columns.map((c) => c.header),
    rows: rows.length,
    body: () => toCsv(columns, rows),
    values: () => rows.map((r) => columns.map((c) => c.value(r))),
  }
}

const BASE_FY = "2024-25"

function statewideMonthly() {
  return csv(
    [
      { header: "month", value: (r) => r.month },
      { header: "financial_year", value: (r) => r.fy },
      { header: "quarter", value: (r) => r.quarter },
      { header: "ngr_aud_million", value: (r) => r.ngr },
      { header: "gaming_tax_aud_million", value: (r) => r.tax },
      { header: "venue_share_aud_million", value: (r) => r.venueShare },
      { header: "machines", value: (r) => r.machines },
      { header: "venues", value: (r) => r.venues },
      {
        header: "ngr_aud_million_real_fy2024_25",
        value: (r) => round(r.ngr * (realTermsFactor(cpi, r.month, BASE_FY) ?? NaN), 4),
      },
    ] satisfies CsvColumn<(typeof statewide)[number]>[],
    statewide
  )
}

function statewideAnnual() {
  const nominal = annualStatewide(statewide)
  const real = new Map(annualStatewide(statewide, { cpi, baseFy: BASE_FY }).map((y) => [y.fy, y]))
  type Y = (typeof nominal)[number]
  return csv(
    [
      { header: "financial_year", value: (y: Y) => y.fy },
      { header: "months_reported", value: (y: Y) => y.months },
      { header: "ngr_aud_million", value: (y: Y) => y.ngr },
      { header: "gaming_tax_aud_million", value: (y: Y) => y.tax },
      { header: "venue_share_aud_million", value: (y: Y) => y.venueShare },
      {
        header: "tax_share_of_ngr",
        value: (y: Y) => (y.taxRate == null ? null : round(y.taxRate, 4)),
      },
      {
        header: "machines_mean_of_months",
        value: (y: Y) => (y.machinesMean == null ? null : round(y.machinesMean, 2)),
      },
      { header: "machines_june", value: (y: Y) => y.machinesJune },
      {
        header: "venues_mean_of_months",
        value: (y: Y) => (y.venuesMean == null ? null : round(y.venuesMean, 2)),
      },
      { header: "venues_june", value: (y: Y) => y.venuesJune },
      {
        header: "ngr_per_machine_aud",
        value: (y: Y) => (y.ngrPerMachine == null ? null : round(y.ngrPerMachine, 2)),
      },
      { header: "ngr_aud_million_real_fy2024_25", value: (y: Y) => real.get(y.fy)?.ngr ?? null },
    ],
    nominal
  )
}

function licencesMonthly() {
  return csv(
    [
      { header: "month", value: (r) => r.month },
      { header: "financial_year", value: (r) => r.fy },
      { header: "category", value: (r) => r.category },
      { header: "licences_granted", value: (r) => r.licences },
      { header: "entitlements_held", value: (r) => r.entitlements },
      { header: "live_licences", value: (r) => r.liveLicences },
      { header: "live_machines", value: (r) => r.liveMachines },
    ] satisfies CsvColumn<(typeof licences)[number]>[],
    licences
  )
}

function licencesAnnual() {
  const byMeasure = Object.fromEntries(
    LICENCE_MEASURES.map((m) => [m.id, annualLicences(licences, m.id)])
  )
  const rows = byMeasure.entitlements
    .filter((r) => r.months > 0)
    .map((r) => {
      const pick = (m: string) =>
        byMeasure[m].find((x) => x.fy === r.fy && x.category === r.category)!
      return { fy: r.fy, category: r.category, months: r.months, endMonth: r.endMonth, pick }
    })
  type R = (typeof rows)[number]
  const cols: CsvColumn<R>[] = [
    { header: "financial_year", value: (r) => r.fy },
    { header: "category", value: (r) => r.category },
    { header: "months_reported", value: (r) => r.months },
    { header: "end_of_year_month", value: (r) => r.endMonth },
  ]
  for (const m of LICENCE_MEASURES) {
    const name = m.label.toLowerCase().replace(/ /g, "_")
    cols.push(
      { header: `${name}_mean`, value: (r) => round(r.pick(m.id).mean ?? NaN, 2) },
      { header: `${name}_end_of_year`, value: (r) => r.pick(m.id).end }
    )
  }
  return csv(cols, rows)
}

function manufacturersMonthly() {
  const shares = new Map(monthlyShares(manufacturers).map((m) => [m.month, m]))
  return csv(
    [
      { header: "month", value: (r) => r.month },
      { header: "financial_year", value: (r) => r.fy },
      { header: "manufacturer", value: (r) => r.manufacturer },
      { header: "machines", value: (r) => r.machines },
      { header: "share_printed", value: (r) => r.pct },
      {
        header: "share_recomputed",
        value: (r) => round(shares.get(r.month)!.shares[r.manufacturer], 6),
      },
      { header: "month_total_printed", value: (r) => r.monthTotal },
    ] satisfies CsvColumn<(typeof manufacturers)[number]>[],
    manufacturers
  )
}

function manufacturerConcentration() {
  const plain = monthlyShares(manufacturers)
  const merged = new Map(monthlyShares(manufacturers, true).map((m) => [m.month, m]))
  type M = (typeof plain)[number]
  return csv(
    [
      { header: "month", value: (m: M) => m.month },
      { header: "financial_year", value: (m: M) => m.fy },
      { header: "manufacturers_listed", value: (m: M) => Object.keys(m.counts).length },
      { header: "machines_listed", value: (m: M) => m.total },
      { header: "hhi", value: (m: M) => round(m.hhi, 1) },
      { header: "hhi_lineage_combined", value: (m: M) => round(merged.get(m.month)!.hhi, 1) },
    ],
    plain
  )
}

function lgaPublished() {
  type U = (typeof lgaUnits)[number]
  return csv(
    [
      { header: "financial_year", value: (u: U) => u.fy },
      { header: "area", value: (u: U) => u.label },
      { header: "kind", value: (u: U) => u.kind },
      { header: "member_councils", value: (u: U) => u.members.join("; ") },
      { header: "abs_lga_2024_codes", value: (u: U) => u.codes.join("; ") },
      { header: "ngr_aud", value: (u: U) => u.ngr },
      { header: "ngr_per_venue_aud", value: (u: U) => u.avgPerVenue },
      { header: "machines", value: (u: U) => u.machines },
      { header: "venues", value: (u: U) => u.premises },
      { header: "workbook_rows", value: (u: U) => u.workbookNames.join("; ") },
    ],
    lgaUnits
  )
}

function lgaCrosswalk() {
  type C = (typeof crosswalk)[number]
  return csv(
    [
      { header: "workbook_name", value: (c: C) => c.workbookName },
      { header: "council", value: (c: C) => c.displayName },
      { header: "abs_lga_2024_name", value: (c: C) => c.absName },
      { header: "abs_lga_2024_code", value: (c: C) => c.absCode },
      { header: "relation", value: (c: C) => c.relation },
      { header: "has_own_boundary", value: (c: C) => c.geometry },
      { header: "financial_years", value: (c: C) => c.years.join("; ") },
      { header: "note", value: (c: C) => c.note },
    ],
    crosswalk
  )
}

export const ATTRIBUTION = `Source: ${site.cbsName}, gaming machine statistics (${site.cbsUrl}), FY 2009/10 to FY 2024/25, as transcribed in the SA Gaming Statistics workbook (${site.repo}). Council boundaries and CPI: Australian Bureau of Statistics, CC BY 4.0. Derived tables by ${site.author}; not affiliated with or endorsed by CBS.`

function readme(files: Download[]) {
  const lines = [
    "SA Gaming Machine Statistics: derived tables",
    "",
    ATTRIBUTION,
    "",
    `Workbook SHA-256: ${meta.workbook.sha256}`,
    `CPI to ${meta.cpiLatestQuarter}. Real-terms columns are in average FY 2024/25 dollars (ABS CPI, All groups, Adelaide).`,
    "",
    "Notes",
    "- FY 2014/15 is missing from the statewide series (no release archived).",
    "- Machines and venues are point-in-time counts: summarise a year by its mean or its June value, never by adding months.",
    "- LGA rows are the areas CBS published. Combined groups are kept whole; never divide them between member councils.",
    "- FY 2019/20 LGA machine counts were not published (left blank).",
    "- Statewide NGR per machine is blank for FY 2019/20: CBS reported zero machines for Mar to Jun 2020 while NGR was still recorded.",
    "- CBS groups councils with fewer than 5 venues (FY 2013/14 to 2021/22) or fewer than 3 (from FY 2022/23), so group compositions change between years.",
    `- Licence statistics for ${["Jul", "Aug", "Sep"].join(", ")} 2017 and manufacturer reports for Oct to Dec 2023 are missing.`,
    "",
    "Files",
    ...files.map(
      (f) => `- ${f.file} (${f.rows} rows): ${f.description}\n  Columns: ${f.columns.join(", ")}`
    ),
    "",
  ]
  return lines.join("\r\n")
}

const TABLES: Omit<Download, "rows" | "columns" | "body">[] = [
  {
    file: "statewide-monthly.csv",
    title: "Statewide, monthly",
    description: "NGR, gaming tax, venue share, machines and venues for every month reported.",
  },
  {
    file: "statewide-annual.csv",
    title: "Statewide, by financial year",
    description:
      "Annual sums of the flows, mean and June values of the stocks, NGR per machine and real-terms NGR.",
  },
  {
    file: "licences-monthly.csv",
    title: "Licences, monthly",
    description:
      "Licences granted, entitlements held, live licences and live machines by licence category.",
  },
  {
    file: "licences-annual.csv",
    title: "Licences, by financial year",
    description: "Mean of months and end-of-year snapshot for every licence measure and category.",
  },
  {
    file: "manufacturers-monthly.csv",
    title: "Manufacturers, monthly",
    description:
      "Machines by manufacturer with the printed share and a share recomputed from the counts.",
  },
  {
    file: "manufacturer-concentration.csv",
    title: "Market concentration, monthly",
    description:
      "Herfindahl–Hirschman index per month, with names as published and with the Light & Wonder lineage combined.",
  },
  {
    file: "lga-published-areas.csv",
    title: "Councils, by financial year",
    description:
      "One row per area CBS published, with combined groups kept whole, ABS 2024 LGA codes and the workbook rows they came from.",
  },
  {
    file: "lga-crosswalk.csv",
    title: "Council name crosswalk",
    description:
      "Every council name in the workbook mapped to an ABS 2024 Local Government Area, with the reason.",
  },
]

const BUILDERS: Record<string, () => ReturnType<typeof csv>> = {
  "statewide-monthly.csv": statewideMonthly,
  "statewide-annual.csv": statewideAnnual,
  "licences-monthly.csv": licencesMonthly,
  "licences-annual.csv": licencesAnnual,
  "manufacturers-monthly.csv": manufacturersMonthly,
  "manufacturer-concentration.csv": manufacturerConcentration,
  "lga-published-areas.csv": lgaPublished,
  "lga-crosswalk.csv": lgaCrosswalk,
}

export function downloads(): Download[] {
  const files = TABLES.map((t) => ({ ...t, ...BUILDERS[t.file]() }))
  const readmeFile: Download = {
    file: "README.txt",
    title: "Read me",
    description: "Attribution, notes and the column list for every file.",
    rows: 0,
    columns: [],
    body: () => readme(files),
  }
  return [...files, readmeFile]
}

export function downloadByFile(file: string): Download | undefined {
  return downloads().find((d) => d.file === file)
}
