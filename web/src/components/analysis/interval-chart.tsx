"use client"

import {
  CartesianGrid,
  ComposedChart,
  ErrorBar,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { useElementWidth } from "@/hooks/use-element-width"
import { thinTicks, ticksThatFit } from "@/lib/ticks"

export interface IntervalDatum {
  key: string
  label: string
  estimate: number | null
  lower: number | null
  upper: number | null
  /** A line for the tooltip, e.g. "12 months". */
  note?: string
}

const TICK = { fill: "var(--chart-axis)", fontSize: 12 }
const Y_AXIS_WIDTH = 64
const MARGIN_RIGHT = 16
/** Approximate width of one character of the 11px reference label. */
const LABEL_CHAR_PX = 6

/**
 * Point estimates with 95% intervals by category (financial years). Missing categories keep their
 * slot on the axis so gaps in the series stay visible.
 */
export function IntervalChart({
  data,
  color = "var(--chart-1)",
  valueFormat,
  axisFormat,
  tickFormat,
  ariaLabel,
  height = 300,
  reference,
  yDomain,
  yTicks,
}: {
  data: IntervalDatum[]
  color?: string
  valueFormat: (v: number) => string
  axisFormat?: (v: number) => string
  tickFormat?: (key: string) => string
  ariaLabel: string
  height?: number
  /** A dashed horizontal line; `shortLabel` replaces `label` when the full text would not fit. */
  reference?: { y: number; label: string; shortLabel?: string }
  yDomain?: [number | "auto" | "dataMin", number | "auto" | "dataMax"]
  /** Explicit y-axis ticks (otherwise recharts picks them from the domain). */
  yTicks?: number[]
}) {
  const rows = data.map((d) => ({
    ...d,
    err:
      d.estimate != null && d.lower != null && d.upper != null
        ? [d.estimate - d.lower, d.upper - d.estimate]
        : null,
  }))
  const labelOf = new Map(data.map((d) => [d.key, d]))
  // Evenly spaced ticks that fit the measured width, always keeping the latest year (as TrendChart).
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const tickText = (k: string) => (tickFormat ? tickFormat(k) : k)
  const keys = data.map((d) => d.key)
  const longest = Math.max(1, ...keys.map((k) => tickText(k).length))
  const plotWidth = width - Y_AXIS_WIDTH - MARGIN_RIGHT
  const ticks = thinTicks(keys, width ? ticksThatFit(plotWidth, longest) : 8)
  const referenceLabel =
    reference?.shortLabel && width && reference.label.length * LABEL_CHAR_PX > plotWidth
      ? reference.shortLabel
      : reference?.label
  return (
    <div
      ref={ref}
      role="img"
      aria-label={ariaLabel}
      style={{ height }}
      className="w-full select-none"
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 10, right: MARGIN_RIGHT, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          {reference ? (
            <ReferenceLine
              y={reference.y}
              stroke="var(--chart-axis)"
              strokeDasharray="4 4"
              label={{
                value: referenceLabel,
                position: "insideTopLeft",
                fill: "var(--chart-axis)",
                fontSize: 11,
              }}
            />
          ) : null}
          <XAxis
            dataKey="key"
            tick={TICK}
            tickLine={false}
            axisLine={{ stroke: "var(--chart-axis)" }}
            ticks={ticks}
            interval={0}
            tickFormatter={tickText}
          />
          <YAxis
            tick={TICK}
            tickLine={false}
            axisLine={false}
            width={Y_AXIS_WIDTH}
            domain={yDomain ?? ["auto", "auto"]}
            {...(yTicks ? { ticks: yTicks } : {})}
            tickFormatter={(v: number) => (axisFormat ?? valueFormat)(v)}
          />
          <Tooltip
            cursor={{ stroke: "var(--chart-axis)", strokeDasharray: "3 3" }}
            content={({ active, label }) => {
              if (!active) return null
              const d = labelOf.get(String(label))
              if (!d) return null
              return (
                <div className="min-w-44 rounded-md border bg-popover px-3 py-2 text-sm shadow-md">
                  <p className="mb-1 font-semibold">{d.label}</p>
                  {d.estimate == null ? (
                    <p className="text-muted-foreground">{d.note ?? "Not available"}</p>
                  ) : (
                    <>
                      <p className="tabular font-medium">{valueFormat(d.estimate)}</p>
                      <p className="tabular text-muted-foreground">
                        95% interval {valueFormat(d.lower!)} to {valueFormat(d.upper!)}
                      </p>
                      {d.note ? <p className="text-muted-foreground">{d.note}</p> : null}
                    </>
                  )}
                </div>
              )
            }}
          />
          <Line
            dataKey="estimate"
            stroke="none"
            isAnimationActive={false}
            dot={{ r: 4, fill: color, stroke: "var(--card)", strokeWidth: 1.5 }}
            activeDot={{ r: 5, fill: color, stroke: "var(--card)" }}
            connectNulls={false}
          >
            <ErrorBar dataKey="err" width={5} stroke={color} strokeWidth={1.75} direction="y" />
          </Line>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
