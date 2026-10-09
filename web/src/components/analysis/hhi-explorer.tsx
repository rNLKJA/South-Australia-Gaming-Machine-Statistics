"use client"

import { useState } from "react"

import { Legend, TrendChart, type Datum } from "@/components/charts/trend-chart"
import { Segmented } from "@/components/common/segmented"
import { fmtInt } from "@/lib/format"
import { fyShort, monthLabel } from "@/lib/fy"

import { IntervalChart } from "./interval-chart"

export interface HhiVariantView {
  id: "published" | "lineage"
  label: string
  months: string[]
  monthly: Record<string, number>
  fitted: Record<string, number>
  tau: string
  tauLower: string
  tauUpper: string
  slopeBefore: [number, number, number]
  slopeAfter: [number, number, number]
  annual: { fy: string; months: number; hhi: [number, number, number] }[]
}

const per = (t: [number, number, number]) =>
  `${t[0] > 0 ? "+" : "−"}${fmtInt(Math.abs(t[0]))} (95% CI ${t[1] < 0 ? "−" : "+"}${fmtInt(Math.abs(t[1]))} to ${t[2] < 0 ? "−" : "+"}${fmtInt(Math.abs(t[2]))})`

/** Monthly HHI with the broken-stick fit and its break, plus annual means with intervals. */
export function HhiExplorer({
  variants,
  B,
  seed,
}: {
  variants: HhiVariantView[]
  B: number
  seed: number
}) {
  const [id, setId] = useState<HhiVariantView["id"]>("published")
  const v = variants.find((x) => x.id === id) ?? variants[0]
  const data: Datum[] = v.months.map((m) => ({
    key: m,
    label: monthLabel(m),
    hhi: v.monthly[m] ?? null,
    fitted: v.fitted[m] ?? null,
  }))
  const ticks = v.months.filter((m) => m.endsWith("-07") && Number(m.slice(0, 4)) % 2 === 1)
  return (
    <div className="space-y-10">
      <div>
        <Segmented
          label="Manufacturer names"
          value={id}
          onChange={setId}
          options={variants.map((x) => ({ value: x.id, label: x.label }))}
        />
        <div className="mt-4">
          <Legend
            items={[
              { label: "Monthly HHI", color: "var(--chart-2)" },
              { label: "Broken-stick fit", color: "var(--chart-1)", dashed: true },
            ]}
          />
        </div>
        <div className="mt-2">
          <TrendChart
            data={data}
            height={300}
            bands={[
              { from: v.tauLower, to: v.tauUpper, label: "Break (95% CI)", tone: "event" },
              { from: "2023-10", to: "2023-12", label: "", tone: "gap" },
            ]}
            series={[
              { key: "hhi", label: "Monthly HHI", color: "var(--chart-2)", strokeWidth: 2 },
              {
                key: "fitted",
                label: "Broken-stick fit",
                color: "var(--chart-1)",
                dashed: true,
                strokeWidth: 2,
              },
            ]}
            xTicks={ticks}
            xTickFormat={(k) => k.slice(0, 4)}
            yDomain={[2000, 4200]}
            yTicks={[2000, 2500, 3000, 3500, 4000]}
            yFormat={(x) => fmtInt(x)}
            valueFormat={(x) => fmtInt(x)}
            ariaLabel={`Monthly Herfindahl–Hirschman index, ${v.label.toLowerCase()}, July 2009 to June 2025, with a two-segment fit that breaks in ${monthLabel(v.tau)}.`}
          />
        </div>
        <dl className="mt-5 grid gap-4 border-t pt-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Break</dt>
            <dd className="tabular mt-1 font-medium">
              {monthLabel(v.tau)} (95% CI {monthLabel(v.tauLower)} to {monthLabel(v.tauUpper)})
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">HHI change per year before the break</dt>
            <dd className="tabular mt-1 font-medium">{per(v.slopeBefore)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">HHI change per year after the break</dt>
            <dd className="tabular mt-1 font-medium">{per(v.slopeAfter)}</dd>
          </div>
        </dl>
      </div>
      <div>
        <p className="mb-1 font-serif text-lg font-semibold">Annual mean HHI with 95% intervals</p>
        <p className="mb-4 max-w-[70ch] text-sm text-muted-foreground">
          Percentile bootstrap over the year’s months ({B.toLocaleString("en-AU")} resamples, seed{" "}
          {seed}). FY 2023/24 has nine months: the manufacturer reports for October to December 2023
          are missing.
        </p>
        <IntervalChart
          data={v.annual.map((a) => ({
            key: a.fy,
            label: `FY ${fyShort(a.fy)}`,
            estimate: a.hhi[0],
            lower: a.hhi[1],
            upper: a.hhi[2],
            note: `${a.months} months`,
          }))}
          color="var(--chart-2)"
          valueFormat={(x) => fmtInt(x)}
          tickFormat={(k) => fyShort(k).replace(/^20/, "’").replace("/", "–")}
          reference={{ y: 2500, label: "2,500: “highly concentrated” (US 2010 guidelines)" }}
          yDomain={[2000, 4000]}
          yTicks={[2000, 2500, 3000, 3500, 4000]}
          height={280}
          ariaLabel="Annual mean HHI by financial year with 95% bootstrap intervals over months; the intervals are narrow because concentration changes slowly within a year."
        />
      </div>
    </div>
  )
}
