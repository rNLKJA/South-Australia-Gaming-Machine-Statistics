import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import type { FeatureCollection } from "geojson"
import { describe, expect, it } from "vitest"

import { pointInGeometry } from "./geo"

const councils = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../../public/data/lga-councils.geojson", import.meta.url)),
    "utf8"
  )
) as FeatureCollection

describe("geo", () => {
  it("handles a square with a hole", () => {
    const g = {
      type: "Polygon" as const,
      coordinates: [
        [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10],
          [0, 0],
        ],
        [
          [4, 4],
          [6, 4],
          [6, 6],
          [4, 6],
          [4, 4],
        ],
      ],
    }
    expect(pointInGeometry([1, 1], g)).toBe(true)
    expect(pointInGeometry([5, 5], g)).toBe(false)
    expect(pointInGeometry([11, 5], g)).toBe(false)
  })

  it("puts Victoria Square in the City of Adelaide", () => {
    const hit = councils.features.filter((f) => pointInGeometry([138.6, -34.928], f.geometry))
    expect(hit.map((f) => f.properties?.name)).toEqual(["Adelaide"])
  })

  it("covers all 71 South Australian LGAs", () => {
    expect(councils.features).toHaveLength(71)
  })
})
