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
import { fmtInt, fmtPct } from "@/lib/format"
import { fyLabel, fyShort, monthLabel } from "@/lib/fy"

export interface ShareSeries {
  leaders: string[]
  monthly: { month: string; shares: Record<string, number> | null; hhi: number | null }[]
  annual: { fy: string; shares: Record<string, number>; hhi: number; months: number }[]
}

const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "#8c7a5b",
  "#5f7f8c",
  "#a46a4f",
]
const OTHER_COLOR = "var(--chart-7)"

export function makerColor(leaders: string[], maker: string): string {
  const i = leaders.indexOf(maker)
  return i < 0 ? OTHER_COLOR : PALETTE[i % PALETTE.length]
}

export function ManufacturerExplorer({
  published,
  merged,
}: {
  published: ShareSeries
  merged: ShareSeries
}) {
  const [lineage, setLineage] = useState<"published" | "merged">("published")
  const [period, setPeriod] = useState<"monthly" | "annual">("monthly")
  const src = lineage === "merged" ? merged : published

  const { shareData, hhiData, series, bands, ticks } = useMemo(() => {
    const leaders = src.leaders
    const keys = [...leaders, "Other"]
    const series: SeriesSpec[] = keys.map((k) => ({
      key: k,
      label: k,
      color: k === "Other" ? OTHER_COLOR : makerColor(leaders, k),
      type: period === "monthly" ? "area" : "bar",
      stackId: "s",
    }))
    const split = (shares: Record<string, number> | null) => {
      const out: Record<string, number | null> = {}
      if (!shares) {
        for (const k of keys) out[k] = null
        return out
      }
      let other = 0
      for (const [m, s] of Object.entries(shares)) {
        if (leaders.includes(m)) out[m] = s
        else other += s
      }
      for (const l of leaders) out[l] ??= 0
      out.Other = other
      return out
    }
    if (period === "monthly") {
      const shareData: Datum[] = src.monthly.map((m) => ({
        key: m.month,
        label: monthLabel(m.month),
        ...split(m.shares),
      }))
      const hhiData: Datum[] = src.monthly.map((m) => ({
        key: m.month,
        label: monthLabel(m.month),
        hhi: m.hhi,
      }))
      const ticks = src.monthly
        .filter((m) => m.month.endsWith("-07") && Number(m.month.slice(0, 4)) % 2 === 1)
        .map((m) => m.month)
      const bands: Band[] = [{ from: "2023-10", to: "2023-12", label: "Missing", tone: "gap" }]
      return { shareData, hhiData, series, bands, ticks }
    }
    const shareData: Datum[] = src.annual.map((a) => ({
      key: a.fy,
      label: fyLabel(a.fy),
      ...split(a.shares),
    }))
    const hhiData: Datum[] = src.annual.map((a) => ({
      key: a.fy,
      label: `${fyLabel(a.fy)}${a.months < 12 ? ` (${a.months} months)` : ""}`,
      hhi: a.hhi,
    }))
    return { shareData, hhiData, series, bands: [] as Band[], ticks: undefined }
  }, [src, period])

  const xFmt =
    period === "monthly"
      ? (k: string) => k.slice(0, 4)
      : (k: string) => fyShort(k).replace(/^20/, "’").replace("/", "–")

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4 rounded-lg border bg-card p-4 sm:p-5">
        <Segmented
          label="Manufacturer names"
          value={lineage}
          onChange={setLineage}
          options={[
            { value: "published", label: "As published" },
            { value: "merged", label: "Combine Stargames, SGS, Light & Wonder" },
          ]}
        />
        <Segmented
          label="Period"
          value={period}
          onChange={setPeriod}
          options={[
            { value: "monthly", label: "Month" },
            { value: "annual", label: "Financial-year mean" },
          ]}
        />
      </div>

      <ChartFrame
        title="Share of machines in the field"
        description="Each manufacturer’s machines as a share of all machines listed that month. Makers that never reached 2.5% are pooled as Other."
        source="Source: CBS Gaming Manufacturer’s Market Reports, transcribed in the original workbook. Oct to Dec 2023 is missing from the archive."
      >
        <Legend items={series.map((s) => ({ label: s.label, color: s.color }))} />
        <div className="mt-3">
          <TrendChart
            data={shareData}
            series={series}
            bands={bands}
            yFormat={(v) => fmtPct(v, 0)}
            valueFormat={(v) => fmtPct(v, 1)}
            yDomain={[0, 1]}
            yTicks={[0, 0.25, 0.5, 0.75, 1]}
            xTicks={ticks}
            xTickFormat={xFmt}
            height={360}
            ariaLabel="Stacked shares of gaming machines by manufacturer over time. The table below lists annual shares."
          />
        </div>
      </ChartFrame>

      <ChartFrame
        title="Market concentration (Herfindahl–Hirschman index)"
        description={
          <>
            The HHI adds up the squares of every maker’s percentage share: 10,000 means one maker
            supplies every machine, and lower values mean a more even market. Under the 2010 US
            merger guidelines, values above 2,500 count as highly concentrated.
          </>
        }
        source="HHI computed from the monthly machine counts; the financial-year figure is the mean of the monthly values."
      >
        <TrendChart
          data={hhiData}
          series={[
            {
              key: "hhi",
              label: "HHI",
              color: "var(--chart-2)",
              type: period === "monthly" ? "line" : "bar",
              strokeWidth: 2,
            },
          ]}
          bands={bands}
          refLines={[
            { y: 2500, label: "2,500" },
            { y: 1500, label: "1,500" },
          ]}
          yFormat={(v) => fmtInt(v)}
          valueFormat={(v) => fmtInt(v)}
          yDomain={[0, 5000]}
          yTicks={[0, 1000, 2000, 3000, 4000, 5000]}
          xTicks={ticks}
          xTickFormat={xFmt}
          height={260}
          ariaLabel="Herfindahl–Hirschman index of manufacturer concentration over time, with reference lines at 1,500 and 2,500."
        />
      </ChartFrame>
    </div>
  )
}
