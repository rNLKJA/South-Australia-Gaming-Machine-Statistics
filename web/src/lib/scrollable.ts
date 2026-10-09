/** The box measurements that decide whether an element can scroll. */
export interface ScrollBox {
  scrollWidth: number
  clientWidth: number
  scrollHeight: number
  clientHeight: number
}

/**
 * Whether content overflows its box, so the box scrolls. Sub-pixel layout can leave scrollWidth a
 * pixel above clientWidth without anything to scroll, hence the one-pixel tolerance.
 */
export function overflows(box: ScrollBox, axis: "x" | "both" = "both"): boolean {
  const x = box.scrollWidth - box.clientWidth > 1
  const y = box.scrollHeight - box.clientHeight > 1
  return axis === "x" ? x : x || y
}
