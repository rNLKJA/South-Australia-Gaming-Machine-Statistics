import type { FY, Month } from "./types"

const MONTH_ABBR = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

/** "2009-07" -> "2009-10": South Australian financial years run 1 July to 30 June. */
export function fyOfMonth(month: Month): FY {
  const [y, m] = month.split("-").map(Number)
  const start = m >= 7 ? y : y - 1
  return `${start}-${String(start + 1).slice(-2)}`
}

/** "2009-10" -> "FY 2009/10" (the workbook's label). */
export function fyLabel(fy: FY): string {
  return `FY ${fy.replace("-", "/")}`
}

/** "2009-10" -> "2009/10" (compact axis label). */
export function fyShort(fy: FY): string {
  return fy.replace("-", "/")
}

/** First calendar year of a financial year. */
export function fyStartYear(fy: FY): number {
  return Number(fy.slice(0, 4))
}

/** Every financial year from `first` to `last` inclusive. */
export function fyRange(first: FY, last: FY): FY[] {
  const out: FY[] = []
  for (let y = fyStartYear(first); y <= fyStartYear(last); y++) {
    out.push(`${y}-${String(y + 1).slice(-2)}`)
  }
  return out
}

/** The twelve months of a financial year, July first. */
export function monthsOfFy(fy: FY): Month[] {
  const y = fyStartYear(fy)
  return Array.from({ length: 12 }, (_, i) => {
    const m = ((i + 6) % 12) + 1
    const year = m >= 7 ? y : y + 1
    return `${year}-${String(m).padStart(2, "0")}`
  })
}

/** "2009-07" -> "Jul 2009". */
export function monthLabel(month: Month): string {
  const [y, m] = month.split("-").map(Number)
  return `${MONTH_ABBR[m - 1]} ${y}`
}

/** "2009-07" -> "2009-Q3" (calendar quarter, as used by the ABS CPI). */
export function calendarQuarter(month: Month): string {
  const [y, m] = month.split("-").map(Number)
  return `${y}-Q${Math.floor((m - 1) / 3) + 1}`
}
