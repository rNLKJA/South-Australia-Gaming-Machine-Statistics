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
import { fmtAud, fmtAudCompact, fmtInt, fmtMillions } from "@/lib/format"
import { fyShort, monthLabel } from "@/lib/fy"
import type { StatewideMeasure, StatewideYear } from "@/lib/statewide"
import type { FY, Month } from "@/lib/types"

export interface MonthlyRow {
  month: Month
  fy: FY
  ngr: number | null
  tax: number | null
  venueShare: number | null
  machines: number | null
  venues: number | null
  ngrPerMachine: number | null
}

const MEASURES: { value: StatewideMeasure; label: string; money: boolean; per: boolean }[] = [
  { value: "ngr", label: "Net gambling revenue", money: true, per: false },
  { value: "tax", label: "Gaming tax", money: true, per: false },
  { value: "venueShare", label: "Venue share", money: true, per: false },
  { value: "ngrPerMachine", label: "NGR per machine", money: true, per: true },
  { value: "machines", label: "Machines", money: false, per: false },
  { value: "venues", label: "Venues", money: false, per: false },
]

const DESCRIPTIONS: Record<StatewideMeasure, string> = {
  ngr: "Net gambling revenue is what players lost on gaming machines in hotels and clubs: money wagered minus prizes paid out.",
  tax: "Gaming tax liability assessed on NGR.",
  venueShare: "The part of NGR kept by venues after gaming tax.",
  ngrPerMachine:
    "NGR divided by the number of machines: annual NGR over the mean monthly machine count, or monthly NGR over that month’s machines. Not computed for FY 2019/20 or for months when CBS reported zero machines.",
  machines:
    "Gaming machines in hotels and clubs (the Adelaide Casino is excluded). Annual values are the mean of the monthly counts.",
  venues:
    "Venues that operated machines at any time in the month. Annual values are the mean of the monthly counts.",
}

function annualPick(y: StatewideYear, m: StatewideMeasure): number | null {
  if (m === "machines") return y.machinesMean
  if (m === "venues") return y.venuesMean
  return y[m]
}

export function StatewideExplorer({
  monthly,
  monthlyReal,
  annual,
  annualReal,
  lgaFill,
  baseFyLabel,
  cpiNote,
}: {
  monthly: MonthlyRow[]
  monthlyReal: MonthlyRow[]
  annual: StatewideYear[]
  annualReal: StatewideYear[]
  lgaFill: { fy: FY; nominal: number; real: number }
  baseFyLabel: string
  cpiNote: string
}) {
  const [measure, setMeasure] = useState<StatewideMeasure>("ngr")
  const [view, setView] = useState<"annual" | "monthly">("annual")
  const [dollars, setDollars] = useState<"nominal" | "real">("nominal")
  const spec = MEASURES.find((m) => m.value === measure)!
  const real = spec.money && dollars === "real"

  const { data, series, bands, ticks } = useMemo(() => {
    const color = spec.money ? "var(--chart-1)" : "var(--chart-2)"
    if (view === "annual") {
      const src = real ? annualReal : annual
      const data: Datum[] = src.map((y, i) => {
        const d: Datum = { key: y.fy, label: `FY ${fyShort(y.fy)}`, value: annualPick(y, measure) }
        if (real) d.nominal = annualPick(annual[i], measure)
        if (measure === "ngr" && y.fy === lgaFill.fy) d.lga = real ? lgaFill.real : lgaFill.nominal
        return d
      })
      const series: SeriesSpec[] = [
        {
          key: "value",
          label: real ? `${spec.label} (${baseFyLabel} dollars)` : spec.label,
          color,
          type: spec.per || !spec.money ? "line" : "bar",
        },
      ]
      if (spec.per || !spec.money) series[0].strokeWidth = 2.5
      if (real)
        series.push({
          key: "nominal",
          label: "Nominal dollars",
          color: "var(--chart-4)",
          dashed: true,
        })
      if (measure === "ngr")
        series.push({
          key: "lga",
          label: "FY 2014/15 total from the LGA release",
          color: "var(--chart-1)",
          markersOnly: true,
        })
      const bands: Band[] = [
        { from: "2014-15", to: "2014-15", label: "No release", tone: "gap" },
        { from: "2019-20", to: "2019-20", label: "COVID-19", tone: "event" },
      ]
      return { data, series, bands, ticks: undefined as string[] | undefined }
    }
    const src = real ? monthlyReal : monthly
    const data: Datum[] = src.map((r, i) => {
      const d: Datum = { key: r.month, label: monthLabel(r.month), value: r[measure] }
      if (real) d.nominal = monthly[i][measure]
      return d
    })
    const series: SeriesSpec[] = [
      {
        key: "value",
        label: real ? `${spec.label} (${baseFyLabel} dollars)` : spec.label,
        color,
        strokeWidth: 1.75,
      },
    ]
    if (real)
      series.push({
        key: "nominal",
        label: "Nominal dollars",
        color: "var(--chart-4)",
        dashed: true,
        strokeWidth: 1.25,
      })
    const bands: Band[] = [
      { from: "2014-07", to: "2015-06", label: "No release", tone: "gap" },
      { from: "2020-03", to: "2020-06", label: "Closures", tone: "event" },
    ]
    const ticks = src
      .filter((r) => r.month.endsWith("-07") && Number(r.month.slice(0, 4)) % 2 === 1)
      .map((r) => r.month)
    return { data, series, bands, ticks }
  }, [view, real, annual, annualReal, monthly, monthlyReal, measure, spec, lgaFill, baseFyLabel])

  const yFormat = (v: number) => {
    if (measure === "ngrPerMachine") return fmtAudCompact(v)
    if (spec.money) return `$${fmtInt(v)}m`
    return fmtInt(v)
  }
  const valueFormat = (v: number) => {
    if (measure === "ngrPerMachine") return fmtAud(v)
    if (spec.money) return fmtMillions(v, 2)
    return view === "annual" && !Number.isInteger(v)
      ? v.toLocaleString("en-AU", { maximumFractionDigits: 1 })
      : fmtInt(v)
  }

  const legendItems = series.map((s) => ({
    label: s.label,
    color: s.color,
    dashed: s.dashed,
    hollow: s.markersOnly,
  }))

  return (
    <ChartFrame
      title={`${spec.label}, ${view === "annual" ? "by financial year" : "by month"}`}
      description={DESCRIPTIONS[measure]}
      source={
        <>
          Source: CBS Gaming Statistics (Statewide), transcribed in the original workbook. Shaded:
          FY 2014/15 (no statewide release archived) and the COVID-19 venue closures of 2020.
          {real ? ` ${cpiNote}` : null}
        </>
      }
    >
      <div className="mb-5 flex flex-wrap items-end gap-x-6 gap-y-4">
        <Segmented
          label="Measure"
          value={measure}
          onChange={setMeasure}
          options={MEASURES.map((m) => ({ value: m.value, label: m.label }))}
        />
        <Segmented
          label="Period"
          value={view}
          onChange={setView}
          options={[
            { value: "annual", label: "Financial year" },
            { value: "monthly", label: "Month" },
          ]}
        />
        <Segmented
          label="Dollars"
          value={spec.money ? dollars : "nominal"}
          onChange={setDollars}
          options={[
            { value: "nominal", label: "Nominal" },
            { value: "real", label: `Real (${baseFyLabel})`, disabled: !spec.money },
          ]}
        />
      </div>
      <Legend items={legendItems} />
      <div className="mt-3">
        <TrendChart
          data={data}
          series={series}
          bands={bands}
          yFormat={yFormat}
          valueFormat={valueFormat}
          xTicks={ticks}
          xTickFormat={
            view === "annual"
              ? (k) => fyShort(k).replace(/^20/, "’").replace("/", "–")
              : (k) => k.slice(0, 4)
          }
          height={340}
          ariaLabel={`${spec.label} ${view === "annual" ? "by financial year" : "by month"}, FY 2009/10 to FY 2024/25. The table below lists the annual values.`}
        />
      </div>
    </ChartFrame>
  )
}
