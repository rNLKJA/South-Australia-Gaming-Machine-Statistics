import type { NextRequest } from "next/server"

import { querySchema } from "@/lib/photon"
import { searchPlaces } from "@/server/photon"

/** GET /api/geocode?q=Mawson Lakes → up to six South Australian places from Photon. */
export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(request.nextUrl.searchParams.get("q") ?? "")
  if (!parsed.success) {
    return Response.json(
      { places: [], error: parsed.error.issues[0]?.message ?? "Invalid search" },
      { status: 400 }
    )
  }
  try {
    const places = await searchPlaces(parsed.data.toLowerCase())
    return Response.json(
      { places },
      { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } }
    )
  } catch {
    return Response.json(
      {
        places: [],
        error:
          "Place search is unavailable right now. Pick an area on the map or in the table instead.",
      },
      { status: 502 }
    )
  }
}
