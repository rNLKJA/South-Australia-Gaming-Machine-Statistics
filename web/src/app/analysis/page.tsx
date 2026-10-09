import { ArrowRight } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import type { ReactNode } from "react"

import { AnalysisNav } from "@/components/analysis/analysis-nav"
import { Callout } from "@/components/common/callout"
import { PageHeader } from "@/components/common/page-header"
import { SupportNote } from "@/components/common/support-note"
import { concentrationView, councilsView, DEFAULT_SEED, trendsView } from "@/lib/analysis/view"
import { fmtInt, fmtMillions, fmtPct, signed } from "@/lib/format"
import { monthLabel } from "@/lib/fy"

export const metadata: Metadata = {
  title: "Analysis",
  description:
    "Statistical analysis of South Australia's gaming-machine statistics with uncertainty: trend and seasonality, the 2020 closures, council funnel plots and market concentration.",
}

export default function AnalysisPage() {
  const t = trendsView()
  const c = councilsView()
  const k = concentrationView()
  const its = t.its[0]
  const pair = t.paired[0]
  const latest = c.funnels.at(-1)!
  const b = k.variants[0].breakpoint
  const above = c.persistent.filter((p) => p.direction === "above").length
  const below = c.persistent.filter((p) => p.direction === "below").length
  const m = (x: number) => fmtMillions(x, 1)

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <PageHeader kicker="Analysis" title="The same figures, with their uncertainty">
        <p>
          The explorer pages report what CBS published. These pages add the statistics around them:
          intervals on every estimate, sample sizes stated, paired comparisons where two periods are
          compared, and effect sizes rather than bare p-values. The published figures are not
          changed; where an analysis needs a different basis (real dollars, ratios to the state
          rate) it says so.
        </p>
      </PageHeader>
      <AnalysisNav current="/analysis" />
      <SupportNote compact className="mb-10 max-w-3xl" />

      <ul className="grid gap-px overflow-hidden rounded-lg border bg-border lg:grid-cols-3">
        <Card
          href="/analysis/trends"
          title="Trends"
          kicker="STL, interrupted time series, paired months"
          finding={
            <>
              At reopening in July 2020, real monthly NGR was {m(its.level.estimate)} above its
              pre-closure path (95% CI {signed(its.level.lower, m)} to {signed(its.level.upper, m)},
              n = {its.n} months) and its trend steepened by {m(its.slopePerYear.estimate)} a year.
            </>
          }
          detail={`The first full year after reopening averaged ${fmtMillions(pair.summary.t.estimate, 2)} a month more than FY 2018/19 (paired over 12 calendar months, d_z = ${pair.summary.dz.toFixed(2)}).`}
        />
        <Card
          href="/analysis/councils"
          title="Councils"
          kicker="Funnel plots, ratios to the state rate"
          finding={
            <>
              {latest.outside95.count} of {latest.outside95.n} areas sit outside the year-to-year
              95% limits in FY 2024/25 ({fmtPct(latest.outside95.estimate, 0)}, Wilson CI{" "}
              {fmtPct(latest.outside95.lower, 0)}–{fmtPct(latest.outside95.upper, 0)}): the
              differences between councils are lasting, not small-number noise.
            </>
          }
          detail={`${above} areas are consistently above the state rate and ${below} consistently below, across three to eleven years each.`}
        />
        <Card
          href="/analysis/concentration"
          title="Concentration"
          kicker="Bootstrap intervals, change-point check"
          finding={
            <>
              Manufacturer concentration stopped falling in {monthLabel(k.breaks[0].tau)} (95% CI{" "}
              {monthLabel(k.breaks[0].tauLower)} to {monthLabel(k.breaks[0].tauUpper)}): from about{" "}
              {fmtInt(-12 * b.slopeBefore.estimate)} points a year down to about{" "}
              {fmtInt(12 * b.slopeAfter.estimate)} a year up.
            </>
          }
          detail="Moving-block bootstrap of the residuals, re-fitting the break in every resample."
        />
      </ul>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <Callout title="Reproducible">
          Every resampled interval uses a fixed seed ({DEFAULT_SEED}, the first month of the
          series), so the pages show the same numbers on every build. The statistical helpers are
          unit-tested against scipy, statsmodels and R, and the scripts that produce those reference
          values are in the repository.
        </Callout>
        <Callout title="Methods and decisions">
          How each analysis was set up, what it assumes and what I would change are on{" "}
          <Link href="/methods" className="link">
            Methods
          </Link>
          , with decision records for the choices that matter (combined council groups, stock versus
          flow totals, the missing FY 2014/15 and the model specifications).
        </Callout>
      </div>
    </div>
  )
}

function Card({
  href,
  title,
  kicker,
  finding,
  detail,
}: {
  href: string
  title: string
  kicker: string
  finding: ReactNode
  detail: string
}) {
  return (
    <li className="bg-card">
      <Link href={href} className="group flex h-full flex-col p-5 hover:bg-accent/50">
        <span className="kicker text-muted-foreground">{kicker}</span>
        <span className="mt-2 flex items-center gap-2 font-serif text-2xl font-semibold">
          {title}
          <ArrowRight
            className="size-4 text-terracotta transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </span>
        <span className="mt-3 text-[0.95rem] leading-relaxed text-foreground">{finding}</span>
        <span className="mt-3 text-sm leading-relaxed text-muted-foreground">{detail}</span>
      </Link>
    </li>
  )
}
