import { fyShort } from "@/lib/fy"
import type { PersistentRatio } from "@/lib/analysis/councils"

const MIN = 0.1
const MAX = 2.5
const TICKS = [0.1, 0.25, 0.5, 1, 2]

function pos(x: number): number {
  const v = Math.min(MAX, Math.max(MIN, x))
  return ((Math.log(v) - Math.log(MIN)) / (Math.log(MAX) - Math.log(MIN))) * 100
}

const COLOR = {
  above: "var(--terracotta)",
  below: "var(--teal)",
  unclear: "var(--chart-4)",
} as const

const GRID =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 md:grid-cols-[minmax(0,1.2fr)_9rem_minmax(0,1.5fr)]"

/**
 * A forest plot as a list: each area's typical NGR per machine relative to the state rate, with a
 * 95% interval from its year-to-year variation, on a log scale centred on 1 (the state rate).
 */
export function RatioForest({ rows }: { rows: PersistentRatio[] }) {
  return (
    <div className="rounded-lg border bg-card">
      <div className={`${GRID} border-b px-4 py-2 text-xs font-medium text-muted-foreground`}>
        <span>Area (as published by CBS) and years</span>
        <span className="text-right">Ratio (95% CI)</span>
        <span className="relative col-span-2 mx-3 h-4 md:col-span-1" aria-hidden>
          {TICKS.map((t) => (
            <span
              key={t}
              className="tabular absolute -translate-x-1/2"
              style={{ left: `${pos(t)}%` }}
            >
              {t}×
            </span>
          ))}
        </span>
      </div>
      <ol className="divide-y">
        {rows.map((r) => (
          <li key={r.id} className={`${GRID} px-4 py-2 text-sm`}>
            <span className="min-w-0">
              <span className="font-medium">{r.label}</span>
              {r.kind === "group" ? (
                <span className="ml-1.5 text-xs text-muted-foreground">group</span>
              ) : null}
              <span className="tabular block text-xs text-muted-foreground">
                {r.years} years, FY {fyShort(r.firstFy)} to {fyShort(r.lastFy)}
              </span>
            </span>
            <span className="tabular text-right text-ink-soft">
              {r.ratio.estimate.toFixed(2)}×
              <span className="block text-xs text-muted-foreground">
                {r.ratio.lower.toFixed(2)} to {r.ratio.upper.toFixed(2)}
              </span>
            </span>
            <span className="relative col-span-2 mx-3 h-4 md:col-span-1" aria-hidden>
              <span
                className="absolute inset-y-0 w-px bg-foreground/40"
                style={{ left: `${pos(1)}%` }}
              />
              <span
                className="absolute top-1/2 h-0.5 -translate-y-1/2 rounded"
                style={{
                  left: `${pos(r.ratio.lower)}%`,
                  width: `${Math.max(0.6, pos(r.ratio.upper) - pos(r.ratio.lower))}%`,
                  background: COLOR[r.direction],
                }}
              />
              <span
                className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ left: `${pos(r.ratio.estimate)}%`, background: COLOR[r.direction] }}
              />
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
