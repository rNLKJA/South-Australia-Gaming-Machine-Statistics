import { annualLicences, licencesAsBuilt } from "./licences"
import { annualManufacturers, manufacturersAsBuilt, monthlyShares } from "./manufacturers"
import { annualStatewide, statewideAsBuilt } from "./statewide"
import type { FY, LicenceMonth, ManufacturerMonth, PowerBiVisual, StatewideMonth } from "./types"

/**
 * How a Power BI field behaves under the default Sum aggregation when the axis is a financial
 * year and the table holds one row per month:
 *  - flow:  a monthly amount (NGR, tax). Summing twelve months gives the annual total. Correct.
 *  - stock: a month-end count (machines, venues, entitlements, licences). Summing twelve snapshots
 *           multiplies the level by about 12. Misleading.
 *  - share: a monthly percentage. Summing twelve shares gives about 12× the share. Misleading.
 *  - split: an LGA field on rows that the workbook split equally across a combined group's names.
 */
export type FieldKind = "flow" | "stock" | "share" | "split"

const FIELD_KINDS: Record<string, { kind: FieldKind; label: string }> = {
  "SA_Gaming_Stats.Net Gambling Revenue (mil)": { kind: "flow", label: "Net gambling revenue" },
  "SA_Gaming_Stats.Gaming Tax Liability (mil)": { kind: "flow", label: "Gaming tax" },
  "SA_Gaming_Stats.Machines": { kind: "stock", label: "Machines" },
  "SA_Gaming_Stats.Venues": { kind: "stock", label: "Venues" },
  "SA_Gaming_Licences.Entitlements Held": { kind: "stock", label: "Entitlements held" },
  "SA_Gaming_Licences.Live Gaming Machine Licences": { kind: "stock", label: "Live licences" },
  "SA_Manufacturer.% of Total": { kind: "share", label: "Manufacturer % of total" },
  "SA_Gaming_Revenue.Number of Gaming Machines": { kind: "split", label: "LGA machines" },
  "SA_Gaming_Revenue.Premises Count": { kind: "split", label: "LGA premises" },
  "SA_Gaming_Revenue.Aggregated NGR by LGA (AUD)": { kind: "split", label: "LGA NGR" },
}

export interface PowerBiField {
  page: string
  visualType: string
  aggregation: string
  field: string
  label: string
  kind: FieldKind
  /** Whether the visual has a time axis (FY), which is what makes summing stocks wrong. */
  byYear: boolean
}

/** Every aggregated value field used by a visual in the original report, classified. */
export function powerBiFields(visuals: PowerBiVisual[]): PowerBiField[] {
  const out: PowerBiField[] = []
  for (const v of visuals) {
    const all = Object.values(v.projections).flat()
    const refs = all.filter((r) => /^\w+\(.+\)$/.test(r))
    // Non-aggregated fields are the axes, rows and columns (a table lists FY as a plain value).
    const axes = all.filter((r) => !refs.includes(r)).join(" ")
    for (const ref of refs) {
      const m = /^(\w+)\((.+)\)$/.exec(ref)
      if (!m) continue
      const [, aggregation, field] = m
      const info = FIELD_KINDS[field]
      if (!info) continue
      out.push({
        page: v.page,
        visualType: v.visualType,
        aggregation,
        field,
        label: info.label,
        kind: info.kind,
        byYear: /Financial Year|\.FY\b/.test(axes),
      })
    }
  }
  return out
}

export interface AsBuiltComparison {
  page: string
  measure: string
  fy: FY
  asBuilt: number
  corrected: number
  correctedMethod: string
  unit: "count" | "share" | "money"
}

/** Side-by-side numbers for one financial year: Power BI's Sum versus a mean of snapshots. */
export function asBuiltComparisons(
  fy: FY,
  data: {
    statewide: StatewideMonth[]
    licences: LicenceMonth[]
    manufacturers: ManufacturerMonth[]
  }
): AsBuiltComparison[] {
  const sw = statewideAsBuilt(data.statewide).find((r) => r.fy === fy)
  const swYear = annualStatewide(data.statewide).find((r) => r.fy === fy)
  const out: AsBuiltComparison[] = []
  if (sw && swYear) {
    out.push(
      {
        page: "SA Gaming Statistics",
        measure: "Net gambling revenue ($m)",
        fy,
        asBuilt: sw.ngr,
        corrected: swYear.ngr ?? NaN,
        correctedMethod: "Sum of months (correct for a flow)",
        unit: "money",
      },
      {
        page: "SA Gaming Statistics",
        measure: "Machines",
        fy,
        asBuilt: sw.machines,
        corrected: swYear.machinesMean ?? NaN,
        correctedMethod: "Mean of monthly counts",
        unit: "count",
      },
      {
        page: "SA Gaming Statistics",
        measure: "Venues",
        fy,
        asBuilt: sw.venues,
        corrected: swYear.venuesMean ?? NaN,
        correctedMethod: "Mean of monthly counts",
        unit: "count",
      }
    )
  }
  const ent = licencesAsBuilt(data.licences, "entitlements").find(
    (r) => r.fy === fy && r.category === "Hotels"
  )
  const entMean = annualLicences(data.licences, "entitlements").find(
    (r) => r.fy === fy && r.category === "Hotels"
  )
  if (ent && entMean?.mean != null) {
    out.push({
      page: "SA Gaming Licences",
      measure: "Entitlements held · Hotels",
      fy,
      asBuilt: ent.sum,
      corrected: entMean.mean,
      correctedMethod: "Mean of monthly snapshots",
      unit: "count",
    })
  }
  const live = licencesAsBuilt(data.licences, "liveLicences").find(
    (r) => r.fy === fy && r.category === "Hotels"
  )
  const liveMean = annualLicences(data.licences, "liveLicences").find(
    (r) => r.fy === fy && r.category === "Hotels"
  )
  if (live && liveMean?.mean != null) {
    out.push({
      page: "SA Gaming Licences",
      measure: "Live licences · Hotels",
      fy,
      asBuilt: live.sum,
      corrected: liveMean.mean,
      correctedMethod: "Mean of monthly snapshots",
      unit: "count",
    })
  }
  const pct = manufacturersAsBuilt(data.manufacturers)["Aristocrat"]?.[fy]
  const share = annualManufacturers(monthlyShares(data.manufacturers)).find((r) => r.fy === fy)
  if (pct != null && share) {
    out.push({
      page: "SA Gaming Manufacturer",
      measure: "% of total · Aristocrat",
      fy,
      asBuilt: pct,
      corrected: share.shares["Aristocrat"] ?? NaN,
      correctedMethod: "Mean of monthly shares",
      unit: "share",
    })
  }
  return out
}
