/** Financial-year key, e.g. "2009-10" for 1 July 2009 to 30 June 2010. */
export type FY = string

/** Calendar month key, e.g. "2009-07". */
export type Month = string

export interface StatewideMonth {
  month: Month
  fy: FY
  quarter: string
  /** Net gambling revenue, $ million. */
  ngr: number
  /** Gaming tax liability, $ million. */
  tax: number
  /** Venue share (NGR less tax), $ million. */
  venueShare: number
  /** Gaming machines in hotels and clubs (excludes the Adelaide Casino). */
  machines: number
  /** Venues that operated at any time during the month. */
  venues: number
}

export const LICENCE_CATEGORIES = ["Hotels", "Clubs", "Special Circumstances", "Casino"] as const
export type LicenceCategory = (typeof LICENCE_CATEGORIES)[number]

export interface LicenceMonth {
  month: Month
  fy: FY
  category: LicenceCategory
  licences: number
  entitlements: number
  liveLicences: number
  liveMachines: number
}

export interface ManufacturerMonth {
  month: Month
  fy: FY
  quarter: string
  manufacturer: string
  machines: number
  /** Share as printed by CBS (fraction, 4 dp). */
  pct: number
  /** Month total printed by CBS. */
  monthTotal: number
}

export interface LgaRow {
  fy: FY
  name: string
  ngr: number
  avgPerVenue: number
  machines: number
  premises: number
}

export type LgaUnitKind = "single" | "split" | "group"

/** One row of a CBS LGA release, rebuilt from the workbook's per-name rows. */
export interface LgaUnit {
  fy: FY
  id: string
  label: string
  members: string[]
  kind: LgaUnitKind
  workbookNames: string[]
  workbookRows: number
  /** ABS LGA 2024 codes whose boundaries make up this unit on the map. */
  codes: string[]
  geoKey: string
  ngr: number
  avgPerVenue: number
  /** Null when CBS did not publish machine counts that year (FY 2019/20). */
  machines: number | null
  premises: number
  /** The value the workbook stored on each member row (the equal split). */
  perRowNgr: number
  relations: string[]
}

export type CrosswalkRelation = "same" | "spelling" | "suffix" | "renamed" | "fragment" | "part"

export interface CrosswalkEntry {
  workbookName: string
  displayName: string
  absName: string
  absCode: string
  relation: CrosswalkRelation
  geometry: boolean
  note: string
  years: FY[]
}

export interface CpiPoint {
  /** Calendar quarter, e.g. "2009-Q3". */
  quarter: string
  index: number
}

export interface PowerBiVisual {
  page: string
  visualType: string
  projections: Record<string, string[]>
}

export interface VerificationFamily {
  family: string
  checked: number
  found: number
  misses: { period: string; field: string; value: number; printed?: number | null }[]
  note?: string
  imageOnly?: string[]
  totals?: { fy: FY; printedTotal: number; workbookTotal: number }[]
}

export interface Verification {
  statewide: VerificationFamily
  lga: VerificationFamily
  licences: VerificationFamily
  manufacturers: VerificationFamily
}
