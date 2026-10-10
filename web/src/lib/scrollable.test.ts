import { describe, expect, it } from "vitest"

import { overflows } from "./scrollable"

const box = (sw: number, cw: number, sh = 100, ch = 100) => ({
  scrollWidth: sw,
  clientWidth: cw,
  scrollHeight: sh,
  clientHeight: ch,
})

describe("overflows", () => {
  it("is false when the content fits", () => {
    expect(overflows(box(390, 390))).toBe(false)
  })

  it("ignores a one-pixel rounding difference", () => {
    expect(overflows(box(391, 390))).toBe(false)
  })

  it("detects horizontal overflow", () => {
    expect(overflows(box(720, 358))).toBe(true)
    expect(overflows(box(720, 358), "x")).toBe(true)
  })

  it("detects vertical overflow unless only the x axis is asked for", () => {
    expect(overflows(box(300, 300, 2000, 448))).toBe(true)
    expect(overflows(box(300, 300, 2000, 448), "x")).toBe(false)
  })
})
