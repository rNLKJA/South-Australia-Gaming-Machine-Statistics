import { describe, expect, it } from "vitest"

import { parsePhoton, querySchema } from "./photon"

const feature = (props: Record<string, string>, lon = 138.61, lat = -34.81) => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [lon, lat] },
  properties: props,
})

describe("parsePhoton", () => {
  it("keeps South Australian places and drops the rest", () => {
    const places = parsePhoton({
      features: [
        feature({
          name: "Mawson Lakes",
          city: "Adelaide",
          postcode: "5095",
          state: "South Australia",
          countrycode: "AU",
        }),
        feature({ name: "Mawson", state: "Australian Capital Territory", countrycode: "AU" }),
        feature({ name: "Mawson Station", countrycode: "AQ" }),
        { broken: true },
      ],
    })
    expect(places).toEqual([
      { label: "Mawson Lakes", detail: "Adelaide 5095 SA", lon: 138.61, lat: -34.81 },
    ])
  })

  it("de-duplicates and limits", () => {
    const f = feature({ name: "Glenelg", postcode: "5045", state: "South Australia" })
    expect(parsePhoton({ features: [f, f, f] })).toHaveLength(1)
    const many = Array.from({ length: 10 }, (_, i) =>
      feature({ name: `Place ${i}`, state: "South Australia" })
    )
    expect(parsePhoton({ features: many })).toHaveLength(6)
    expect(parsePhoton(null)).toEqual([])
  })
})

describe("querySchema", () => {
  it("trims and bounds the query", () => {
    expect(querySchema.parse("  Glenelg ")).toBe("Glenelg")
    expect(querySchema.safeParse("a").success).toBe(false)
    expect(querySchema.safeParse("x".repeat(81)).success).toBe(false)
  })
})
