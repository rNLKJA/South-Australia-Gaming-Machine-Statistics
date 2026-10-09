import { z } from "zod"

/** A place returned by the geocoder, already limited to South Australia. */
export interface Place {
  label: string
  detail: string
  lon: number
  lat: number
}

export const querySchema = z
  .string()
  .trim()
  .min(2, "Type at least two characters")
  .max(80, "Keep the search under 80 characters")

const photonFeature = z.object({
  geometry: z.object({ coordinates: z.tuple([z.number(), z.number()]) }),
  properties: z.looseObject({
    name: z.string().optional(),
    city: z.string().optional(),
    district: z.string().optional(),
    state: z.string().optional(),
    postcode: z.string().optional(),
    countrycode: z.string().optional(),
  }),
})

/** Turn a Photon GeoJSON response into at most `limit` distinct South Australian places. */
export function parsePhoton(body: unknown, limit = 6): Place[] {
  const features = (body as { features?: unknown[] } | null)?.features ?? []
  const places: Place[] = []
  const seen = new Set<string>()
  for (const raw of features) {
    const parsed = photonFeature.safeParse(raw)
    if (!parsed.success) continue
    const p = parsed.data.properties
    if (p.countrycode && p.countrycode !== "AU") continue
    if (p.state && p.state !== "South Australia") continue
    const label = p.name ?? p.city ?? p.district
    if (!label) continue
    const detail = [p.city && p.city !== label ? p.city : null, p.postcode, "SA"]
      .filter(Boolean)
      .join(" ")
    const [lon, lat] = parsed.data.geometry.coordinates
    const key = `${label}|${detail}`
    if (seen.has(key)) continue
    seen.add(key)
    places.push({ label, detail, lon, lat })
  }
  return places.slice(0, limit)
}
