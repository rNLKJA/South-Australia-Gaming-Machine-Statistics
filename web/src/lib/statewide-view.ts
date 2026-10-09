import "server-only"

import { fyAverageCpi } from "./cpi"
import { cpi, lgaUnits, statewide } from "./data"
import { fyOfMonth, fyRange, monthsOfFy } from "./fy"
import { round, sum } from "./stats"
import {
  annualStatewide,
  monthlyValue,
  STATEWIDE_FIRST_FY,
  STATEWIDE_LAST_FY,
  STATEWIDE_MISSING_FY,
} from "./statewide"
import type { FY, Month, StatewideMonth } from "./types"

export const BASE_FY: FY = STATEWIDE_LAST_FY

/** Every month of the series, with nulls where no release is archived. */
function allMonths(): Month[] {
  return fyRange(STATEWIDE_FIRST_FY, STATEWIDE_LAST_FY).flatMap(monthsOfFy)
}

export function statewideView() {
  const real = { cpi, baseFy: BASE_FY }
  const byMonth = new Map(statewide.map((r) => [r.month, r]))
  const rowFor = (month: Month, useReal: boolean) => {
    const r = byMonth.get(month) as StatewideMonth | undefined
    if (!r) {
      return {
        month,
        fy: fyOfMonth(month),
        ngr: null,
        tax: null,
        venueShare: null,
        machines: null,
        venues: null,
        ngrPerMachine: null,
      }
    }
    const opt = useReal ? real : undefined
    return {
      month,
      fy: r.fy,
      ngr: monthlyValue(r, "ngr", opt),
      tax: monthlyValue(r, "tax", opt),
      venueShare: monthlyValue(r, "venueShare", opt),
      machines: r.machines,
      venues: r.venues,
      ngrPerMachine: monthlyValue(r, "ngrPerMachine", opt),
    }
  }
  const months = allMonths()
  const lgaTotal = round(
    sum(lgaUnits.filter((u) => u.fy === STATEWIDE_MISSING_FY).map((u) => u.ngr)),
    2
  )
  const base = fyAverageCpi(cpi, BASE_FY)!
  const gapCpi = fyAverageCpi(cpi, STATEWIDE_MISSING_FY)!
  return {
    monthly: months.map((m) => rowFor(m, false)),
    monthlyReal: months.map((m) => rowFor(m, true)),
    annual: annualStatewide(statewide),
    annualReal: annualStatewide(statewide, real),
    lgaFill: {
      fy: STATEWIDE_MISSING_FY,
      nominal: lgaTotal / 1e6,
      real: ((lgaTotal / 1e6) * base) / gapCpi,
    },
  }
}
