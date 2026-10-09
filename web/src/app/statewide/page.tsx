import type { Metadata } from "next"
import Link from "next/link"

import { Callout } from "@/components/common/callout"
import { PageHeader, SectionHeading } from "@/components/common/page-header"
import { Stat } from "@/components/common/stat"
import { StatewideExplorer } from "@/components/statewide/statewide-explorer"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cpiSource, meta } from "@/lib/data"
import { fmtAud, fmtChange, fmtInt, fmtMillions, fmtPct } from "@/lib/format"
import { fyLabel } from "@/lib/fy"
import { BASE_FY, statewideView } from "@/lib/statewide-view"

export const metadata: Metadata = {
  title: "Statewide trends",
  description:
    "Monthly and annual net gambling revenue, gaming tax, venue share, machines and venues for South Australian hotels and clubs, FY 2009/10 to FY 2024/25.",
}

export default function StatewidePage() {
  const view = statewideView()
  const latest = view.annual.at(-1)!
  const first = view.annual[0]
  const realFirst = view.annualReal[0]
  const covid = view.annual.find((y) => y.fy === "2019-20")!
  const baseLabel = fyLabel(BASE_FY)

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <PageHeader kicker="Statewide trends" title="Revenue, tax and machines across sixteen years">
        <p>
          Every month CBS reports how much players lost on gaming machines in South Australian
          hotels and clubs, how much of that went to the state as gaming tax, and how many machines
          and venues were operating. This page puts the monthly releases on one timeline.
        </p>
      </PageHeader>

      <section aria-labelledby="latest" className="mb-10">
        <h2 id="latest" className="sr-only">
          {fyLabel(latest.fy)} at a glance
        </h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-6 md:grid-cols-4">
          <Stat
            label={`Net gambling revenue, ${fyLabel(latest.fy)}`}
            value={fmtMillions(latest.ngr)}
            detail={`${fmtChange(latest.ngrChange)} on the year before`}
            accent="terracotta"
          />
          <Stat
            label="Gaming tax"
            value={fmtMillions(latest.tax)}
            detail={`${fmtPct(latest.taxRate)} of NGR`}
            accent="ochre"
          />
          <Stat
            label="Machines, June 2025"
            value={fmtInt(latest.machinesJune)}
            detail={`${fmtInt(first.machinesJune)} in June 2010`}
            accent="teal"
          />
          <Stat
            label="NGR per machine"
            value={fmtAud(latest.ngrPerMachine)}
            detail={`${fmtAud(first.ngrPerMachine)} in FY 2009/10`}
          />
        </div>
      </section>

      <StatewideExplorer
        monthly={view.monthly}
        monthlyReal={view.monthlyReal}
        annual={view.annual}
        annualReal={view.annualReal}
        lgaFill={view.lgaFill}
        baseFyLabel={baseLabel.replace("FY ", "")}
        cpiNote={`Real terms use the ABS Consumer Price Index (All groups, Adelaide, quarterly, to ${meta.cpiLatestQuarter}) and are expressed in average ${baseLabel} dollars.`}
      />

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <Callout title="FY 2014/15 is missing from the statewide series" tone="caution">
          The archive has no CBS statewide release for FY 2014/15, so there are no monthly figures
          for that year. The hollow marker on the annual NGR chart is the year’s total from the
          separate LGA release ({fmtMillions(view.lgaFill.nominal, 2)}). In every year where both
          exist, the LGA total matches the statewide total to within monthly rounding (see{" "}
          <Link href="/data-quality#reconciliation" className="link">
            the reconciliation
          </Link>
          ).
        </Callout>
        <Callout title="COVID-19 closures in FY 2019/20" tone="caution">
          Gaming rooms closed in late March 2020. CBS reported zero machines for March to June 2020
          and almost no NGR for April to June, so FY 2019/20 NGR ({fmtMillions(covid.ngr)}) and the
          year’s mean machine count are not comparable with other years.
        </Callout>
        <Callout title="What the figures cover">
          The statewide releases cover hotels and clubs. CBS notes that the machine counts exclude
          the Adelaide Casino, and that the venue count includes every venue that operated at any
          time during the month.
        </Callout>
        <Callout title="Real terms">
          Switch to real dollars to remove inflation. FY 2009/10 NGR of {fmtMillions(first.ngr)} is
          about {fmtMillions(realFirst.ngr)} in {baseLabel} dollars. Each month is deflated by its
          quarter’s Adelaide CPI ({cpiSource.name.split(":")[0]}).
        </Callout>
      </div>

      <section className="mt-14" aria-labelledby="annual-table">
        <SectionHeading id="annual-table" kicker="Table" title="Annual figures">
          <p>
            Revenue and tax are the sum of twelve monthly figures. Machines and venues are counts at
            a point in time, so a year is summarised by their monthly mean and by the June figure,
            never by adding months together.
          </p>
        </SectionHeading>
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead scope="col">Financial year</TableHead>
                <TableHead scope="col" className="text-right">
                  NGR
                </TableHead>
                <TableHead scope="col" className="text-right">
                  Change
                </TableHead>
                <TableHead scope="col" className="text-right">
                  Gaming tax
                </TableHead>
                <TableHead scope="col" className="text-right">
                  Tax / NGR
                </TableHead>
                <TableHead scope="col" className="text-right">
                  Venue share
                </TableHead>
                <TableHead scope="col" className="text-right">
                  Machines (mean)
                </TableHead>
                <TableHead scope="col" className="text-right">
                  Machines (June)
                </TableHead>
                <TableHead scope="col" className="text-right">
                  Venues (mean)
                </TableHead>
                <TableHead scope="col" className="text-right">
                  NGR per machine
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {view.annual.map((y) =>
                y.months === 0 ? (
                  <TableRow key={y.fy} className="bg-muted/40 hover:bg-muted/40">
                    <TableHead scope="row" className="font-medium">
                      {fyLabel(y.fy)}
                    </TableHead>
                    <TableCell colSpan={9} className="text-muted-foreground italic">
                      No statewide release archived. Total NGR from the LGA release:{" "}
                      {fmtMillions(view.lgaFill.nominal, 2)}.
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={y.fy}>
                    <TableHead scope="row" className="font-medium whitespace-nowrap">
                      {fyLabel(y.fy)}
                      {y.fy === "2019-20" ? (
                        <span className="ml-1.5 text-xs font-normal text-ochre">COVID-19</span>
                      ) : null}
                    </TableHead>
                    <TableCell className="tabular text-right">{fmtMillions(y.ngr, 2)}</TableCell>
                    <TableCell className="tabular text-right text-muted-foreground">
                      {fmtChange(y.ngrChange)}
                    </TableCell>
                    <TableCell className="tabular text-right">{fmtMillions(y.tax, 2)}</TableCell>
                    <TableCell className="tabular text-right">{fmtPct(y.taxRate)}</TableCell>
                    <TableCell className="tabular text-right">
                      {fmtMillions(y.venueShare, 2)}
                    </TableCell>
                    <TableCell className="tabular text-right">{fmtInt(y.machinesMean)}</TableCell>
                    <TableCell className="tabular text-right">{fmtInt(y.machinesJune)}</TableCell>
                    <TableCell className="tabular text-right">{fmtInt(y.venuesMean)}</TableCell>
                    <TableCell className="tabular text-right">{fmtAud(y.ngrPerMachine)}</TableCell>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Download these figures from{" "}
          <Link href="/downloads" className="link">
            Downloads
          </Link>
          . Change is against the previous financial year and is left blank after the missing year.
        </p>
      </section>
    </div>
  )
}
