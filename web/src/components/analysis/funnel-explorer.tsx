"use client"

import { useMemo, useState } from "react"
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Segmented } from "@/components/common/segmented"
import { fmtAud, fmtInt, fmtP, fmtPct } from "@/lib/format"
import { fyLabel, fyShort } from "@/lib/fy"
import type { FunnelZone } from "@/lib/stats/funnel"

export interface FunnelPointView {
  id: string
  label: string
  kind: "single" | "split" | "group"
  machines: number
  rate: number
  ratio: number
  zone: Record<"noise" | "overdispersed", FunnelZone>
}

export interface FunnelYearView {
  fy: string
  stateRate: number
  tau2: number
  phi: number
  points: FunnelPointView[]
  curves: {
    machines: number
    noise: { lower95: number; upper95: number; lower998: number; upper998: number }
    overdispersed: { lower95: number; upper95: number; lower998: number; upper998: number }
  }[]
  outside: Record<
    "noise" | "overdispersed",
    { count: number; n: number; share: number; expected: number; tailP: number }
  >
}

type LimitKind = "noise" | "overdispersed"

const ZONE_STYLE: Record<FunnelZone, { label: string; color: string }> = {
  above998: { label: "Above the 99.8% limit", color: "var(--chart-1)" },
  above95: { label: "Above the 95% limit", color: "var(--chart-3)" },
  within: { label: "Within the limits", color: "var(--chart-4)" },
  below95: { label: "Below the 95% limit", color: "var(--chart-5)" },
  below998: { label: "Below the 99.8% limit", color: "var(--chart-2)" },
}

const TICK = { fill: "var(--chart-axis)", fontSize: 12 }

export function FunnelExplorer({ years, c }: { years: FunnelYearView[]; c: number }) {
  const [fy, setFy] = useState(years.at(-1)!.fy)
  const [kind, setKind] = useState<LimitKind>("noise")
  const year = years.find((y) => y.fy === fy) ?? years.at(-1)!

  const curves = useMemo(
    () =>
      year.curves.map((p) => ({
        machines: p.machines,
        upper95: p[kind].upper95,
        lower95: p[kind].lower95,
        upper998: p[kind].upper998,
        lower998: p[kind].lower998,
      })),
    [year, kind]
  )
  const points = year.points.map((p) => ({ ...p, zoneNow: p.zone[kind] }))
  const counts = (Object.keys(ZONE_STYLE) as FunnelZone[]).map((z) => ({
    zone: z,
    n: points.filter((p) => p.zoneNow === z).length,
  }))
  const out = year.outside[kind]
  // the axis is scaled to the points; the limit curves for small areas run higher and are clipped
  const yMax =
    Math.ceil((Math.max(year.stateRate, ...year.points.map((p) => p.rate)) * 1.05) / 20000) * 20000

  return (
    <div>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <label className="flex flex-col gap-1.5">
          <span className="kicker text-muted-foreground">Financial year</span>
          <select
            value={fy}
            onChange={(e) => setFy(e.target.value)}
            className="h-8 rounded-lg border border-input bg-card px-2 text-base md:text-sm"
          >
            {years.map((y) => (
              <option key={y.fy} value={y.fy}>
                {fyLabel(y.fy)}
              </option>
            ))}
          </select>
        </label>
        <Segmented
          label="Control limits"
          value={kind}
          onChange={setKind}
          options={[
            { value: "noise", label: "Year-to-year noise" },
            { value: "overdispersed", label: "Plus between-council spread" },
          ]}
        />
      </div>
      <p className="mt-3 max-w-[72ch] text-sm text-muted-foreground">
        {kind === "noise"
          ? "Limits show how far an area of a given size usually moves from year to year by chance. Points outside them differ from the state rate by more than that noise."
          : `Limits also allow for the typical spread between councils (τ = ${Math.sqrt(year.tau2).toFixed(2)} on the log scale, Spiegelhalter’s winsorised estimate). Points outside them are unusual even among councils.`}
      </p>

      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-ink-soft">
        {counts
          .filter((c) => c.n > 0)
          .map((c) => (
            <li key={c.zone} className="flex items-center gap-1.5">
              <span
                className="inline-block size-2.5 rounded-full"
                style={{ background: ZONE_STYLE[c.zone].color }}
                aria-hidden
              />
              {ZONE_STYLE[c.zone].label} ({c.n})
            </li>
          ))}
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-0 w-4 border-t-2" aria-hidden />
          95% limits
        </li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-0 w-4 border-t-2 border-dashed" aria-hidden />
          99.8% limits
        </li>
      </ul>

      <div
        role="img"
        aria-label={`Funnel plot for ${fyLabel(year.fy)}: NGR per machine for ${year.points.length} council areas against their number of machines, with control limits around the state rate of ${fmtAud(year.stateRate)}. ${out.count} areas fall outside the 95% limits.`}
        className="mt-3 h-[380px] w-full select-none"
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart margin={{ top: 10, right: 12, bottom: 18, left: 0 }}>
            <CartesianGrid stroke="var(--chart-grid)" />
            <XAxis
              type="number"
              dataKey="machines"
              scale="log"
              domain={[10, 1500]}
              ticks={[10, 20, 50, 100, 200, 500, 1000]}
              allowDataOverflow
              tick={TICK}
              tickLine={false}
              axisLine={{ stroke: "var(--chart-axis)" }}
              label={{
                value: "Gaming machines in the area (log scale)",
                position: "insideBottom",
                offset: -10,
                fill: "var(--chart-axis)",
                fontSize: 12,
              }}
            />
            <YAxis
              type="number"
              dataKey="rate"
              domain={[0, yMax]}
              allowDataOverflow
              tick={TICK}
              tickLine={false}
              axisLine={false}
              width={64}
              tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`}
            />
            <ReferenceLine
              y={year.stateRate}
              stroke="var(--foreground)"
              strokeOpacity={0.55}
              label={{
                value: `State ${fmtAud(year.stateRate)}`,
                position: "insideTopLeft",
                fill: "var(--chart-axis)",
                fontSize: 11,
              }}
            />
            {(["upper95", "lower95"] as const).map((k) => (
              <Line
                key={k}
                data={curves}
                dataKey={k}
                stroke="var(--chart-axis)"
                strokeWidth={1.25}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
                legendType="none"
                tooltipType="none"
              />
            ))}
            {(["upper998", "lower998"] as const).map((k) => (
              <Line
                key={k}
                data={curves}
                dataKey={k}
                stroke="var(--chart-axis)"
                strokeWidth={1}
                strokeDasharray="4 3"
                dot={false}
                activeDot={false}
                isAnimationActive={false}
                legendType="none"
                tooltipType="none"
              />
            ))}
            <Scatter
              data={points}
              dataKey="rate"
              isAnimationActive={false}
              shape={(props: { cx?: number; cy?: number; payload?: (typeof points)[number] }) => {
                const { cx = 0, cy = 0, payload } = props
                if (!payload) return <g />
                const color = ZONE_STYLE[payload.zoneNow].color
                return payload.kind === "group" ? (
                  <rect
                    x={cx - 4.5}
                    y={cy - 4.5}
                    width={9}
                    height={9}
                    transform={`rotate(45 ${cx} ${cy})`}
                    fill={color}
                    stroke="var(--card)"
                    strokeWidth={1}
                  />
                ) : (
                  <circle cx={cx} cy={cy} r={5} fill={color} stroke="var(--card)" strokeWidth={1} />
                )
              }}
            />
            <Tooltip
              cursor={false}
              content={({ active, payload }) => {
                const p = payload?.find((x) => x.payload && "label" in x.payload)?.payload as
                  (typeof points)[number] | undefined
                if (!active || !p) return null
                return (
                  <div className="max-w-64 rounded-md border bg-popover px-3 py-2 text-sm shadow-md">
                    <p className="font-semibold">{p.label}</p>
                    {p.kind === "group" ? (
                      <p className="text-xs text-muted-foreground">Combined CBS group</p>
                    ) : null}
                    <p className="tabular mt-1">
                      {fmtAud(p.rate)} per machine · {fmtInt(p.machines)} machines
                    </p>
                    <p className="tabular text-muted-foreground">
                      {p.ratio.toFixed(2)}× the state rate
                    </p>
                    <p className="text-muted-foreground">{ZONE_STYLE[p.zoneNow].label}</p>
                  </div>
                )
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-sm text-ink-soft">
        <strong className="text-foreground">
          {out.count} of {out.n}
        </strong>{" "}
        areas ({fmtPct(out.share, 0)}) fall outside the 95% limits in {fyLabel(year.fy)}. If every
        area shared the state rate and the variance model held, about {out.expected.toFixed(1)} (5%)
        would by chance; {out.count} or more would happen with probability {fmtP(out.tailP)}{" "}
        (binomial, areas treated as independent).{" "}
        {kind === "overdispersed"
          ? "These limits are fitted to the same year’s spread, so the comparison is approximate. "
          : ""}
        The areas are every published area, not a sample, so the count gets no confidence interval.
        Diamonds are combined CBS groups. Scale: c = {c.toFixed(2)}; {fyShort(year.fy)}{" "}
        over-dispersion φ = {year.phi.toFixed(1)}.
      </p>
    </div>
  )
}
