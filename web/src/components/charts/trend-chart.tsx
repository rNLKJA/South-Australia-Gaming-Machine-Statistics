"use client"

import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

export type Datum = { key: string; label: string } & Record<string, number | string | null>

export interface SeriesSpec {
  key: string
  label: string
  color: string
  type?: "line" | "bar" | "area"
  dashed?: boolean
  /** Draw only hollow markers (used for a cross-source point). */
  markersOnly?: boolean
  stackId?: string
  strokeWidth?: number
}

export interface RefLine {
  y: number
  label: string
}

export interface Band {
  from: string
  to: string
  label: string
  tone: "event" | "gap"
}

const TICK = { fill: "var(--chart-axis)", fontSize: 12 }

export function TrendChart({
  data,
  series,
  yFormat,
  valueFormat,
  bands = [],
  height = 320,
  xTicks,
  xTickFormat,
  yDomain,
  ariaLabel,
  stackOffset,
  refLines = [],
  yTicks,
}: {
  data: Datum[]
  series: SeriesSpec[]
  yFormat: (v: number) => string
  valueFormat?: (v: number, seriesKey: string) => string
  bands?: Band[]
  height?: number
  xTicks?: string[]
  xTickFormat?: (key: string) => string
  yDomain?: [number | "auto" | "dataMin", number | "auto" | "dataMax"]
  ariaLabel: string
  stackOffset?: "expand" | "none"
  refLines?: RefLine[]
  yTicks?: number[]
}) {
  const fmt = valueFormat ?? ((v: number) => yFormat(v))
  const labelOf = new Map(data.map((d) => [d.key, d.label]))
  return (
    <div role="img" aria-label={ariaLabel} style={{ height }} className="w-full select-none">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: bands.length ? 22 : 8, right: 8, bottom: 0, left: 0 }}
          stackOffset={stackOffset}
          barCategoryGap="18%"
        >
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          {bands.map((b) => (
            <ReferenceArea
              key={`${b.from}-${b.label}`}
              x1={b.from}
              x2={b.to}
              ifOverflow="extendDomain"
              fill={b.tone === "gap" ? "var(--chart-gap)" : "var(--chart-band)"}
              stroke="none"
              label={{
                value: b.label,
                position: "top",
                fill: "var(--chart-axis)",
                fontSize: 11,
              }}
            />
          ))}
          {refLines.map((r) => (
            <ReferenceLine
              key={r.label}
              y={r.y}
              stroke="var(--chart-axis)"
              strokeDasharray="4 4"
              label={{
                value: r.label,
                position: "insideTopLeft",
                fill: "var(--chart-axis)",
                fontSize: 11,
              }}
            />
          ))}
          <XAxis
            dataKey="key"
            ticks={xTicks}
            interval={xTicks ? 0 : "preserveStartEnd"}
            tickFormatter={(k: string) => (xTickFormat ? xTickFormat(k) : (labelOf.get(k) ?? k))}
            tick={TICK}
            tickLine={false}
            axisLine={{ stroke: "var(--chart-axis)" }}
            minTickGap={8}
          />
          <YAxis
            tickFormatter={(v: number) => yFormat(v)}
            tick={TICK}
            tickLine={false}
            axisLine={false}
            width={64}
            domain={yDomain}
            ticks={yTicks}
          />
          <Tooltip
            cursor={{
              stroke: "var(--chart-axis)",
              strokeDasharray: "3 3",
              fill: "var(--chart-band)",
            }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              const rows = payload.filter((p) => p.value != null && p.value !== "")
              return (
                <div className="min-w-44 rounded-md border bg-popover px-3 py-2 text-sm shadow-md">
                  <p className="mb-1 font-semibold">
                    {labelOf.get(String(label)) ?? String(label)}
                  </p>
                  {rows.length === 0 ? (
                    <p className="text-muted-foreground">No data for this period</p>
                  ) : (
                    <ul className="space-y-0.5">
                      {rows.map((p) => {
                        const s = series.find((x) => x.key === p.dataKey)
                        return (
                          <li
                            key={String(p.dataKey)}
                            className="flex items-center justify-between gap-4"
                          >
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <span
                                className="inline-block size-2.5 rounded-sm"
                                style={{ background: s?.color }}
                                aria-hidden
                              />
                              {s?.label ?? String(p.dataKey)}
                            </span>
                            <span className="tabular font-medium">
                              {fmt(Number(p.value), String(p.dataKey))}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              )
            }}
          />
          {series.map((s) => {
            if (s.type === "bar") {
              return (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  fill={s.color}
                  stackId={s.stackId}
                  isAnimationActive={false}
                  maxBarSize={44}
                />
              )
            }
            if (s.type === "area") {
              return (
                <Area
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  type="linear"
                  stroke={s.color}
                  fill={s.color}
                  fillOpacity={0.85}
                  strokeWidth={0.5}
                  stackId={s.stackId}
                  isAnimationActive={false}
                  connectNulls={false}
                />
              )
            }
            if (s.markersOnly) {
              return (
                <Line
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  stroke="none"
                  dot={{ r: 5, stroke: s.color, strokeWidth: 2, fill: "var(--card)" }}
                  activeDot={{ r: 6, stroke: s.color, strokeWidth: 2, fill: "var(--card)" }}
                  isAnimationActive={false}
                />
              )
            }
            return (
              <Line
                key={s.key}
                dataKey={s.key}
                name={s.label}
                type="linear"
                stroke={s.color}
                strokeWidth={s.strokeWidth ?? 2}
                strokeDasharray={s.dashed ? "5 4" : undefined}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: s.color }}
                connectNulls={false}
                isAnimationActive={false}
              />
            )
          })}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

export function Legend({
  items,
}: {
  items: { label: string; color: string; dashed?: boolean; hollow?: boolean }[]
}) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-ink-soft">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          {i.hollow ? (
            <span
              className="inline-block size-2.5 rounded-full border-2 bg-card"
              style={{ borderColor: i.color }}
              aria-hidden
            />
          ) : i.dashed ? (
            <span
              className="inline-block h-0 w-4 border-t-2 border-dashed"
              style={{ borderColor: i.color }}
              aria-hidden
            />
          ) : (
            <span
              className="inline-block size-2.5 rounded-sm"
              style={{ background: i.color }}
              aria-hidden
            />
          )}
          {i.label}
        </li>
      ))}
    </ul>
  )
}
