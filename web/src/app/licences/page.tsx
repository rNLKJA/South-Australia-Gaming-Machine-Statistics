import type { Metadata } from "next"

import { Callout } from "@/components/common/callout"
import { PageHeader, SectionHeading } from "@/components/common/page-header"
import { Stat } from "@/components/common/stat"
import {
  LicenceExplorer,
  type LicenceAnnualCell,
  type LicenceMonthlyPoint,
} from "@/components/licences/licence-explorer"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { licences } from "@/lib/data"
import { fmtInt } from "@/lib/format"
import { fyLabel, fyRange, monthLabel, monthsOfFy } from "@/lib/fy"
import {
  annualLicences,
  LICENCE_FIRST_FY,
  LICENCE_LAST_FY,
  LICENCE_MEASURES,
  missingLicenceMonths,
  monthlyLicences,
  type LicenceMeasure,
} from "@/lib/licences"
import { LICENCE_CATEGORIES } from "@/lib/types"

export const metadata: Metadata = {
  title: "Licences",
  description:
    "Gaming machine licences, entitlements, live licences and live machines by licence category in South Australia, monthly from July 2009 to June 2025.",
}

export default function LicencesPage() {
  const measures = LICENCE_MEASURES.map((m) => m.id)
  const allMonths = fyRange(LICENCE_FIRST_FY, LICENCE_LAST_FY).flatMap(monthsOfFy)
  const annual = Object.fromEntries(
    measures.map((m) => [
      m,
      annualLicences(licences, m).map((c): LicenceAnnualCell => ({
        fy: c.fy,
        category: c.category,
        mean: c.mean,
        end: c.end,
      })),
    ])
  ) as Record<LicenceMeasure, LicenceAnnualCell[]>
  const monthly = Object.fromEntries(
    measures.map((m) => {
      const byMonth = new Map(monthlyLicences(licences, m).map((p) => [p.month as string, p]))
      return [
        m,
        allMonths.map((month): LicenceMonthlyPoint => {
          const p = byMonth.get(month)
          const out: LicenceMonthlyPoint = { month }
          for (const c of LICENCE_CATEGORIES) out[c] = (p?.[c] as number | null | undefined) ?? null
          return out
        }),
      ]
    })
  ) as Record<LicenceMeasure, LicenceMonthlyPoint[]>

  const ent = annualLicences(licences, "entitlements")
  const live = annualLicences(licences, "liveMachines")
  const liveLic = annualLicences(licences, "liveLicences")
  const fys = fyRange(LICENCE_FIRST_FY, LICENCE_LAST_FY)
  const cell = (rows: typeof ent, fy: string, c: string) =>
    rows.find((r) => r.fy === fy && r.category === c)?.end ?? null
  const total = (rows: typeof ent, fy: string, exclude: string[] = []) =>
    rows
      .filter((r) => r.fy === fy && !exclude.includes(r.category))
      .reduce((s, r) => s + (r.end ?? 0), 0)
  const missing = missingLicenceMonths(licences)
  const last = LICENCE_LAST_FY
  const first = LICENCE_FIRST_FY

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <PageHeader
        kicker="Licences"
        title="Licences, entitlements and the machines actually running"
      >
        <p>
          A venue needs a gaming machine licence and must hold an entitlement for every machine it
          is allowed to operate. Not every entitlement is in use: CBS reports separately the
          licences and machines that are “live”, meaning installed and operating.
        </p>
      </PageHeader>

      <section aria-label="June 2025" className="mb-10 grid grid-cols-2 gap-6 md:grid-cols-4">
        <Stat
          label="Entitlements held, June 2025"
          value={fmtInt(total(ent, last))}
          detail={`${fmtInt(total(ent, first))} in June 2010`}
          accent="terracotta"
        />
        <Stat
          label="Live machines (excluding the casino)"
          value={fmtInt(total(live, last, ["Casino"]))}
          detail={`${fmtInt(total(live, first, ["Casino"]))} in June 2010`}
          accent="teal"
        />
        <Stat
          label="Live hotel licences"
          value={fmtInt(cell(liveLic, last, "Hotels"))}
          detail={`${fmtInt(cell(liveLic, first, "Hotels"))} in June 2010`}
          accent="ochre"
        />
        <Stat
          label="Live club licences"
          value={fmtInt(cell(liveLic, last, "Clubs"))}
          detail={`${fmtInt(cell(liveLic, first, "Clubs"))} in June 2010`}
        />
      </section>

      <LicenceExplorer annual={annual} monthly={monthly} />

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <Callout title="Three months are missing" tone="caution">
          The archive has no release for the first quarter of FY 2017/18, so{" "}
          {missing.map(monthLabel).join(", ")} have no figures. For FY 2017/18 the mean uses the
          nine months available.
        </Callout>
        <Callout title="The casino" tone="caution">
          SkyCity Adelaide holds machine entitlements but no gaming machine licence. The releases
          report its live machines in only a few months (for example 913 in July 2015) and zero in
          every other month, so the casino is best read from its entitlements.
        </Callout>
        <Callout title="Special Circumstances" tone="caution">
          From January to December 2014 the releases show about 1,000 extra Special Circumstances
          entitlements (2,185, then 2,212). In January 2015 the figure falls back to 1,192 and the
          casino appears as its own row with 1,020, so the extra entitlements look like the
          casino’s, reported under Special Circumstances. The category is last reported in FY
          2020/21; hotel entitlements rise over the same two years.
        </Callout>
        <Callout title="Why not add up the months?">
          Every figure here is a month-end snapshot, so a year is summarised by its June value or by
          the mean of its months. The original Power BI page added twelve snapshots together, which
          makes each year about twelve times too large.
        </Callout>
      </div>

      <section className="mt-14" aria-labelledby="licence-table">
        <SectionHeading id="licence-table" kicker="Table" title="End-of-year snapshot by category">
          <p>
            The last month reported in each financial year (June, except where a release is
            missing). Live machine totals exclude the casino; they include Special Circumstances
            venues while that category was reported. June 2020 live machines were reported as zero
            during the COVID-19 closures.
          </p>
        </SectionHeading>
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead scope="col">Financial year</TableHead>
                {LICENCE_CATEGORIES.map((c) => (
                  <TableHead key={c} scope="col" className="text-right">
                    {c === "Special Circumstances" ? "Special circ." : c}
                    <span className="block text-[0.7rem] font-normal text-muted-foreground">
                      entitlements
                    </span>
                  </TableHead>
                ))}
                <TableHead scope="col" className="text-right">
                  Total
                  <span className="block text-[0.7rem] font-normal text-muted-foreground">
                    entitlements
                  </span>
                </TableHead>
                <TableHead scope="col" className="text-right">
                  Live machines
                  <span className="block text-[0.7rem] font-normal text-muted-foreground">
                    excluding casino
                  </span>
                </TableHead>
                <TableHead scope="col" className="text-right">
                  Live licences
                  <span className="block text-[0.7rem] font-normal text-muted-foreground">
                    all categories
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fys.map((fy) => (
                <TableRow key={fy}>
                  <TableHead scope="row" className="font-medium whitespace-nowrap">
                    {fyLabel(fy)}
                  </TableHead>
                  {LICENCE_CATEGORIES.map((c) => (
                    <TableCell key={c} className="tabular text-right">
                      {fmtInt(cell(ent, fy, c))}
                    </TableCell>
                  ))}
                  <TableCell className="tabular text-right font-medium">
                    {fmtInt(total(ent, fy))}
                  </TableCell>
                  <TableCell className="tabular text-right">
                    {fmtInt(total(live, fy, ["Casino"]))}
                  </TableCell>
                  <TableCell className="tabular text-right">{fmtInt(total(liveLic, fy))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  )
}
