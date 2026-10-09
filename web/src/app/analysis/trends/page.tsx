import type { Metadata } from "next"
import Link from "next/link"

import { AnalysisNav, MethodNote } from "@/components/analysis/analysis-nav"
import { ItsExplorer } from "@/components/analysis/its-explorer"
import { PerMachineChart } from "@/components/analysis/per-machine-chart"
import { StlPanels } from "@/components/analysis/stl-panels"
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
import { DEFAULT_SEED, trendsView } from "@/lib/analysis/view"
import { fmtAud, fmtInterval, fmtMillions, fmtP, fmtPct, signed } from "@/lib/format"
import { fyLabel, monthLabel } from "@/lib/fy"

export const metadata: Metadata = {
  title: "Trend analysis",
  description:
    "STL decomposition of monthly net gambling revenue, an interrupted time series around the 2020 venue closures with Newey–West intervals, paired before/after comparisons and NGR per machine with bootstrap intervals.",
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

export default function TrendsPage() {
  const v = trendsView()
  const [pre, post] = v.segments
  const primary = v.its[0]
  const money = (x: number) => fmtMillions(x, 1)
  const range = (k: number) => {
    const vals = post.points
      .filter((p) => Number(p.month.slice(5)) === k + 1)
      .map((p) => p.seasonal)
    return [Math.min(...vals), Math.max(...vals)]
  }
  const profile = post.seasonalProfile
    .map((value, k) => ({ month: MONTHS[k], value, range: range(k) }))
    .sort((a, b) => b.value - a.value)

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <PageHeader kicker="Analysis · Trends" title="How revenue moved, read with its uncertainty">
        <p>
          The Statewide page shows what CBS published. This page asks three questions of the same
          monthly series: what is trend and what is season, how the series changed around the 2020
          venue closures, and how much the yearly figures depend on month-to-month variation.
          Dollars are in average FY 2024/25 dollars (ABS CPI, Adelaide) unless stated.
        </p>
      </PageHeader>
      <AnalysisNav current="/analysis/trends" />
      <SupportNote compact className="mb-10 max-w-3xl" />

      <section aria-labelledby="stl" className="mb-16">
        <SectionHeading id="stl" kicker="Section 1" title="Trend and seasonality (STL)">
          <p>
            STL splits each month into a slowly changing trend, a repeating seasonal pattern and a
            remainder. The decomposition needs an unbroken series, so it runs separately on July
            2009 to June 2014 ({pre.points.length} months) and July 2015 to June 2025 (
            {post.points.length} months), either side of the missing FY 2014/15. The robust version
            gives low weight to months that don’t fit, so the 2020 closures don’t drag the trend
            down.
          </p>
        </SectionHeading>
        <ChartFrame
          title="Monthly NGR, decomposed"
          description="Real NGR ($ million a month). Shaded: no statewide release (FY 2014/15) and the 2020 closures."
          source={
            <>
              R’s <code className="font-mono">stl(x, s.window = 13, robust = TRUE)</code>, ported to
              TypeScript and checked against R to eight significant figures: seasonal window{" "}
              {post.params.sWindow}, trend window {post.params.tWindow}, low-pass window{" "}
              {post.params.lWindow}, {post.params.outer} robustness iterations. Hollow markers: the
              months the robust fit gave a weight below 0.5.
            </>
          }
        >
          <StlPanels rows={v.stlRows} />
        </ChartFrame>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          <div className="space-y-4 text-[0.95rem] leading-relaxed text-ink-soft">
            <p>
              <strong className="text-foreground">Strength.</strong> On the later run, leaving out
              the four closure months, the trend explains {fmtPct(post.strength.trend, 0)} and the
              seasonal pattern {fmtPct(post.strength.seasonal, 0)} of the variation they share with
              the remainder (Wang, Smith and Hyndman’s strength measures, n = {post.strength.n}{" "}
              months). On 2009–2014 the figures are {fmtPct(pre.strength.trend, 0)} and{" "}
              {fmtPct(pre.strength.seasonal, 0)}. These are descriptive: STL has no sampling model,
              so no interval is attached.
            </p>
            <p>
              <strong className="text-foreground">Months set aside.</strong> The robust fit gave a
              weight below 0.5 to {post.lowWeight.length} months of the later run, without being
              told about COVID-19: {post.lowWeight.map(monthLabel).join(", ")}. They include all
              four closure months and both short lockdowns (November 2020 and July 2021).
            </p>
          </div>
          <div className="rounded-lg border bg-card">
            <p className="border-b px-4 py-3 font-serif text-lg font-semibold">
              Seasonal effect by calendar month, July 2015 to June 2025
            </p>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead scope="col">Month</TableHead>
                  <TableHead scope="col" className="text-right">
                    Mean effect
                  </TableHead>
                  <TableHead scope="col" className="text-right">
                    Range across years
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profile.map((p) => (
                  <TableRow key={p.month}>
                    <TableHead scope="row" className="font-medium">
                      {p.month}
                    </TableHead>
                    <TableCell className="tabular text-right">
                      {signed(p.value, (x) => fmtMillions(x, 1))}
                    </TableCell>
                    <TableCell className="tabular text-right text-muted-foreground">
                      {signed(p.range[0], (x) => fmtMillions(x, 1))} to{" "}
                      {signed(p.range[1], (x) => fmtMillions(x, 1))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <MethodNote inCard>
              Part of the pattern is calendar length: February has two or three fewer days than the
              months around it. The range shows how the seasonal component drifts across the ten
              years (the seasonal window of 13 lets it change slowly).
            </MethodNote>
          </div>
        </div>
      </section>

      <section aria-labelledby="its" className="mb-16">
        <SectionHeading id="its" kicker="Section 2" title="Before and after the 2020 closures">
          <p>
            An interrupted time series fits one line to the months before the closures and lets both
            the level and the slope change at reopening: monthly NGR = level + trend · month +
            change in level after July 2020 + change in trend after July 2020 + a calendar-month
            effect. It uses July 2015 to June 2025 and leaves out March to June 2020, when venues
            were shut. Monthly errors are autocorrelated (lag-1 autocorrelation of the residuals{" "}
            {primary.residualAcf1.toFixed(2)}), so the intervals use Newey–West standard errors,
            which allow for that.
          </p>
        </SectionHeading>
        <ChartFrame
          title="Interrupted time series of monthly NGR"
          description="Choose a specification to see how the estimates move when the outcome or the months change."
          source="Segmented regression with July as the reference month; Newey–West (Bartlett) standard errors with the rule-of-thumb lag floor(4 (n/100)^(2/9)); 95% t intervals. Checked against statsmodels in the unit tests."
        >
          <ItsExplorer views={v.itsViews} />
        </ChartFrame>

        <div className="mt-6 rounded-lg border bg-card">
          <p className="border-b px-4 py-3 font-serif text-lg font-semibold">
            All four specifications
          </p>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead scope="col">Specification</TableHead>
                <TableHead scope="col" className="text-right">
                  Months
                </TableHead>
                <TableHead scope="col" className="text-right">
                  Level change at reopening
                </TableHead>
                <TableHead scope="col" className="text-right">
                  Trend change per year
                </TableHead>
                <TableHead scope="col" className="text-right">
                  Gap, June 2025
                </TableHead>
                <TableHead scope="col" className="text-right">
                  Residual lag-1 ACF
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {v.its.map((r) => {
                const f = r.unit === "$m" ? money : (x: number) => fmtAud(x)
                const ci = (e: { estimate: number; lower: number; upper: number }) =>
                  fmtInterval(e.estimate, e.lower, e.upper, (x) => signed(x, f))
                return (
                  <TableRow key={r.spec.id}>
                    <TableHead scope="row" className="font-medium whitespace-normal">
                      {r.spec.label}
                    </TableHead>
                    <TableCell className="tabular text-right">{r.n}</TableCell>
                    <TableCell className="tabular text-right whitespace-normal">
                      {ci(r.level)}
                    </TableCell>
                    <TableCell className="tabular text-right whitespace-normal">
                      {ci(r.slopePerYear)}
                    </TableCell>
                    <TableCell className="tabular text-right whitespace-normal">
                      {ci(r.gapAtEnd)}
                    </TableCell>
                    <TableCell className="tabular text-right">
                      {r.residualAcf1.toFixed(2)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          <MethodNote inCard>
            Per-machine rows are dollars per machine per month. The gap is the fitted value minus
            the pre-closure trend carried forward to June 2025 (counterfactual{" "}
            {fmtMillions(primary.counterfactualAtEnd, 1)} a month for the primary specification).
          </MethodNote>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <Callout title="What the estimates do and don’t say" tone="caution">
            In every specification NGR came back above its pre-closure path and kept rising faster
            than before. The model describes that break; it can’t say why. Income support, other
            entertainment closing, interstate borders and inflation all changed in the same months,
            so none of these figures is the effect of the closures alone.
          </Callout>
          <Callout title="Why real dollars are the primary outcome">
            Prices rose quickly from 2021. In nominal dollars part of that inflation shows up as a
            steeper post-2020 trend (
            {fmtInterval(
              v.its[1].slopePerYear.estimate,
              v.its[1].slopePerYear.lower,
              v.its[1].slopePerYear.upper,
              (x) => signed(x, money)
            )}{" "}
            a year, against{" "}
            {fmtInterval(
              primary.slopePerYear.estimate,
              primary.slopePerYear.lower,
              primary.slopePerYear.upper,
              (x) => signed(x, money)
            )}{" "}
            in real terms). See{" "}
            <Link href="/methods/decisions/DR-005-analysis-design" className="link">
              DR-005
            </Link>{" "}
            for the choices behind the model.
          </Callout>
        </div>
      </section>

      <section aria-labelledby="paired" className="mb-16">
        <SectionHeading id="paired" kicker="Section 3" title="Like-for-like years, month by month">
          <p>
            A simpler check that needs no model: pair each calendar month of one financial year with
            the same month of another, so seasonality cancels out, and look at the mean difference.
            Intervals come from the t distribution and from{" "}
            {v.paired[0].summary.bootstrap.B.toLocaleString("en-AU")} bootstrap resamples of the
            twelve pairs (seed {DEFAULT_SEED}).
          </p>
        </SectionHeading>
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead scope="col">Comparison</TableHead>
                <TableHead scope="col" className="text-right">
                  Before (mean)
                </TableHead>
                <TableHead scope="col" className="text-right">
                  After (mean)
                </TableHead>
                <TableHead scope="col" className="text-right">
                  Mean paired difference (t CI)
                </TableHead>
                <TableHead scope="col" className="text-right">
                  Bootstrap CI
                </TableHead>
                <TableHead scope="col" className="text-right">
                  d<sub>z</sub>
                </TableHead>
                <TableHead scope="col" className="text-right">
                  p
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {v.paired.map((p) => {
                const f =
                  p.unit === "$m" ? (x: number) => fmtMillions(x, 2) : (x: number) => fmtAud(x)
                const s = p.summary
                return (
                  <TableRow key={p.id}>
                    <TableHead scope="row" className="font-medium whitespace-normal">
                      {p.label}
                      <span className="block text-xs font-normal text-muted-foreground">
                        {fyLabel(p.before)} → {fyLabel(p.after)}, n = {s.n} months,{" "}
                        {signed(s.relative, (x) => fmtPct(x, 1))}
                      </span>
                    </TableHead>
                    <TableCell className="tabular text-right">{f(p.beforeMean)}</TableCell>
                    <TableCell className="tabular text-right">{f(p.afterMean)}</TableCell>
                    <TableCell className="tabular text-right whitespace-normal">
                      {fmtInterval(s.t.estimate, s.t.lower, s.t.upper, (x) => signed(x, f))}
                    </TableCell>
                    <TableCell className="tabular text-right whitespace-normal">
                      {signed(s.bootstrap.lower, f)} to {signed(s.bootstrap.upper, f)}
                    </TableCell>
                    <TableCell className="tabular text-right">{s.dz.toFixed(2)}</TableCell>
                    <TableCell className="tabular text-right">{fmtP(s.p)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          <MethodNote inCard>
            d<sub>z</sub> is the mean paired difference divided by the standard deviation of the
            differences. With only twelve pairs a percentile bootstrap interval tends to be a little
            too narrow, which is why the t interval is shown first.
          </MethodNote>
        </div>
      </section>

      <section aria-labelledby="per-machine" className="mb-8">
        <SectionHeading id="per-machine" kicker="Section 4" title="NGR per machine, with intervals">
          <p>
            Annual NGR per machine is a ratio of twelve months of revenue to the year’s average
            machine count. Resampling the twelve months (with replacement,{" "}
            {v.perMachine.find((y) => y.real)?.real?.B.toLocaleString("en-AU")} times, seed{" "}
            {DEFAULT_SEED}) shows how much the figure leans on particular months. The point
            estimates are exactly the Statewide page’s.
          </p>
        </SectionHeading>
        <ChartFrame
          title="Annual NGR per machine"
          description="Dots: the published-basis figure. Bars: 95% percentile bootstrap intervals over months."
          source="FY 2014/15 has no statewide release. FY 2019/20 is left blank, as on the Statewide page: March to June 2020 carry NGR against zero reported machines."
        >
          <PerMachineChart
            rows={v.perMachine.map((y) => ({
              fy: y.fy,
              months: y.months,
              note: y.note,
              nominal: y.nominal ? [y.nominal.estimate, y.nominal.lower, y.nominal.upper] : null,
              real: y.real ? [y.real.estimate, y.real.lower, y.real.upper] : null,
            }))}
          />
        </ChartFrame>
        <Callout className="mt-6 max-w-4xl" title="Intervals on a census">
          CBS reports every machine and every dollar, so there is no sampling error in the usual
          sense. The intervals on this page describe how stable a figure is given the month-to-month
          variation in the series: a wide interval means a few unusual months move the annual
          figure, not that the figure was estimated from a sample.
        </Callout>
      </section>
    </div>
  )
}
