import type { Geometry, Position } from "geojson"

/** Ray-casting test for a point inside a linear ring. */
function inRing(pt: Position, ring: Position[]): boolean {
  let inside = false
  const [x, y] = pt
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function inPolygon(pt: Position, rings: Position[][]): boolean {
  if (!rings.length || !inRing(pt, rings[0])) return false
  for (let k = 1; k < rings.length; k++) if (inRing(pt, rings[k])) return false
  return true
}

/** Whether [lon, lat] falls inside a Polygon or MultiPolygon geometry. */
export function pointInGeometry(pt: Position, geom: Geometry | null): boolean {
  if (!geom) return false
  if (geom.type === "Polygon") return inPolygon(pt, geom.coordinates)
  if (geom.type === "MultiPolygon") return geom.coordinates.some((p) => inPolygon(pt, p))
  return false
}
