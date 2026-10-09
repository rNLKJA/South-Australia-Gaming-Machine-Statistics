import type { Metadata } from "next"

import { Callout } from "@/components/common/callout"
import { PageHeader, SectionHeading } from "@/components/common/page-header"
import { Stat } from "@/components/common/stat"
import {
  ManufacturerExplorer,
  type ShareSeries,
} from "@/components/manufacturers/manufacturer-explorer"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { manufacturers } from "@/lib/data"
import { fmtInt, fmtPct } from "@/lib/format"
import { fyLabel, fyRange, monthLabel, monthsOfFy } from "@/lib/fy"
import {
  annualManufacturers,
  leadingMakers,
  missingManufacturerMonths,
  monthlyShares,
} from "@/lib/manufacturers"

export const metadata: Metadata = {
  title: "Manufacturers",
  description:
    "Gaming machine manufacturers' share of South Australia's machines and the Herfindahl–Hirschman concentration index, monthly from July 2009 to June 2025.",
}

function buildSeries(merge: boolean): ShareSeries {
  const months = monthlyShares(manufacturers, merge)
  const byMonth = new Map(months.map((m) => [m.month, m]))
  const all = fyRange("2009-10", "2024-25").flatMap(monthsOfFy)
  return {
    leaders: leadingMakers(months),
    monthly: all.map((month) => {
      const m = byMonth.get(month)
      return { month, shares: m?.shares ?? null, hhi: m?.hhi ?? null }
    }),
    annual: annualManufacturers(months).map((a) => ({
      fy: a.fy,
      shares: a.shares,
      hhi: a.hhi,
      months: a.months,
    })),
  }
}

export default function ManufacturersPage() {
  const published = buildSeries(false)
  const merged = buildSeries(true)
  const years = annualManufacturers(monthlyShares(manufacturers))
  const first = years[0]
  const last = years.at(-1)!
  const leaders = published.leaders.slice(0, 8)
  const missing = missingManufacturerMonths(manufacturers)
  const lastMerged = merged.annual.at(-1)!
  const low = years.reduce((a, b) =>
    (b.shares["Aristocrat"] ?? 1) < (a.shares["Aristocrat"] ?? 1) ? b : a
  )

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <PageHeader kicker="Manufacturers" title="Who makes South Australia’s gaming machines">
        <p>
          CBS’s monthly market reports count the machines in the field by manufacturer. A handful of
          makers have always supplied almost all of them. Aristocrat’s share fell from about half in
          FY 2009/10 to {fmtPct(low.shares["Aristocrat"], 0)} in {fyLabel(low.fy)}, then climbed
          back to {fmtPct(last.shares["Aristocrat"], 0)}.
        </p>
      </PageHeader>

      <section
        aria-label={fyLabel(last.fy)}
        className="mb-10 grid grid-cols-2 gap-6 md:grid-cols-4"
      >
        <Stat
          label={`Aristocrat share, ${fyLabel(last.fy)}`}
          value={fmtPct(last.shares["Aristocrat"])}
          detail={`${fmtPct(first.shares["Aristocrat"])} in FY 2009/10`}
          accent="terracotta"
        />
        <Stat
          label="IGT share"
          value={fmtPct(last.shares["IGT"])}
          detail={`${fmtPct(first.shares["IGT"])} in FY 2009/10`}
          accent="teal"
        />
        <Stat
          label="HHI (mean of months)"
          value={fmtInt(last.hhi)}
          detail={`${fmtInt(first.hhi)} in FY 2009/10`}
          accent="ochre"
        />
        <Stat
          label="Makers listed"
          value={fmtInt(last.makers)}
          detail={`${fmtInt(first.makers)} in FY 2009/10`}
        />
      </section>

      <ManufacturerExplorer published={published} merged={merged} />

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <Callout title="Names that change" tone="caution">
          Stargames, SGS (Scientific Games) and Light &amp; Wonder are successive names in one
          corporate line, and CBS’s label for the same machines changes between months (it even
          flips back for October to December 2024). The figures default to the names as published;
          combining them gives the lineage a{" "}
          {fmtPct(lastMerged.shares["Light & Wonder (incl. SGS, Stargames)"])} share in{" "}
          {fyLabel(last.fy)}.
        </Callout>
        <Callout title="Gaps and small inconsistencies" tone="caution">
          {missing.map(monthLabel).join(", ")} are missing: the archived file named “2023-24 Q2”
          repeats the first quarter. In February 2010, October 2011 and November 2022 the printed
          shares or totals don’t add up exactly; shares here are recomputed from the machine counts
          so each month sums to 100%.
        </Callout>
        <Callout title="Machines in the field">
          CBS notes that each month’s total is slightly higher than the number of live machines at
          month end, because machines installed and removed during the month are both counted.
        </Callout>
        <Callout title="Why not add up the shares?">
          The original Power BI page summed the monthly “% of Total” across each year, which gives
          figures such as {fmtPct(last.shares["Aristocrat"] * 12, 0)} for Aristocrat. This page
          averages the months instead.
        </Callout>
      </div>

      <section className="mt-14" aria-labelledby="maker-table">
        <SectionHeading id="maker-table" kicker="Table" title="Mean share by financial year">
          <p>Names as published. Months in which a maker is not listed count as zero.</p>
        </SectionHeading>
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead scope="col">Financial year</TableHead>
                {leaders.map((m) => (
                  <TableHead key={m} scope="col" className="text-right">
                    {m}
                  </TableHead>
                ))}
                <TableHead scope="col" className="text-right">
                  Other
                </TableHead>
                <TableHead scope="col" className="text-right">
                  HHI
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {years.map((y) => {
                const other = Object.entries(y.shares)
                  .filter(([k]) => !leaders.includes(k))
                  .reduce((s, [, v]) => s + v, 0)
                return (
                  <TableRow key={y.fy}>
                    <TableHead scope="row" className="font-medium whitespace-nowrap">
                      {fyLabel(y.fy)}
                      {y.months < 12 ? (
                        <span className="ml-1.5 text-xs font-normal text-ochre-ink">
                          {y.months} months
                        </span>
                      ) : null}
                    </TableHead>
                    {leaders.map((m) => (
                      <TableCell key={m} className="tabular text-right">
                        {y.shares[m] ? fmtPct(y.shares[m]) : "–"}
                      </TableCell>
                    ))}
                    <TableCell className="tabular text-right">{fmtPct(other)}</TableCell>
                    <TableCell className="tabular text-right font-medium">
                      {fmtInt(y.hhi)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  )
}
