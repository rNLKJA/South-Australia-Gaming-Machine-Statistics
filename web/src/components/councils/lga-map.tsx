"use client"

import "maplibre-gl/dist/maplibre-gl.css"

import type { FeatureCollection } from "geojson"
import type { ExpressionSpecification, Map as MlMap, Marker, StyleSpecification } from "maplibre-gl"
import { useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"

import {
  fallbackStyle,
  GROUP_OUTLINE,
  NO_DATA,
  OPENFREEMAP_STYLE,
  OUTLINE,
  SELECT_OUTLINE,
} from "./palette"

export type MapMode = "light" | "dark"

export interface HoverInfo {
  title: string
  value: string
  note?: string
}

export interface LgaMapProps {
  councils: FeatureCollection
  groups: FeatureCollection
  /** ABS code → fill colour, for single-council units this year. */
  singleColors: Record<string, string>
  /** Group geoKey → fill colour, for combined groups this year. */
  groupColors: Record<string, string>
  selectedKey: string | null
  hoveredKey: string | null
  focusPoint: [number, number] | null
  mode: MapMode
  onHover: (key: string | null) => void
  onSelect: (key: string | null) => void
  describe: (key: string) => HoverInfo | null
  className?: string
}

const SA_BOUNDS: [[number, number], [number, number]] = [
  [129, -38.1],
  [141.1, -25.9],
]
const ADELAIDE_BOUNDS: [[number, number], [number, number]] = [
  [138.42, -35.38],
  [138.95, -34.6],
]

const LAYERS = [
  "lga-base",
  "lga-single",
  "lga-group",
  "lga-line",
  "lga-group-line",
  "lga-hover",
  "lga-group-hover",
  "lga-selected",
  "lga-group-selected",
]

function matchExpr(
  prop: string,
  colors: Record<string, string>,
  fallback: string
): ExpressionSpecification | string {
  const entries = Object.entries(colors)
  if (!entries.length) return fallback
  return ["match", ["get", prop], ...entries.flat(), fallback] as unknown as ExpressionSpecification
}

function addLayers(map: MlMap, councils: FeatureCollection, groups: FeatureCollection, m: MapMode) {
  if (!map.getSource("councils")) map.addSource("councils", { type: "geojson", data: councils })
  if (!map.getSource("groups")) map.addSource("groups", { type: "geojson", data: groups })
  for (const id of LAYERS) if (map.getLayer(id)) map.removeLayer(id)
  const firstSymbol = map.getStyle().layers.find((l) => l.type === "symbol")?.id
  const add = (layer: Parameters<MlMap["addLayer"]>[0]) => map.addLayer(layer, firstSymbol)
  add({
    id: "lga-base",
    type: "fill",
    source: "councils",
    paint: { "fill-color": NO_DATA[m], "fill-opacity": 0.7 },
  })
  add({
    id: "lga-single",
    type: "fill",
    source: "councils",
    paint: { "fill-color": NO_DATA[m], "fill-opacity": 0.88 },
  })
  add({
    id: "lga-group",
    type: "fill",
    source: "groups",
    paint: { "fill-color": NO_DATA[m], "fill-opacity": 0.88 },
  })
  add({
    id: "lga-line",
    type: "line",
    source: "councils",
    paint: { "line-color": OUTLINE[m], "line-width": 0.6, "line-opacity": 0.7 },
  })
  add({
    id: "lga-group-line",
    type: "line",
    source: "groups",
    paint: { "line-color": GROUP_OUTLINE[m], "line-width": 1.3, "line-dasharray": [3, 1.5] },
  })
  add({
    id: "lga-hover",
    type: "line",
    source: "councils",
    paint: { "line-color": GROUP_OUTLINE[m], "line-width": 2 },
    filter: ["==", ["get", "code"], ""],
  })
  add({
    id: "lga-group-hover",
    type: "line",
    source: "groups",
    paint: { "line-color": GROUP_OUTLINE[m], "line-width": 2 },
    filter: ["==", ["get", "geoKey"], ""],
  })
  add({
    id: "lga-selected",
    type: "line",
    source: "councils",
    paint: { "line-color": SELECT_OUTLINE[m], "line-width": 3.5 },
    filter: ["==", ["get", "code"], ""],
  })
  add({
    id: "lga-group-selected",
    type: "line",
    source: "groups",
    paint: { "line-color": SELECT_OUTLINE[m], "line-width": 3.5 },
    filter: ["==", ["get", "geoKey"], ""],
  })
}

function applyData(map: MlMap, p: LgaMapProps, m: MapMode) {
  if (!map.getLayer("lga-single")) return
  const singles = Object.keys(p.singleColors)
  const groupKeys = Object.keys(p.groupColors)
  map.setFilter("lga-single", ["in", ["get", "code"], ["literal", singles]])
  map.setPaintProperty("lga-single", "fill-color", matchExpr("code", p.singleColors, NO_DATA[m]))
  map.setFilter("lga-group", ["in", ["get", "geoKey"], ["literal", groupKeys]])
  map.setPaintProperty("lga-group", "fill-color", matchExpr("geoKey", p.groupColors, NO_DATA[m]))
  map.setFilter("lga-group-line", ["in", ["get", "geoKey"], ["literal", groupKeys]])
  map.setFilter("lga-hover", ["==", ["get", "code"], p.hoveredKey ?? ""])
  map.setFilter("lga-group-hover", ["==", ["get", "geoKey"], p.hoveredKey ?? ""])
  map.setFilter("lga-selected", ["==", ["get", "code"], p.selectedKey ?? ""])
  map.setFilter("lga-group-selected", ["==", ["get", "geoKey"], p.selectedKey ?? ""])
}

export function LgaMap(props: LgaMapProps) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MlMap | null>(null)
  const markerRef = useRef<Marker | null>(null)
  const propsRef = useRef(props)
  const [status, setStatus] = useState<"loading" | "ready" | "fallback" | "error">("loading")
  const [hover, setHover] = useState<{ x: number; y: number; w: number; info: HoverInfo } | null>(
    null
  )
  const modeRef = useRef<MapMode>(props.mode)
  const fallbackRef = useRef(false)

  useEffect(() => {
    propsRef.current = props
  })

  // Create the map once (and again if React re-shows the page after hiding it).
  useEffect(() => {
    let cancelled = false
    let map: MlMap | null = null
    fallbackRef.current = false
    let timer: ReturnType<typeof setTimeout> | undefined

    ;(async () => {
      const ml = await import("maplibre-gl")
      if (cancelled || !container.current) return
      // The worker is served from /public so it loads the same way under every bundler.
      ml.setWorkerUrl("/vendor/maplibre-gl-worker.mjs")
      const m = new ml.Map({
        container: container.current,
        style: OPENFREEMAP_STYLE[modeRef.current],
        bounds: SA_BOUNDS,
        fitBoundsOptions: { padding: 16 },
        attributionControl: { compact: true, customAttribution: "Boundaries © ABS (CC BY 4.0)" },
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        maxZoom: 13,
        minZoom: 4,
      })
      map = m
      mapRef.current = m
      m.addControl(new ml.NavigationControl({ showCompass: false }), "top-right")
      m.touchZoomRotate.disableRotation()

      let styleLoaded = false
      const switchToFallback = () => {
        if (fallbackRef.current) return
        fallbackRef.current = true
        setStatus("fallback")
        m.setStyle(fallbackStyle(modeRef.current) as StyleSpecification)
      }
      timer = setTimeout(() => {
        if (!styleLoaded) switchToFallback()
      }, 9000)

      m.on("style.load", () => {
        styleLoaded = true
        addLayers(m, propsRef.current.councils, propsRef.current.groups, modeRef.current)
        applyData(m, propsRef.current, modeRef.current)
        setStatus((s) => (s === "fallback" ? "fallback" : "ready"))
      })
      m.on("error", (e) => {
        // A style that never loads (offline, blocked) switches to the bundled boundaries.
        if (!styleLoaded) switchToFallback()
        else if (process.env.NODE_ENV !== "production") console.warn("map:", e.error?.message)
      })

      const enter = (
        e: {
          features?: { properties: Record<string, unknown> }[]
          point: { x: number; y: number }
        },
        prop: "code" | "geoKey"
      ) => {
        const f = e.features?.[0]
        if (!f) return
        const key = String(f.properties[prop])
        m.getCanvas().style.cursor = "pointer"
        propsRef.current.onHover(key)
        const info = propsRef.current.describe(key)
        const w = container.current?.clientWidth ?? 400
        setHover(info ? { x: e.point.x, y: e.point.y, w, info } : null)
      }
      const leave = () => {
        m.getCanvas().style.cursor = ""
        propsRef.current.onHover(null)
        setHover(null)
      }
      m.on("mousemove", "lga-single", (e) => enter(e as never, "code"))
      m.on("mousemove", "lga-group", (e) => enter(e as never, "geoKey"))
      m.on("mouseleave", "lga-single", leave)
      m.on("mouseleave", "lga-group", leave)
      m.on("click", (e) => {
        const hits = m.queryRenderedFeatures(e.point, { layers: ["lga-group", "lga-single"] })
        const f = hits[0]
        if (!f) return propsRef.current.onSelect(null)
        const key =
          f.layer.id === "lga-group" ? String(f.properties.geoKey) : String(f.properties.code)
        propsRef.current.onSelect(key)
      })
    })().catch(() => setStatus("error"))

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      markerRef.current?.remove()
      markerRef.current = null
      map?.remove()
      mapRef.current = null
    }
  }, [])

  // Re-apply colours, filters and highlights whenever the inputs change.
  useEffect(() => {
    const map = mapRef.current
    if (map && map.getLayer("lga-single")) applyData(map, props, modeRef.current)
  }, [props])

  // Follow the site theme.
  useEffect(() => {
    if (modeRef.current === props.mode) return
    modeRef.current = props.mode
    const map = mapRef.current
    if (!map) return
    map.setStyle(
      fallbackRef.current
        ? (fallbackStyle(props.mode) as StyleSpecification)
        : OPENFREEMAP_STYLE[props.mode]
    )
  }, [props.mode])

  // Fly to a searched place and drop a marker.
  useEffect(() => {
    const map = mapRef.current
    const pt = props.focusPoint
    if (!map) return
    markerRef.current?.remove()
    markerRef.current = null
    if (!pt) return
    let live = true
    import("maplibre-gl").then((ml) => {
      if (!live || !mapRef.current) return
      const el = document.createElement("div")
      el.className = "size-3.5 rounded-full border-2 border-white bg-[var(--teal)] shadow-md"
      el.setAttribute("aria-hidden", "true")
      markerRef.current = new ml.Marker({ element: el }).setLngLat(pt).addTo(mapRef.current)
      mapRef.current.flyTo({ center: pt, zoom: Math.max(mapRef.current.getZoom(), 8), speed: 1.4 })
    })
    return () => {
      live = false
    }
  }, [props.focusPoint])

  const fit = (b: typeof SA_BOUNDS) => mapRef.current?.fitBounds(b, { padding: 16, duration: 600 })

  return (
    <div className={cn("relative overflow-hidden rounded-lg border bg-muted", props.className)}>
      <div
        ref={container}
        // MapLibre sets position: relative on its container, so size it explicitly.
        className="h-full w-full"
        role="region"
        aria-label="Map of South Australian council areas coloured by the selected measure. Use the ranked table for keyboard access."
      />
      <div className="absolute top-2 left-2 z-10 flex gap-1">
        <button
          type="button"
          onClick={() => fit(SA_BOUNDS)}
          className="rounded-md border bg-card/95 px-2 py-1 text-xs font-medium shadow-sm hover:bg-accent"
        >
          South Australia
        </button>
        <button
          type="button"
          onClick={() => fit(ADELAIDE_BOUNDS)}
          className="rounded-md border bg-card/95 px-2 py-1 text-xs font-medium shadow-sm hover:bg-accent"
        >
          Adelaide
        </button>
      </div>
      {status === "loading" ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-muted-foreground">
          Loading map…
        </div>
      ) : null}
      {status === "fallback" ? (
        <p className="absolute right-2 bottom-8 left-2 z-10 rounded-md border bg-card/95 px-3 py-2 text-xs text-ink-soft shadow-sm sm:right-auto">
          Basemap tiles couldn’t load, so the map shows the bundled council boundaries only.
        </p>
      ) : null}
      {status === "error" ? (
        <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-muted-foreground">
          The map couldn’t start in this browser. The ranked table has every figure.
        </div>
      ) : null}
      {hover ? (
        <div
          className="pointer-events-none absolute z-20 max-w-64 rounded-md border bg-popover px-3 py-2 text-sm shadow-md"
          style={{
            left: Math.max(8, Math.min(hover.x + 14, hover.w - 264)),
            top: Math.max(hover.y - 12, 8),
          }}
        >
          <p className="leading-snug font-semibold">{hover.info.title}</p>
          <p className="tabular">{hover.info.value}</p>
          {hover.info.note ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{hover.info.note}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
