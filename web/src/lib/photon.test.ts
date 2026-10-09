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

  it("labels addresses by number and street, and names by their address", () => {
    const places = parsePhoton({
      features: [
        feature({
          housenumber: "1",
          street: "King William Street",
          district: "Kent Town",
          city: "Adelaide",
          postcode: "5067",
          state: "South Australia",
        }),
        feature({
          housenumber: "25",
          name: "Grenfell Centre",
          street: "Grenfell Street",
          district: "Adelaide",
          city: "Adelaide",
          postcode: "5000",
          state: "South Australia",
        }),
        feature({
          name: "Jetty Road",
          district: "Glenelg",
          city: "Adelaide",
          postcode: "5045",
          state: "South Australia",
        }),
      ],
    })
    expect(places.map(({ label, detail }) => ({ label, detail }))).toEqual([
      { label: "1 King William Street", detail: "Kent Town 5067 SA" },
      { label: "Grenfell Centre", detail: "25 Grenfell Street, Adelaide 5000 SA" },
      { label: "Jetty Road", detail: "Glenelg 5045 SA" },
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
