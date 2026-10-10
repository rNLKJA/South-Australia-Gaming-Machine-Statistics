import type { Metadata } from "next"
import Link from "next/link"

import { AnalysisNav, MethodNote } from "@/components/analysis/analysis-nav"
import { FunnelExplorer } from "@/components/analysis/funnel-explorer"
import { RatioForest } from "@/components/analysis/ratio-forest"
import { ChartFrame } from "@/components/charts/chart-frame"
import { Callout } from "@/components/common/callout"
import { PageHeader, SectionHeading } from "@/components/common/page-header"
import { Stat } from "@/components/common/stat"
import { SupportNote } from "@/components/common/support-note"
import { councilsView } from "@/lib/analysis/view"
import { statewide } from "@/lib/data"
import { fmtAud, fmtDecimal } from "@/lib/format"
import { fyLabel } from "@/lib/fy"
import { annualStatewide } from "@/lib/statewide"

export const metadata: Metadata = {
  title: "Council analysis",
  description:
    "NGR per machine by South Australian council area against the state rate: funnel plots with control limits from year-to-year variation, and each area's typical ratio with a 95% interval.",
}

export default function CouncilAnalysisPage() {
  const v = councilsView()
  const latest = v.funnels.at(-1)!
  const above = v.persistent.filter((p) => p.direction === "above")
  const below = v.persistent.filter((p) => p.direction === "below")
  const unclear = v.persistent.filter((p) => p.direction === "unclear")
  const aboveIndependent = v.persistent.filter((p) => p.directionIndependent === "above")
  const belowIndependent = v.persistent.filter((p) => p.directionIndependent === "below")
  const dep = v.dependence
  const smallest = [...latest.points].sort((a, b) => a.machines - b.machines)[0]
  // the Statewide page divides by the year's mean machine count (DR-002); council rates use the
  // June count, so the state rate they are compared with must too
  const statewideRate = annualStatewide(statewide).find((y) => y.fy === latest.fy)?.ngrPerMachine

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <PageHeader
        kicker="Analysis · Councils"
        title="Which council areas really differ from the state rate?"
      >
        <p>
          A council with 17 machines can swing a long way from one year to the next; one with 1,100
          can’t. Ranking areas by NGR per machine treats both the same and over-reads the small
          ones. This page compares each area with the state rate of the same year and asks whether
          the difference is bigger than the area’s size would explain.
        </p>
      </PageHeader>
      <AnalysisNav current="/analysis/councils" />
      <SupportNote compact className="mb-10 max-w-3xl" />

      <section aria-label="Summary" className="mb-12 grid grid-cols-2 gap-6 md:grid-cols-4">
        <Stat
          label={`State rate, council basis, ${fyLabel(latest.fy)}`}
          value={fmtAud(latest.stateRate)}
          detail={`NGR ÷ machines at 30 June across the ${latest.points.length} published areas${
            statewideRate
              ? `; the Statewide page divides by the year’s mean machines (${fmtAud(statewideRate)})`
              : ""
          }`}
          accent="terracotta"
        />
        <Stat
          label="Year-to-year scale c"
          value={v.scale.c.toFixed(2)}
          detail={`SD of the log ratio × √machines; ${v.scale.df} degrees of freedom`}
          accent="teal"
        />
        <Stat
          label="Size check (slope)"
          value={fmtDecimal(v.scaling.slope.estimate)}
          detail={`95% CI ${fmtDecimal(v.scaling.slope.lower)} to ${fmtDecimal(v.scaling.slope.upper)}; the funnel assumes −0.50`}
          accent="ochre"
        />
        <Stat
          label="Areas consistently above or below"
          value={`${above.length} / ${below.length}`}
          detail={`of ${v.persistent.length} areas with three or more years; ${unclear.length} unclear (${aboveIndependent.length} / ${belowIndependent.length} if years were independent)`}
        />
      </section>

      <section aria-labelledby="funnel" className="mb-16">
        <SectionHeading id="funnel" kicker="Section 1" title="Funnel plot against the state rate">
          <p>
            Each point is one area CBS published that year (combined groups stay whole). The lines
            fan out around the state rate: narrow for areas with many machines, wide for small ones.
            Most areas sit outside the year-to-year limits, which says the differences between
            councils are real and lasting, not small-number noise. Switch to the second set of
            limits to see which areas stand out even after allowing for that spread.
          </p>
        </SectionHeading>
        <ChartFrame
          title="NGR per machine by council area"
          description="Nominal dollars of each year, so every area is compared with the state rate of the same year: the published areas’ NGR divided by their machines at 30 June, the same basis as each area’s own rate."
          source={
            <>
              Limits: state rate × exp(± z · c / √machines), with c pooled from every area’s
              year-to-year variation (FY 2013/14 to FY 2024/25, without FY 2019/20, which has no
              machine counts). The between-council spread τ² follows Spiegelhalter (2005), with z
              winsorised at 10%. Smallest area in {fyLabel(latest.fy)}: {smallest.label},{" "}
              {smallest.machines} machines.
            </>
          }
        >
          <FunnelExplorer
            c={v.scale.c}
            years={v.funnels.map((f) => ({
              fy: f.fy,
              stateRate: f.stateRate,
              tau2: f.overdispersion.tau2,
              phi: f.overdispersion.phi,
              points: f.points,
              curves: f.curves,
              outside: { noise: f.outside95, overdispersed: f.outside95Overdispersed },
            }))}
          />
        </ChartFrame>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <Callout title="Why the limits use the log scale">
            Year-to-year swings are proportional: a rural area at a third of the state rate moves by
            a third as many dollars. The standard deviation of an area’s log ratio falls with size
            at a slope of {fmtDecimal(v.scaling.slope.estimate)} (95% CI{" "}
            {fmtDecimal(v.scaling.slope.lower)} to {fmtDecimal(v.scaling.slope.upper)}, n ={" "}
            {v.scaling.n} areas with four or more years), close to the −0.5 that a 1/√machines
            variance implies. That check is what licenses the funnel’s shape.
          </Callout>
          <Callout title="What this is not" tone="caution">
            A council outside the limits is different from the state rate, not worse or better run.
            Venue mix (large metropolitan hotels against small country clubs), tourism and
            population all differ between areas, and none of them is in these data.
          </Callout>
        </div>
      </section>

      <section aria-labelledby="persistent" className="mb-8">
        <SectionHeading
          id="persistent"
          kicker="Section 2"
          title="Each area’s typical ratio, with year-to-year uncertainty"
        >
          <p>
            For every area published in three or more years, the geometric mean of its NGR per
            machine divided by the state rate, with a 95% t interval across its years. A ratio of
            1.5× means the area’s machines typically took half as much again as the state average.
            Terracotta: consistently above the state rate; teal: consistently below; grey: the
            interval includes 1.
          </p>
          <p>
            An area’s years are not independent: a council above the state rate one year tends to be
            above it the next. The pooled lag-1 autocorrelation of the log ratios within areas is{" "}
            {fmtDecimal(dep.rho)} ({dep.pairs} pairs of consecutive years in {dep.areas} areas with
            four or more years), so every interval’s standard error is widened by √((1 + ρ) / (1 −
            ρ)) = {dep.inflation.toFixed(2)}. Treating the years as independent would call{" "}
            {aboveIndependent.length} areas above and {belowIndependent.length} below instead of{" "}
            {above.length} and {below.length}.
          </p>
        </SectionHeading>
        <RatioForest rows={v.persistent} />
        <MethodNote>
          Ratios remove everything that moves the whole state in a year (inflation, the COVID-19
          years, statewide policy), so the interval reflects the area’s own year-to-year variation.
          A combined group is one unit for as long as its membership is unchanged; when CBS changes
          a group, the new composition starts a new row. With three to eleven years per area, the t
          interval is used rather than a bootstrap. The widening uses the large-sample AR(1) factor
          and one pooled ρ for every area; the estimate from short series is biased towards zero, so
          the adjustment is more likely too small than too large. See{" "}
          <Link href="/methods/decisions/DR-001-combined-lga-groups" className="link">
            DR-001
          </Link>{" "}
          on combined groups.
        </MethodNote>
      </section>
    </div>
  )
}
