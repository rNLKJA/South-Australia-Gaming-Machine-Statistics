import type { Metadata } from "next"
import Link from "next/link"

import { AnalysisNav, MethodNote } from "@/components/analysis/analysis-nav"
import { HhiExplorer } from "@/components/analysis/hhi-explorer"
import { ChartFrame } from "@/components/charts/chart-frame"
import { Callout } from "@/components/common/callout"
import { PageHeader, SectionHeading } from "@/components/common/page-header"
import { SupportNote } from "@/components/common/support-note"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { allMonths } from "@/lib/analysis/concentration"
import { concentrationView, DEFAULT_SEED } from "@/lib/analysis/view"
import { fmtInt, signed } from "@/lib/format"
import { fyLabel, monthLabel } from "@/lib/fy"

export const metadata: Metadata = {
  title: "Concentration analysis",
  description:
    "Manufacturer concentration (Herfindahl–Hirschman index) with bootstrap intervals over months and a broken-stick change-point check with a moving-block bootstrap.",
}

const triple = (e: { estimate: number; lower: number; upper: number }, scale = 1) =>
  [e.estimate * scale, e.lower * scale, e.upper * scale] as [number, number, number]

/** "−224 (−247 to −201)" with typographic minus signs. */
const perYear = ([e, lo, hi]: [number, number, number]) =>
  `${signed(e, (x) => fmtInt(x))} (${signed(lo, (x) => fmtInt(x))} to ${signed(hi, (x) => fmtInt(x))})`

export default function ConcentrationPage() {
  const v = concentrationView()
  const months = allMonths("2009-10", "2024-25")
  const pub = v.variants[0]
  const b = pub.breakpoint
  const first = pub.annual[0]
  const last = pub.annual.at(-1)!

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <PageHeader kicker="Analysis · Concentration" title="When did the market stop spreading out?">
        <p>
          The Manufacturers page shows the Herfindahl–Hirschman index (HHI) falling from about{" "}
          {fmtInt(first.hhi.estimate)} in {fyLabel(first.fy)} and then creeping back up. This page
          puts intervals on the annual figures and asks when the turn happened, with an interval for
          the turning point itself.
        </p>
      </PageHeader>
      <AnalysisNav current="/analysis/concentration" />
      <SupportNote compact className="mb-10 max-w-3xl" />

      <section aria-labelledby="break" className="mb-12">
        <SectionHeading
          id="break"
          kicker="Change-point check"
          title={`A broken stick through ${pub.monthly.length} months`}
        >
          <p>
            The model is two straight lines that meet at an unknown month: HHI = a + b · month + d ·
            (month − break)₊. The break is the month that minimises the squared error, with at least{" "}
            {b.minSegment} months on each side. To put an interval on the break, the residuals are
            resampled in blocks of {b.blockLength} consecutive months (a moving-block bootstrap),
            the break is found again in each of {b.tau.B.toLocaleString("en-AU")} resamples, and the
            middle 95% is reported (seed {DEFAULT_SEED}).
          </p>
          <p>
            The residuals move slowly: their autocorrelation is{" "}
            {b.residualAcf.map((r, i) => (
              <span key={r.lag}>
                {i ? (i === b.residualAcf.length - 1 ? " and " : ", ") : ""}
                {r.acf.toFixed(2)} at lag {r.lag}
              </span>
            ))}
            . Blocks have to be long enough to keep that dependence, so the length is chosen from
            the residuals with Politis and White’s automatic rule (circular-block estimate, rounded)
            rather than a rule of thumb. Shorter blocks break the dependence up and give an interval
            that is too narrow; the table below shows by how much.
          </p>
        </SectionHeading>
        <ChartFrame
          title="Manufacturer concentration over time"
          description="Shaded: the 95% interval for the break, and the missing October to December 2023 reports."
          source="HHI from CBS monthly machine counts by manufacturer (shares recomputed from the counts). The broken stick and its bootstrap are in web/src/lib/stats/segmented.ts, checked against a numpy grid search."
        >
          <HhiExplorer
            B={pub.annual[0].hhi.B}
            seed={DEFAULT_SEED}
            variants={v.variants.map((x) => ({
              id: x.id,
              label: x.label,
              months,
              monthly: Object.fromEntries(x.monthly.map((m) => [m.month, m.hhi])),
              fitted: Object.fromEntries(x.fitted.map((m) => [m.month, m.fitted])),
              tau: v.breaks.find((k) => k.id === x.id)!.tau,
              tauLower: v.breaks.find((k) => k.id === x.id)!.tauLower,
              tauUpper: v.breaks.find((k) => k.id === x.id)!.tauUpper,
              slopeBefore: triple(x.breakpoint.slopeBefore, 12),
              slopeAfter: triple(x.breakpoint.slopeAfter, 12),
              annual: x.annual.map((a) => ({ fy: a.fy, months: a.months, hhi: triple(a.hhi) })),
            }))}
          />
        </ChartFrame>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <Callout title="Reading the break">
            Concentration fell by about {fmtInt(-12 * b.slopeBefore.estimate)} points a year until{" "}
            {monthLabel(v.breaks[0].tau)} and has risen by about{" "}
            {fmtInt(12 * b.slopeAfter.estimate)} a year since. The two lines leave{" "}
            {((1 - b.fit.rss / b.fit.rssLinear) * 100).toFixed(0)}% less squared error than one
            straight line. Naming the manufacturers as published or combining the Light &amp; Wonder
            lineage gives the same break: the renamed makers are a small share.
          </Callout>
          <Callout title="What the interval covers" tone="caution">
            The break’s interval treats the two-line shape as given. A gradual curve would also fit
            a bend, so read the break as “when the direction changed”, not as a single event. The
            data don’t say why; Aristocrat’s recovering share (see{" "}
            <Link href="/manufacturers" className="link">
              Manufacturers
            </Link>
            ) is the visible driver.
          </Callout>
        </div>
      </section>

      <section aria-labelledby="blocks" className="mb-12">
        <SectionHeading id="blocks" kicker="Sensitivity" title="How much the block length matters">
          <p>
            The same bootstrap with other block lengths. The break itself does not move; its
            interval widens as the blocks get long enough to carry the residuals’ autocorrelation,
            and settles once they do. The headline uses the automatic choice.
          </p>
        </SectionHeading>
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead scope="col">Block length</TableHead>
                <TableHead scope="col" className="text-right">
                  Break (95% CI)
                </TableHead>
                <TableHead scope="col" className="text-right">
                  Interval width
                </TableHead>
                <TableHead scope="col" className="text-right">
                  HHI change a year, before
                </TableHead>
                <TableHead scope="col" className="text-right">
                  After
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pub.sensitivity.map((r) => (
                <TableRow key={r.blockLength} className={r.chosen ? "bg-accent/40" : undefined}>
                  <TableHead scope="row" className="font-medium">
                    {r.blockLength} months
                    {r.chosen ? (
                      <span className="block text-xs font-normal text-muted-foreground">
                        automatic choice (used above)
                      </span>
                    ) : null}
                  </TableHead>
                  <TableCell className="tabular text-right">
                    {monthLabel(r.tau.estimate)} ({monthLabel(r.tau.lower)} to{" "}
                    {monthLabel(r.tau.upper)})
                  </TableCell>
                  <TableCell className="tabular text-right">{r.tau.widthMonths} months</TableCell>
                  <TableCell className="tabular text-right">{perYear(r.slopeBefore)}</TableCell>
                  <TableCell className="tabular text-right">{perYear(r.slopeAfter)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <MethodNote inCard>
            {b.tau.B.toLocaleString("en-AU")} resamples per row, seed {DEFAULT_SEED}, names as
            published. The rule of thumb n<sup>1/3</sup> would give{" "}
            {Math.round(Math.cbrt(pub.monthly.length))}-month blocks, the first row. Block
            bootstraps assume the residuals are stationary; the October to December 2023 gap is
            treated as if the months were consecutive.
          </MethodNote>
        </div>
      </section>

      <section aria-labelledby="annual" className="mb-8">
        <SectionHeading id="annual" kicker="Table" title="Annual HHI with bootstrap intervals">
          <p>
            Point estimates are the Manufacturers page’s figures (the mean of the monthly values).
            The intervals are narrow because the index moves slowly within a year; they describe
            month-to-month variation, not sampling error.
          </p>
        </SectionHeading>
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead scope="col">Financial year</TableHead>
                <TableHead scope="col" className="text-right">
                  Months
                </TableHead>
                <TableHead scope="col" className="text-right">
                  HHI, names as published (95% CI)
                </TableHead>
                <TableHead scope="col" className="text-right">
                  Lineage combined (95% CI)
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pub.annual.map((a, i) => {
                const m = v.variants[1].annual[i]
                return (
                  <TableRow key={a.fy}>
                    <TableHead scope="row" className="font-medium">
                      {fyLabel(a.fy)}
                    </TableHead>
                    <TableCell className="tabular text-right">{a.months}</TableCell>
                    <TableCell className="tabular text-right">
                      {fmtInt(a.hhi.estimate)} ({fmtInt(a.hhi.lower)}–{fmtInt(a.hhi.upper)})
                    </TableCell>
                    <TableCell className="tabular text-right">
                      {fmtInt(m.hhi.estimate)} ({fmtInt(m.hhi.lower)}–{fmtInt(m.hhi.upper)})
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          <MethodNote inCard>
            {last.hhi.B.toLocaleString("en-AU")} percentile-bootstrap resamples of the months in
            each year, seed {DEFAULT_SEED}. Under the 2010 US merger guidelines an HHI above 2,500
            counts as highly concentrated; the threshold is a reference point, not a finding about
            this market.
          </MethodNote>
        </div>
      </section>
    </div>
  )
}
