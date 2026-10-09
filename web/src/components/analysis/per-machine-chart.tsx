"use client"

import { useState } from "react"

import { Segmented } from "@/components/common/segmented"
import { fmtAud } from "@/lib/format"
import { fyAxis, fyShort } from "@/lib/fy"

import { IntervalChart, type IntervalDatum } from "./interval-chart"

export interface PerMachineRow {
  fy: string
  months: number
  nominal: [number, number, number] | null
  real: [number, number, number] | null
  note: string | null
}

/** Annual NGR per machine with bootstrap intervals, nominal or real dollars. */
export function PerMachineChart({ rows }: { rows: PerMachineRow[] }) {
  const [dollars, setDollars] = useState<"real" | "nominal">("real")
  const data: IntervalDatum[] = rows.map((r) => {
    const v = r[dollars]
    return {
      key: r.fy,
      label: `FY ${fyShort(r.fy)}`,
      estimate: v?.[0] ?? null,
      lower: v?.[1] ?? null,
      upper: v?.[2] ?? null,
      note: v ? `${r.months} months resampled` : (r.note ?? undefined),
    }
  })
  return (
    <div>
      <Segmented
        label="Dollars"
        value={dollars}
        onChange={setDollars}
        options={[
          { value: "real", label: "Real (FY 2024/25)" },
          { value: "nominal", label: "Nominal" },
        ]}
      />
      <div className="mt-4">
        <IntervalChart
          data={data}
          valueFormat={(v) => fmtAud(v)}
          axisFormat={(v) => `$${Math.round(v / 1000)}k`}
          tickFormat={fyAxis}
          ariaLabel={`Annual NGR per machine in ${dollars === "real" ? "FY 2024/25" : "nominal"} dollars by financial year, with 95% bootstrap intervals over months. FY 2014/15 and FY 2019/20 are blank.`}
        />
      </div>
    </div>
  )
}
