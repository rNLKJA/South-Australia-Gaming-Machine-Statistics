import "server-only"

import { cacheLife } from "next/cache"

import { parsePhoton, type Place } from "@/lib/photon"

/** South Australia's bounding box (west, south, east, north). */
const SA_BBOX = "129,-38.2,141.1,-25.9"
const PHOTON = "https://photon.komoot.io/api/"
const USER_AGENT =
  "sa-gaming-machine-stats/1.0 (+https://github.com/rNLKJA/South-Australia-Gaming-Machine-Statistics)"

/**
 * Suburb and address lookup through Photon (komoot's free OpenStreetMap geocoder, no key).
 * Results are cached for a day so repeated searches don't reach Photon again.
 */
export async function searchPlaces(q: string): Promise<Place[]> {
  "use cache"
  cacheLife("days")
  const url = `${PHOTON}?${new URLSearchParams({ q, limit: "8", lang: "en", bbox: SA_BBOX })}`
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(6000),
  })
  if (!res.ok) throw new Error(`Photon responded ${res.status}`)
  return parsePhoton(await res.json())
}
