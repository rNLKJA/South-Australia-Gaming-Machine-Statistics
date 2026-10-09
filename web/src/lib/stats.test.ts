import { describe, expect, it } from "vitest"

import { classIndex, mean, quantileBreaks, round } from "./stats"
import { toCsv } from "./csv"
import {
  fmtAudCompact,
  fmtAxisMillions,
  fmtChange,
  fmtDecimal,
  fmtInterval,
  fmtMillions,
  fmtP,
  fmtPct,
  signed,
} from "./format"

describe("stats helpers", () => {
  it("computes quantile breaks and classes", () => {
    const b = quantileBreaks([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5)
    expect(b).toHaveLength(4)
    expect(classIndex(1, b)).toBe(0)
    expect(classIndex(10, b)).toBe(4)
    expect(quantileBreaks([5, 5, 5], 4)).toEqual([5])
  })

  it("rounds without float noise and averages", () => {
    expect(round(0.1 + 0.2, 2)).toBe(0.3)
    expect(mean([])).toBeNull()
  })
})

describe("csv", () => {
  it("quotes commas, quotes and newlines", () => {
    const csv = toCsv(
      [
        { header: "name", value: (r: { n: string; v: number | null }) => r.n },
        { header: "value", value: (r) => r.v },
      ],
      [
        { n: 'Barunga West, Copper "Coast"', v: 1.5 },
        { n: "x", v: null },
      ]
    )
    expect(csv).toBe('name,value\r\n"Barunga West, Copper ""Coast""",1.5\r\nx,\r\n')
  })
})

describe("format", () => {
  it("formats money and changes", () => {
    expect(fmtMillions(1008.46)).toBe("$1,008.5m")
    expect(fmtAudCompact(28684768.59)).toBe("$28.7m")
    expect(fmtPct(0.4284)).toBe("42.8%")
    expect(fmtChange(0.055)).toBe("+5.5%")
    expect(fmtChange(-0.25)).toBe("−25.0%")
  })

  it("formats intervals, signs, p-values and axis labels", () => {
    const m = (v: number) => fmtMillions(v, 1)
    expect(fmtInterval(9.32, 5.84, 12.78, m)).toBe("$9.3m (95% CI $5.8m to $12.8m)")
    expect(fmtInterval(null, 1, 2, m)).toBe("–")
    expect(signed(9.32, m)).toBe("+$9.3m")
    expect(signed(-2.7, m)).toBe("−$2.7m")
    expect(signed(-0.02, m)).toBe("$0.0m")
    expect(fmtP(0.0004)).toBe("< 0.001")
    expect(fmtP(0.005)).toBe("0.005")
    expect(fmtP(0.2345)).toBe("0.23")
    expect(fmtDecimal(-0.5099)).toBe("−0.51")
    expect(fmtAxisMillions(-30)).toBe("−$30m")
    expect(fmtAxisMillions(90)).toBe("$90m")
  })
})
