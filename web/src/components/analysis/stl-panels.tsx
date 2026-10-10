"use client"

import { Legend, TrendChart, type Band, type Datum } from "@/components/charts/trend-chart"
import { fmtAxisMillions, fmtMillions } from "@/lib/format"
import { monthLabel } from "@/lib/fy"

export interface StlRow {
  month: string
  observed: number | null
  trend: number | null
  seasonal: number | null
  remainder: number | null
  /** Observed value repeated for months the robust fit set aside (weight below 0.5). */
  setAside: number | null
}

const BANDS: Band[] = [
  { from: "2014-07", to: "2015-06", label: "No release", tone: "gap" },
  { from: "2020-03", to: "2020-06", label: "Closures", tone: "event" },
]

/** STL components on one timeline: data with trend, then seasonal, then remainder. */
export function StlPanels({ rows }: { rows: StlRow[] }) {
  const data: Datum[] = rows.map((r) => ({
    key: r.month,
    label: monthLabel(r.month),
    observed: r.observed,
    trend: r.trend,
    seasonal: r.seasonal,
    remainder: r.remainder,
    setAside: r.setAside,
  }))
  const ticks = rows
    .filter((r) => r.month.endsWith("-07") && Number(r.month.slice(0, 4)) % 2 === 1)
    .map((r) => r.month)
  const common = {
    data,
    xTicks: ticks,
    xTickFormat: (k: string) => k.slice(0, 4),
    yFormat: fmtAxisMillions,
    valueFormat: (v: number) => (v < 0 ? `−${fmtMillions(-v, 2)}` : fmtMillions(v, 2)),
  }
  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-semibold">Monthly NGR and its trend</p>
        <Legend
          items={[
            { label: "Monthly NGR", color: "var(--chart-4)" },
            { label: "Trend", color: "var(--chart-1)" },
            { label: "Set aside by the robust fit", color: "var(--chart-3)", hollow: true },
          ]}
        />
        <div className="mt-2">
          <TrendChart
            {...common}
            bands={BANDS}
            height={260}
            series={[
              { key: "observed", label: "Monthly NGR", color: "var(--chart-4)", strokeWidth: 1.25 },
              { key: "trend", label: "Trend", color: "var(--chart-1)", strokeWidth: 2.5 },
              {
                key: "setAside",
                label: "Set aside by the robust fit",
                color: "var(--chart-3)",
                markersOnly: true,
              },
            ]}
            ariaLabel="Monthly net gambling revenue in FY 2024/25 dollars with its STL trend, July 2009 to June 2025, with a gap for FY 2014/15."
          />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-semibold">Seasonal component</p>
          <TrendChart
            {...common}
            height={190}
            series={[{ key: "seasonal", label: "Seasonal", color: "var(--chart-2)" }]}
            ariaLabel="The seasonal component of monthly NGR, a repeating within-year pattern of a few million dollars."
          />
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold">Remainder</p>
          <TrendChart
            {...common}
            height={190}
            series={[
              { key: "remainder", label: "Remainder", color: "var(--chart-4)", type: "bar" },
            ]}
            ariaLabel="The remainder after removing trend and seasonality; the 2020 closures stand out as large negative values."
          />
        </div>
      </div>
    </div>
  )
}
