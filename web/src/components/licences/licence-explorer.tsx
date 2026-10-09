"use client"

import { useMemo, useState } from "react"

import { ChartFrame } from "@/components/charts/chart-frame"
import {
  Legend,
  TrendChart,
  type Band,
  type Datum,
  type SeriesSpec,
} from "@/components/charts/trend-chart"
import { Segmented } from "@/components/common/segmented"
import { Switch } from "@/components/ui/switch"
import { fmtInt } from "@/lib/format"
import { fyLabel, fyShort, monthLabel } from "@/lib/fy"
import { LICENCE_MEASURES, type LicenceMeasure } from "@/lib/licences"
import { LICENCE_CATEGORIES, type LicenceCategory } from "@/lib/types"

export const CATEGORY_COLOR: Record<LicenceCategory, string> = {
  Hotels: "var(--chart-1)",
  Clubs: "var(--chart-2)",
  "Special Circumstances": "var(--chart-3)",
  Casino: "var(--chart-4)",
}

export interface LicenceAnnualCell {
  fy: string
  category: LicenceCategory
  mean: number | null
  end: number | null
}

export type LicenceMonthlyPoint = { month: string } & Partial<
  Record<LicenceCategory, number | null>
>

export function LicenceExplorer({
  annual,
  monthly,
}: {
  /** measure → annual cells */
  annual: Record<LicenceMeasure, LicenceAnnualCell[]>
  /** measure → monthly points (missing months included as empty rows) */
  monthly: Record<LicenceMeasure, LicenceMonthlyPoint[]>
}) {
  const [measure, setMeasure] = useState<LicenceMeasure>("entitlements")
  const [period, setPeriod] = useState<"mean" | "end" | "monthly">("end")
  const [casino, setCasino] = useState(true)
  const spec = LICENCE_MEASURES.find((m) => m.id === measure)!
  const cats = LICENCE_CATEGORIES.filter((c) => casino || c !== "Casino")

  const { data, series, bands, ticks } = useMemo(() => {
    const series: SeriesSpec[] = cats.map((c) => ({
      key: c,
      label: c,
      color: CATEGORY_COLOR[c],
      type: period === "monthly" ? "area" : "bar",
      stackId: "a",
    }))
    if (period === "monthly") {
      const data: Datum[] = monthly[measure].map((p) => {
        const d: Datum = { key: p.month, label: monthLabel(p.month) }
        for (const c of cats) d[c] = p[c] ?? null
        return d
      })
      const ticks = data
        .filter((d) => d.key.endsWith("-07") && Number(d.key.slice(0, 4)) % 2 === 1)
        .map((d) => d.key)
      const bands: Band[] = [
        { from: "2017-07", to: "2017-09", label: "Missing", tone: "gap" },
        { from: "2020-03", to: "2020-06", label: "COVID-19", tone: "event" },
      ]
      return { data, series, bands, ticks }
    }
    const byFy = new Map<string, Datum>()
    for (const cell of annual[measure]) {
      const d = byFy.get(cell.fy) ?? { key: cell.fy, label: fyLabel(cell.fy) }
      if (cats.includes(cell.category)) d[cell.category] = period === "mean" ? cell.mean : cell.end
      byFy.set(cell.fy, d)
    }
    const bands: Band[] = [{ from: "2019-20", to: "2019-20", label: "COVID-19", tone: "event" }]
    return { data: [...byFy.values()], series, bands, ticks: undefined }
  }, [annual, monthly, measure, period, cats])

  return (
    <ChartFrame
      title={`${spec.label} by licence category`}
      description={spec.help}
      source="Source: CBS Gaming Machine Licence Statistics (quarterly releases of monthly snapshots), transcribed in the original workbook."
    >
      <div className="mb-5 flex flex-wrap items-end gap-x-6 gap-y-4">
        <Segmented
          label="Measure"
          value={measure}
          onChange={setMeasure}
          options={LICENCE_MEASURES.map((m) => ({ value: m.id, label: m.label }))}
        />
        <Segmented
          label="Summarise each year by"
          value={period}
          onChange={setPeriod}
          options={[
            { value: "end", label: "End of year" },
            { value: "mean", label: "Mean of months" },
            { value: "monthly", label: "Every month" },
          ]}
        />
        <label className="flex items-center gap-2 pb-1 text-sm">
          <Switch checked={casino} onCheckedChange={(v) => setCasino(Boolean(v))} />
          Include the casino
        </label>
      </div>
      <Legend items={series.map((s) => ({ label: s.label, color: s.color }))} />
      <div className="mt-3">
        <TrendChart
          data={data}
          series={series}
          bands={bands}
          yFormat={(v) => fmtInt(v)}
          valueFormat={(v) => fmtInt(v)}
          xTicks={ticks}
          xTickFormat={
            period === "monthly"
              ? (k) => k.slice(0, 4)
              : (k) => fyShort(k).replace(/^20/, "’").replace("/", "–")
          }
          height={340}
          ariaLabel={`${spec.label} stacked by licence category. The table below lists the values.`}
        />
      </div>
    </ChartFrame>
  )
}
