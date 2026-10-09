"use client"

import { useState } from "react"

import { Legend, TrendChart, type Datum } from "@/components/charts/trend-chart"
import { Segmented } from "@/components/common/segmented"
import { fmtAud, fmtMillions, fmtInterval, signed } from "@/lib/format"
import { monthLabel } from "@/lib/fy"

export interface ItsView {
  id: string
  label: string
  note: string
  unit: "$m" | "$"
  n: number
  lag: number
  level: [number, number, number]
  slopePerYear: [number, number, number]
  gapAtEnd: [number, number, number]
  series: {
    month: string
    observed: number | null
    fitted: number | null
    counterfactual: number | null
    excluded: boolean
  }[]
}

/** The interrupted time series for each specification: observed, fitted and counterfactual. */
export function ItsExplorer({ views }: { views: ItsView[] }) {
  const [id, setId] = useState(views[0].id)
  const v = views.find((x) => x.id === id) ?? views[0]
  const money = v.unit === "$m" ? (x: number) => fmtMillions(x, 1) : (x: number) => fmtAud(x)
  const data: Datum[] = v.series.map((s) => ({
    key: s.month,
    label: monthLabel(s.month),
    observed: s.excluded ? null : s.observed,
    fitted: s.fitted,
    counterfactual: s.counterfactual,
  }))
  const ticks = v.series
    .filter((s) => s.month.endsWith("-07") && Number(s.month.slice(0, 4)) % 2 === 1)
    .map((s) => s.month)
  const est = (t: [number, number, number]) =>
    fmtInterval(t[0], t[1], t[2], (x) => signed(x, money))
  return (
    <div>
      <Segmented
        label="Specification"
        value={id}
        onChange={setId}
        options={views.map((x) => ({ value: x.id, label: x.label }))}
      />
      <p className="mt-3 max-w-[70ch] text-sm text-muted-foreground">{v.note}</p>
      <div className="mt-4">
        <Legend
          items={[
            { label: "Observed", color: "var(--chart-4)" },
            { label: "Fitted model", color: "var(--chart-1)" },
            { label: "Pre-closure trend carried forward", color: "var(--chart-2)", dashed: true },
          ]}
        />
      </div>
      <div className="mt-2">
        <TrendChart
          data={data}
          height={320}
          bands={[{ from: "2020-03", to: "2020-06", label: "Closures (left out)", tone: "event" }]}
          series={[
            { key: "observed", label: "Observed", color: "var(--chart-4)", strokeWidth: 1.25 },
            { key: "fitted", label: "Fitted", color: "var(--chart-1)", strokeWidth: 2.25 },
            {
              key: "counterfactual",
              label: "Pre-closure trend carried forward",
              color: "var(--chart-2)",
              dashed: true,
              strokeWidth: 2,
            },
          ]}
          xTicks={ticks}
          xTickFormat={(k) => k.slice(0, 4)}
          yDomain={["auto", "auto"]}
          yFormat={(x) =>
            v.unit === "$m" ? `$${Math.round(x)}m` : `$${Math.round(x / 100) / 10}k`
          }
          valueFormat={(x) => money(x)}
          ariaLabel={`Interrupted time series, ${v.label}: observed monthly values from July 2015 to June 2025, the fitted segmented regression and the pre-closure trend carried forward after July 2020.`}
        />
      </div>
      <dl className="mt-5 grid gap-4 border-t pt-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Change in level at reopening (July 2020)</dt>
          <dd className="tabular mt-1 font-medium">{est(v.level)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Change in trend, per year</dt>
          <dd className="tabular mt-1 font-medium">{est(v.slopePerYear)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Gap to the carried-forward trend, June 2025</dt>
          <dd className="tabular mt-1 font-medium">{est(v.gapAtEnd)}</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">
        {v.n} months; Newey–West standard errors with lag {v.lag}; t intervals on n − 15 degrees of
        freedom. Values are per month{v.unit === "$" ? ", per machine" : ""}.
      </p>
    </div>
  )
}
