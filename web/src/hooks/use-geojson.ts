"use client"

import type { FeatureCollection } from "geojson"
import { useEffect, useState } from "react"

const cache = new Map<string, Promise<FeatureCollection>>()

function load(url: string): Promise<FeatureCollection> {
  let p = cache.get(url)
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`${url}: ${r.status}`)
      return r.json() as Promise<FeatureCollection>
    })
    p.catch(() => cache.delete(url))
    cache.set(url, p)
  }
  return p
}

type State = { data: FeatureCollection | null; error: string | null }

/** Fetch a bundled GeoJSON file from /public once per page load and share it between components. */
export function useGeoJson(url: string): State {
  const [state, setState] = useState<State>({ data: null, error: null })
  useEffect(() => {
    let live = true
    load(url).then(
      (data) => live && setState({ data, error: null }),
      (e: unknown) =>
        live && setState({ data: null, error: e instanceof Error ? e.message : String(e) })
    )
    return () => {
      live = false
    }
  }, [url])
  return state
}
