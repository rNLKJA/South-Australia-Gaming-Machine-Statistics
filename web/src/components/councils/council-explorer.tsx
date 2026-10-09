"use client"

import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, X } from "lucide-react"
import dynamic from "next/dynamic"
import { useTheme } from "next-themes"
import { useCallback, useMemo, useState, useSyncExternalStore } from "react"

import { Legend, TrendChart, type Datum, type SeriesSpec } from "@/components/charts/trend-chart"
import { Segmented } from "@/components/common/segmented"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { useGeoJson } from "@/hooks/use-geojson"
import { fmtAud, fmtAudCompact, fmtInt } from "@/lib/format"
import { fyAxis, fyLabel, fyShort } from "@/lib/fy"
import { pointInGeometry } from "@/lib/geo"
import {
  areaHistory,
  areaYear,
  groupingThreshold,
  LGA_MEASURES,
  LGA_NO_MACHINES_FY,
  measureValue,
  rankUnits,
  sortForMeasure,
  sortUnits,
  type AreaYear,
  type LgaMeasure,
  type LgaSort,
  type LgaSortCol,
} from "@/lib/lga"
import { classIndex, quantileBreaks } from "@/lib/stats"
import type { FY, LgaUnit } from "@/lib/types"
import { cn } from "@/lib/utils"

import type { HoverInfo, MapMode } from "./lga-map"
import { hatchCss, NOT_PUBLISHED, RAMP } from "./palette"
import { PlaceSearch, type PlaceResult } from "./place-search"

const MAP_HEIGHT = "h-[420px] sm:h-[540px]"

function MapPlaceholder({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "grid place-items-center rounded-lg border bg-muted text-sm text-muted-foreground",
        MAP_HEIGHT
      )}
    >
      {children}
    </div>
  )
}

// MapLibre (and its stylesheet) load only on this page, after hydration.
const LgaMap = dynamic(() => import("./lga-map").then((m) => m.LgaMap), {
  ssr: false,
  loading: () => <MapPlaceholder>Loading map…</MapPlaceholder>,
})

/** The councils chosen on the map, in the table or by a place search, followed across years. */
interface AreaSelection {
  members: string[]
  label: string
}

/** Rows of the ranked table shown on small screens before "Show all". */
const MOBILE_ROWS = 12

function formatMeasure(measure: LgaMeasure, v: number | null, compact = false): string {
  if (v == null) return "–"
  if (measure === "machines" || measure === "premises") return fmtInt(v)
  return compact ? fmtAudCompact(v) : fmtAud(v)
}

/** A measure label for use mid-sentence: lower case, but keep the "NGR" acronym. */
function inSentence(label: string): string {
  return label.startsWith("NGR") ? label : label.toLowerCase()
}

function mapKey(u: LgaUnit): string {
  return u.codes.length > 1 ? u.geoKey : (u.codes[0] ?? "")
}

const subscribe = () => () => {}

export function CouncilExplorer({
  units,
  fys,
  councilNames,
}: {
  units: LgaUnit[]
  fys: FY[]
  /** ABS LGA code → the council name used on this site (from the crosswalk). */
  councilNames: Record<string, string>
}) {
  const [fyIndex, setFyIndex] = useState(fys.length - 1)
  const [measure, setMeasure] = useState<LgaMeasure>("ngr")
  const [selection, setSelection] = useState<AreaSelection | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)
  const [focusPoint, setFocusPoint] = useState<[number, number] | null>(null)
  /** The last searched place and the council it fell in (null code: outside every boundary). */
  const [searched, setSearched] = useState<{ label: string; code: string | null } | null>(null)
  const [sort, setSort] = useState<LgaSort>({ col: "ngr", dir: "desc" })
  const { resolvedTheme } = useTheme()
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  )
  const mode: MapMode = mounted && resolvedTheme === "dark" ? "dark" : "light"

  const councils = useGeoJson("/data/lga-councils.geojson")
  const groups = useGeoJson("/data/lga-groups.geojson")

  const fy = fys[fyIndex]
  const fyUnits = useMemo(() => units.filter((u) => u.fy === fy), [units, fy])
  const measureSpec = LGA_MEASURES.find((m) => m.id === measure)!
  const noMachines =
    fy === LGA_NO_MACHINES_FY && (measure === "machines" || measure === "ngrPerMachine")

  const { breaks, colorOf, singleColors, groupColors, byKey, rankOf, hasUnpublished } =
    useMemo(() => {
      const vals = fyUnits
        .map((u) => measureValue(u, measure))
        .filter((v): v is number => v != null)
      const breaks = quantileBreaks(vals, 5)
      const ramp = RAMP[mode]
      // Every published area gets a colour, including those without a value for the measure,
      // so the map keeps its group outlines, tooltips and selection in every year.
      const colorOf = (v: number | null) =>
        v == null ? NOT_PUBLISHED[mode] : ramp[Math.min(classIndex(v, breaks), ramp.length - 1)]
      const singleColors: Record<string, string> = {}
      const groupColors: Record<string, string> = {}
      const byKey = new Map<string, LgaUnit>()
      for (const u of fyUnits) {
        const k = mapKey(u)
        if (!k) continue
        byKey.set(k, u)
        const c = colorOf(measureValue(u, measure))
        if (u.codes.length > 1) groupColors[k] = c
        else singleColors[k] = c
      }
      const rankOf = new Map(
        rankUnits(fyUnits, measure, "desc").map((u, i) => [
          u.id,
          measureValue(u, measure) == null ? null : i + 1,
        ])
      )
      const hasUnpublished = vals.length < fyUnits.length
      return { breaks, colorOf, singleColors, groupColors, byKey, rankOf, hasUnpublished }
    }, [fyUnits, measure, mode])

  // The published rows that hold the selected councils in the year on screen (one, several, or a
  // wider group), highlighted together on the map and in the table.
  const selectedYear = useMemo(
    () => (selection ? areaYear(units, selection.members, fy) : null),
    [units, selection, fy]
  )
  const selectedIds = new Set(selectedYear?.units.map((u) => u.id))
  const selectedKeys = (selectedYear?.units ?? []).map(mapKey).filter(Boolean)
  const selectUnit = (u: LgaUnit) => setSelection({ members: u.members, label: u.label })

  const rows = useMemo(() => sortUnits(fyUnits, sort), [fyUnits, sort])

  const describe = useCallback(
    (key: string): HoverInfo | null => {
      const u = byKey.get(key)
      if (!u) return null
      const v = measureValue(u, measure)
      return {
        title: u.label,
        value: `${measureSpec.label}: ${v == null ? `not published for ${fyLabel(u.fy)}` : formatMeasure(measure, v)}`,
        note:
          u.kind === "group"
            ? `Published as one combined group of ${u.members.length} areas`
            : undefined,
      }
    },
    [byKey, measure, measureSpec.label]
  )

  const selectKey = useCallback(
    (key: string | null) => {
      const u = key ? byKey.get(key) : undefined
      setSelection(u ? { members: u.members, label: u.label } : null)
      setSearched(null)
    },
    [byKey]
  )

  const onPick = (p: PlaceResult) => {
    setFocusPoint([p.lon, p.lat])
    const hit = councils.data?.features.find((f) => pointInGeometry([p.lon, p.lat], f.geometry))
    const code = hit ? String(hit.properties?.code) : null
    // Follow the area the council is published in this year, or the council on its own.
    const u = code ? fyUnits.find((x) => x.codes.includes(code)) : undefined
    const name = code ? councilNames[code] : undefined
    setSelection(
      u ? { members: u.members, label: u.label } : name ? { members: [name], label: name } : null
    )
    setSearched({ label: p.label, code })
  }

  // Described for the year on screen, so it follows the slider.
  const searchNote = searched ? describePlace(searched, fy, fyUnits, councilNames) : null

  const changeMeasure = (m: LgaMeasure) => {
    setMeasure(m)
    setSort((s) => sortForMeasure(s, m))
  }

  const toggleSort = (col: LgaSortCol) =>
    setSort((s) =>
      s.col === col
        ? { col, dir: s.dir === "desc" ? "asc" : "desc" }
        : { col, dir: col === "label" ? "asc" : "desc" }
    )

  const legend = breaks.length
    ? [null, ...breaks].map((lo, i) => ({
        color: RAMP[mode][i],
        label:
          i === 0
            ? `under ${formatMeasure(measure, breaks[0], true)}`
            : i === breaks.length
              ? `${formatMeasure(measure, lo, true)} or more`
              : `${formatMeasure(measure, lo, true)} – ${formatMeasure(measure, breaks[i], true)}`,
      }))
    : []

  return (
    <div className="space-y-6">
      <div className="grid gap-5 rounded-lg border bg-card p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,0.9fr)] lg:items-end">
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="kicker text-muted-foreground" id="fy-label">
              Financial year
            </span>
            <span className="tabular font-serif text-2xl font-semibold" aria-live="polite">
              {fyLabel(fy)}
            </span>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              className="grid size-7 shrink-0 place-items-center rounded-md border hover:bg-accent disabled:opacity-40"
              onClick={() => setFyIndex((i) => Math.max(0, i - 1))}
              disabled={fyIndex === 0}
              aria-label="Previous financial year"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <Slider
              min={0}
              max={fys.length - 1}
              step={1}
              value={[fyIndex]}
              onValueChange={(v) => setFyIndex(Array.isArray(v) ? v[0] : v)}
              thumbLabel="Financial year"
              getAriaValueText={(_formatted, value) => fyLabel(fys[value])}
              className="[&_[data-slot=slider-range]]:bg-terracotta [&_[data-slot=slider-thumb]]:size-4 [&_[data-slot=slider-thumb]]:border-terracotta"
            />
            <button
              type="button"
              className="grid size-7 shrink-0 place-items-center rounded-md border hover:bg-accent disabled:opacity-40"
              onClick={() => setFyIndex((i) => Math.min(fys.length - 1, i + 1))}
              disabled={fyIndex === fys.length - 1}
              aria-label="Next financial year"
            >
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>
          <div className="tabular mt-1.5 flex justify-between text-xs text-muted-foreground">
            <span>{fyShort(fys[0])}</span>
            <span>{fyShort(fys.at(-1)!)}</span>
          </div>
        </div>
        <Segmented
          label="Measure"
          value={measure}
          onChange={changeMeasure}
          options={LGA_MEASURES.map((m) => ({ value: m.id, label: m.short }))}
        />
        <PlaceSearch onPick={onPick} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          {councils.data && groups.data ? (
            <LgaMap
              councils={councils.data}
              groups={groups.data}
              singleColors={singleColors}
              groupColors={groupColors}
              selectedKeys={selectedKeys}
              hoveredKey={hoveredKey}
              focusPoint={focusPoint}
              mode={mode}
              onHover={setHoveredKey}
              onSelect={selectKey}
              describe={describe}
              className={MAP_HEIGHT}
            />
          ) : (
            <MapPlaceholder>
              {councils.error || groups.error
                ? "The council boundaries couldn’t be loaded. The table has every figure."
                : "Loading council boundaries…"}
            </MapPlaceholder>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-soft">
            <span className="font-medium text-foreground">{measureSpec.label}</span>
            {noMachines ? (
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block h-3 w-5 rounded-sm"
                  style={{ background: NOT_PUBLISHED[mode] }}
                  aria-hidden
                />
                Machine counts not published for {fyLabel(fy)}
              </span>
            ) : (
              legend.map((l) => (
                <span key={l.label} className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-3 w-5 rounded-sm"
                    style={{ background: l.color }}
                    aria-hidden
                  />
                  <span className="tabular">{l.label}</span>
                </span>
              ))
            )}
            {hasUnpublished && !noMachines ? (
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block h-3 w-5 rounded-sm"
                  style={{ background: NOT_PUBLISHED[mode] }}
                  aria-hidden
                />
                Not published
              </span>
            ) : null}
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block h-3 w-5 rounded-sm border border-black/10 dark:border-white/15"
                style={{ background: hatchCss(mode) }}
                aria-hidden
              />
              No venues reported
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block h-0 w-5 border-t-2 border-dashed border-foreground"
                aria-hidden
              />
              Combined group
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Five classes, each holding about a fifth of the published areas for the year.{" "}
            {measureSpec.help} In {fyLabel(fy)} CBS grouped councils with fewer than{" "}
            {groupingThreshold(fy) === 5 ? "five" : "three"} venues.
          </p>
        </div>

        <div className="flex min-h-0 flex-col rounded-lg border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="text-lg leading-snug font-semibold">
              Ranked by {inSentence(measureSpec.label)}
            </h2>
            <p className="tabular mt-0.5 text-xs text-muted-foreground">
              {fyLabel(fy)} · {fyUnits.length} published areas
            </p>
          </div>
          <div className="lg:max-h-[540px] lg:overflow-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">
                Council areas ranked by {inSentence(measureSpec.label)} for {fyLabel(fy)}. Select a
                row to highlight it on the map.
              </caption>
              <thead className="z-10 bg-card shadow-[0_1px_0_var(--border)] lg:sticky lg:top-0">
                <tr>
                  <th
                    scope="col"
                    className="w-10 px-3 py-2 text-left text-xs font-medium text-muted-foreground"
                  >
                    #
                  </th>
                  <SortHeader
                    col="label"
                    label="Area"
                    sort={sort}
                    onSort={toggleSort}
                    align="left"
                  />
                  <SortHeader
                    col={measure}
                    label={measureSpec.short}
                    sort={sort}
                    onSort={toggleSort}
                  />
                  {measure !== "premises" ? (
                    <SortHeader
                      col="premises"
                      label="Venues"
                      sort={sort}
                      onSort={toggleSort}
                      className="hidden sm:table-cell"
                    />
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((u, i) => {
                  const v = measureValue(u, measure)
                  const selected = selectedIds.has(u.id)
                  return (
                    <tr
                      key={u.id}
                      className={cn(
                        "border-b last:border-0",
                        selected ? "bg-teal-soft" : "hover:bg-accent/60",
                        hoveredKey === mapKey(u) && !selected && "bg-accent/60",
                        // Phones show the top rows first; "Show all" lists the rest in the page.
                        i >= MOBILE_ROWS && !showAll && !selected && "hidden lg:table-row"
                      )}
                      onMouseEnter={() => setHoveredKey(mapKey(u))}
                      onMouseLeave={() => setHoveredKey(null)}
                    >
                      <td className="tabular px-3 py-2 text-xs text-muted-foreground">
                        {rankOf.get(u.id) ?? "–"}
                      </td>
                      <td className="py-1.5 pr-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (selected) setSelection(null)
                            else selectUnit(u)
                            setSearched(null)
                          }}
                          aria-pressed={selected}
                          className="flex w-full items-start gap-2 rounded text-left"
                        >
                          <span
                            className="mt-1 inline-block size-2.5 shrink-0 rounded-sm"
                            style={{ background: colorOf(v) }}
                            aria-hidden
                          />
                          <span className="min-w-0">
                            <span className="block leading-snug font-medium">{u.label}</span>
                            {u.kind === "group" ? (
                              <span className="text-xs text-muted-foreground">
                                Combined group of {u.members.length}
                              </span>
                            ) : u.kind === "split" ? (
                              <span className="text-xs text-muted-foreground">
                                One council, {u.workbookRows} workbook rows
                              </span>
                            ) : null}
                          </span>
                        </button>
                      </td>
                      <td className="tabular px-3 py-2 text-right whitespace-nowrap">
                        {formatMeasure(measure, v, true)}
                      </td>
                      {measure !== "premises" ? (
                        <td className="tabular hidden px-3 py-2 text-right sm:table-cell">
                          {fmtInt(u.premises)}
                        </td>
                      ) : null}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {rows.length > MOBILE_ROWS ? (
            <div className="border-t px-4 py-2.5 lg:hidden">
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                aria-expanded={showAll}
                className="text-sm font-medium text-teal hover:underline"
              >
                {showAll ? `Show the top ${MOBILE_ROWS}` : `Show all ${rows.length} areas`}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {searchNote ? (
        <p
          className="rounded-md border-l-[3px] border-teal bg-teal-soft/50 px-4 py-2 text-sm"
          aria-live="polite"
        >
          {searchNote}
        </p>
      ) : null}

      {selection ? (
        <AreaPanel
          selection={selection}
          units={units}
          fys={fys}
          measure={measure}
          currentFy={fy}
          onClose={() => {
            setSelection(null)
            setFocusPoint(null)
            setSearched(null)
          }}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Select an area on the map or in the table to see its figures across every year.
        </p>
      )}
    </div>
  )
}

/** The sentence shown after a place search, for the financial year on screen. */
function describePlace(
  place: { label: string; code: string | null },
  fy: FY,
  fyUnits: LgaUnit[],
  councilNames: Record<string, string>
): string {
  if (!place.code) return `${place.label} is outside every council boundary in the bundled map.`
  const name = councilNames[place.code] ?? "an unnamed council area"
  const u = fyUnits.find((x) => x.codes.includes(place.code!))
  if (!u)
    return `${place.label} is in ${name}, which had no gaming venues reported in ${fyLabel(fy)}.`
  if (u.kind !== "group")
    return `${place.label} is in ${name}, published on its own in ${fyLabel(fy)}.`
  const others = u.members.filter((m) => m !== name)
  return `${place.label} is in ${name}, published with ${others.join(", ")} in ${fyLabel(fy)}.`
}

function SortHeader({
  col,
  label,
  sort,
  onSort,
  align = "right",
  className,
}: {
  col: LgaSortCol
  label: string
  sort: LgaSort
  onSort: (c: LgaSortCol) => void
  align?: "left" | "right"
  className?: string
}) {
  const active = sort.col === col
  const Icon = sort.dir === "desc" ? ArrowDown : ArrowUp
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.dir === "desc" ? "descending" : "ascending") : "none"}
      className={cn(
        "px-3 py-2 text-xs font-medium text-muted-foreground",
        align === "right" ? "text-right" : "text-left",
        className
      )}
    >
      <button
        type="button"
        onClick={() => onSort(col)}
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground",
          active && "text-foreground"
        )}
      >
        {label}
        {active ? <Icon className="size-3" aria-hidden /> : null}
      </button>
    </th>
  )
}

/** "2013/14–2021/22, 2024/25": consecutive financial years collapsed into ranges. */
function yearList(years: FY[], all: FY[]): string {
  const runs: FY[][] = []
  for (const fy of years) {
    const last = runs.at(-1)
    if (last && all.indexOf(fy) === all.indexOf(last.at(-1)!) + 1) last.push(fy)
    else runs.push([fy])
  }
  return runs
    .map((r) => (r.length > 1 ? `${fyShort(r[0])}–${fyShort(r.at(-1)!)}` : fyShort(r[0])))
    .join(", ")
}

const rowsLabel = (y: AreaYear) => y.units.map((u) => u.label).join("; ")

function AreaPanel({
  selection,
  units,
  fys,
  measure,
  currentFy,
  onClose,
}: {
  selection: AreaSelection
  units: LgaUnit[]
  fys: FY[]
  measure: LgaMeasure
  currentFy: FY
  onClose: () => void
}) {
  const history = areaHistory(units, selection.members, fys)
  const now =
    history.find((h) => h.fy === currentFy) ?? areaYear(units, selection.members, currentFy)
  const spec = LGA_MEASURES.find((m) => m.id === measure)!
  const one = now.status === "same" ? now.units[0] : null

  const noteFor = (y: AreaYear): string | undefined => {
    const absent = y.absent.length ? ` ${y.absent.join(", ")}: no venues reported.` : ""
    if (y.status === "none") return "No gaming venues reported in the selected area."
    if (y.status === "wider")
      return "Published only within a wider group that includes councils outside the selected area, so this is not the area’s own figure."
    if (y.status === "parts")
      return `Added up from ${y.units.length === 1 ? "one published row" : `${y.units.length} published rows`}: ${y.units
        .map((u) => `${u.label} ${formatMeasure(measure, measureValue(u, measure), true)}`)
        .join("; ")}.${absent}`
    return undefined
  }
  const data: Datum[] = history.map((y) => {
    const v = y.totals ? measureValue(y.totals, measure) : null
    const d: Datum = {
      key: y.fy,
      label: `${fyLabel(y.fy)} · ${
        y.status === "none"
          ? "no venues reported"
          : y.status === "wider"
            ? rowsLabel(y)
            : selection.label
      }`,
      value: y.status === "same" || y.status === "parts" ? v : null,
      wider: y.status === "wider" ? v : null,
    }
    const note = noteFor(y)
    if (note) d.note = note
    return d
  })
  const wider = history.filter((y) => y.status === "wider")
  const parts = history.filter((y) => y.status === "parts")
  const none = history.filter((y) => y.status === "none")
  const series: SeriesSpec[] = [
    { key: "value", label: spec.label, color: "var(--chart-1)", type: "bar", stackId: "area" },
  ]
  if (wider.length)
    series.push({
      key: "wider",
      label: `${spec.label}, wider group`,
      color: "var(--chart-4)",
      type: "bar",
      stackId: "area",
      outline: true,
    })
  // Wider-group years, grouped by the rows they were published in.
  const widerByRows = new Map<string, FY[]>()
  for (const y of wider)
    widerByRows.set(rowsLabel(y), [...(widerByRows.get(rowsLabel(y)) ?? []), y.fy])

  return (
    <section aria-labelledby="unit-history" className="rounded-lg border bg-card p-4 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="kicker text-terracotta">Selected area</p>
          <h2 id="unit-history" className="mt-1 text-2xl font-semibold">
            {selection.label}
          </h2>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="outline">
              {selection.members.length > 1
                ? `${selection.members.length} councils`
                : one?.kind === "split"
                  ? "Single council (split across workbook rows)"
                  : "Single council"}
            </Badge>
            {one && (one.workbookNames.length > 1 || one.workbookNames[0] !== one.label) ? (
              <Badge variant="secondary">Workbook rows: {one.workbookNames.join(", ")}</Badge>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid size-8 place-items-center rounded-md border hover:bg-accent"
          aria-label="Clear selection"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      <div className="mt-5" aria-live="polite">
        <p className="text-sm">
          <span className="tabular font-semibold">{fyLabel(currentFy)}</span>
          <span className="text-ink-soft">
            {now.status === "same"
              ? one?.kind === "group"
                ? " · published as one combined row"
                : " · published on its own"
              : now.status === "parts"
                ? ` · added up from ${now.units.length === 1 ? "one published row" : `${now.units.length} published rows`} (${rowsLabel(now)})${now.absent.length ? `; ${now.absent.join(", ")} had no venues reported` : ""}`
                : now.status === "wider"
                  ? ` · published only within ${rowsLabel(now)}. The figures below are for that whole group, not the selected area.`
                  : ""}
          </span>
        </p>
        {now.totals ? (
          <dl
            className={cn(
              "mt-3 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-5",
              now.status === "wider" && "text-ink-soft"
            )}
          >
            {LGA_MEASURES.map((m) => (
              <div
                key={m.id}
                className={cn("border-t pt-2", now.status === "wider" && "border-dashed")}
              >
                <dt className="text-xs text-muted-foreground">{m.label}</dt>
                <dd className="tabular mt-0.5 font-serif text-xl font-semibold">
                  {formatMeasure(m.id, measureValue(now.totals!, m.id))}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-3 rounded-md border border-dashed px-4 py-3 text-sm text-ink-soft">
            No gaming venues reported in {fyLabel(currentFy)}
            {selection.members.length > 1 ? " in any of these councils" : ""}. The chart below shows
            the years that had venues.
          </p>
        )}
      </div>

      {one && one.kind === "group" ? (
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-ink-soft">
          CBS publishes councils with few venues as one combined row. These figures belong to the
          whole group ({one.members.join(", ")}) and are not split between its members. The original
          workbook divided them equally across the names ({fmtAud(one.perRowNgr)} NGR per name in{" "}
          {fyLabel(one.fy)}); that division is not an observation.
        </p>
      ) : null}

      <div className="mt-6">
        <p className="mb-2 text-sm font-medium">{spec.label} by financial year</p>
        {wider.length ? (
          <div className="mb-2">
            <Legend
              items={[
                ...(data.some((d) => d.value != null)
                  ? [{ label: selection.label, color: "var(--chart-1)" }]
                  : []),
                {
                  label: "Only published within a wider group (not like-for-like)",
                  color: "var(--chart-4)",
                  outline: true,
                },
              ]}
            />
          </div>
        ) : null}
        <TrendChart
          data={data}
          series={series}
          yFormat={(v) => formatMeasure(measure, v, true)}
          valueFormat={(v) => formatMeasure(measure, v)}
          xTickFormat={fyAxis}
          height={220}
          ariaLabel={`${spec.label} for ${selection.label} by financial year. The notes below the chart list the years published differently.`}
        />
        {wider.length || parts.length || none.length ? (
          <ul className="mt-3 space-y-1 text-sm leading-relaxed text-ink-soft">
            {[...widerByRows].map(([rows, years]) => (
              <li key={rows}>
                <span className="tabular font-medium text-foreground">{yearList(years, fys)}:</span>{" "}
                only published within <span className="font-medium">{rows}</span>, which includes
                councils outside the selected area (dashed bars).
              </li>
            ))}
            {parts.map((y) => (
              <li key={y.fy}>
                <span className="tabular font-medium text-foreground">{fyShort(y.fy)}:</span> added
                up from separate rows ({rowsLabel(y)})
                {y.absent.length ? `; ${y.absent.join(", ")} had no venues reported` : ""}.
              </li>
            ))}
            {none.length ? (
              <li>
                <span className="tabular font-medium text-foreground">
                  {yearList(
                    none.map((y) => y.fy),
                    fys
                  )}
                  :
                </span>{" "}
                no gaming venues reported.
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>
    </section>
  )
}
