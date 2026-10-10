/**
 * The read-only SQL database behind "Ask the data": the eight tidy tables from Downloads, loaded
 * into SQLite in the visitor's browser. This module describes them (for the schema browser and
 * for the language model's prompt) and holds no data itself, so client components can import it.
 */

export type SqlType = "INTEGER" | "REAL" | "TEXT"

export interface SchemaColumn {
  name: string
  type: SqlType
  /** Distinct values of a low-cardinality text column (at most eight). */
  values?: string[]
}

export interface SchemaTable {
  /** SQL table name, e.g. statewide_monthly (the CSV file name with underscores). */
  name: string
  /** The CSV file it mirrors on /downloads. */
  file: string
  title: string
  description: string
  rows: number
  columns: SchemaColumn[]
}

export function tableNameForFile(file: string): string {
  return file.replace(/\.csv$/, "").replace(/-/g, "_")
}

/**
 * Facts the model cannot see in the column names. They restate the site's own rules (stocks are
 * averaged, never summed; combined council groups stay whole), so the model follows them too.
 */
export const DOMAIN_NOTES = `Domain notes:
- financial_year is TEXT such as '2024-25' (1 July 2024 to 30 June 2025). month is TEXT 'YYYY-MM'.
- The statewide tables have no months for FY 2014-15 (no release archived); statewide_annual keeps a 2014-15 row with months_reported = 0 and NULL figures.
- *_aud_million columns are nominal $ million. *_real_fy2024_25 columns are in average FY 2024/25 dollars (ABS CPI, Adelaide). lga_published_areas.ngr_aud and ngr_per_venue_aud are in dollars.
- NGR (net gambling revenue: player losses), gaming tax and venue share are flows: add months to get a year. Machines, venues, licences and entitlements are point-in-time counts: summarise a year with AVG over its months or the June value, never SUM.
- Venues closed from late March to June 2020 (FY 2019-20): statewide machines are 0 for March to June 2020, and lga_published_areas.machines is NULL for FY 2019-20.
- lga_published_areas has one row per area CBS published. kind is 'single', 'split' or 'group'. A 'group' combines several councils (member_councils, separated by '; '); its figures belong to the whole group and must never be divided between members. NGR per machine for an area is ngr_aud / machines.
- licences tables: category is 'Hotels', 'Clubs', 'Special Circumstances' or 'Casino'. Licence statistics for July to September 2017 are missing.
- manufacturers_monthly.share_recomputed is a fraction between 0 and 1 computed from the machine counts; share_printed is the share CBS printed. Manufacturer reports for October to December 2023 are missing.
- hhi is the Herfindahl-Hirschman index on a 0 to 10,000 scale.`

/** "described": titles, descriptions, types, sample values and domain notes. "bare": names only. */
export type PromptVariant = "described" | "bare"

export const PROMPT_VARIANTS: { value: PromptVariant; label: string; note: string }[] = [
  {
    value: "described",
    label: "Described schema",
    note: "Table descriptions, column types, sample values and the domain notes.",
  },
  {
    value: "bare",
    label: "Bare schema",
    note: "Table and column names only: an ablation that shows what the notes are worth.",
  },
]

export function describeSchema(tables: readonly SchemaTable[], variant: PromptVariant): string {
  if (variant === "bare") {
    return tables.map((t) => `${t.name}(${t.columns.map((c) => c.name).join(", ")})`).join("\n")
  }
  return tables
    .map((t) => {
      const cols = t.columns
        .map(
          (c) =>
            `  - ${c.name} ${c.type}${
              c.values?.length ? ` (values: ${c.values.map((v) => `'${v}'`).join(", ")})` : ""
            }`
        )
        .join("\n")
      return `${t.name}: ${t.title}, ${t.rows.toLocaleString("en-AU")} rows. ${t.description}\n${cols}`
    })
    .join("\n\n")
}
