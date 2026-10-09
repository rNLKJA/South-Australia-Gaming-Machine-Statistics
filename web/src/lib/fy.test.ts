import { describe, expect, it } from "vitest"

import { calendarQuarter, fyLabel, fyOfMonth, fyRange, monthLabel, monthsOfFy } from "./fy"

describe("financial years", () => {
  it("maps July to the new year and June to the old one", () => {
    expect(fyOfMonth("2009-07")).toBe("2009-10")
    expect(fyOfMonth("2010-06")).toBe("2009-10")
    expect(fyOfMonth("1999-12")).toBe("1999-00")
  })

  it("formats labels the way the workbook does", () => {
    expect(fyLabel("2024-25")).toBe("FY 2024/25")
    expect(monthLabel("2020-04")).toBe("Apr 2020")
  })

  it("enumerates years and months", () => {
    expect(fyRange("2013-14", "2015-16")).toEqual(["2013-14", "2014-15", "2015-16"])
    const m = monthsOfFy("2019-20")
    expect(m[0]).toBe("2019-07")
    expect(m[11]).toBe("2020-06")
  })

  it("finds the calendar quarter for CPI", () => {
    expect(calendarQuarter("2009-07")).toBe("2009-Q3")
    expect(calendarQuarter("2010-03")).toBe("2010-Q1")
  })
})
