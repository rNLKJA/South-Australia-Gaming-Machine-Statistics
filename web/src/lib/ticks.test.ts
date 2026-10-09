import { describe, expect, it } from "vitest"

import { fyRange } from "./fy"
import { thinTicks, ticksThatFit } from "./ticks"

const FYS = fyRange("2009-10", "2024-25")

describe("thinTicks", () => {
  it("keeps every key when they fit", () => {
    expect(thinTicks(FYS, 16)).toEqual(FYS)
  })

  it("keeps a fixed stride counted back from the latest year", () => {
    const t = thinTicks(FYS, 4)
    expect(t).toEqual(["2012-13", "2016-17", "2020-21", "2024-25"])
    expect(t.length).toBeLessThanOrEqual(4)
  })

  it("never drops the last key and never exceeds the limit", () => {
    for (let max = 1; max <= 20; max++) {
      const t = thinTicks(FYS, max)
      expect(t.at(-1)).toBe("2024-25")
      expect(t.length).toBeLessThanOrEqual(Math.max(1, max))
      const gaps = t.slice(1).map((k, i) => FYS.indexOf(k) - FYS.indexOf(t[i]))
      expect(new Set(gaps).size).toBeLessThanOrEqual(1)
    }
  })
})

describe("ticksThatFit", () => {
  it("fits four short FY labels on a phone and every year on a desktop", () => {
    expect(ticksThatFit(254, 6)).toBe(4)
    expect(ticksThatFit(1000, 6)).toBeGreaterThanOrEqual(16)
  })
})
