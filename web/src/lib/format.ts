const AUD0 = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
})
const INT = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 0 })
const DEC1 = new Intl.NumberFormat("en-AU", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const DEC2 = new Intl.NumberFormat("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** 731.01 ($m) -> "$731.0m". */
export function fmtMillions(m: number | null | undefined, digits = 1): string {
  if (m == null || Number.isNaN(m)) return "–"
  const f = digits === 2 ? DEC2 : DEC1
  return `$${f.format(m)}m`
}

/** 28684768.59 (AUD) -> "$28.7m"; 541222 -> "$541k". */
export function fmtAudCompact(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "–"
  const a = Math.abs(v)
  if (a >= 1e9) return `$${DEC2.format(v / 1e9)}b`
  if (a >= 1e6) return `$${DEC1.format(v / 1e6)}m`
  if (a >= 1e4) return `$${INT.format(v / 1e3)}k`
  return AUD0.format(v)
}

/** Whole dollars: 28684768.59 -> "$28,684,769". */
export function fmtAud(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "–"
  return AUD0.format(v)
}

/** Dollars and cents: "$28,684,768.59". */
export function fmtAudCents(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "–"
  return `$${DEC2.format(v)}`
}

export function fmtInt(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "–"
  return INT.format(v)
}

export function fmtDec1(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "–"
  return DEC1.format(v)
}

/** 0.4284 -> "42.8%". */
export function fmtPct(fraction: number | null | undefined, digits = 1): string {
  if (fraction == null || Number.isNaN(fraction)) return "–"
  return `${(fraction * 100).toFixed(digits)}%`
}

/** Signed relative change: 0.055 -> "+5.5%". */
export function fmtChange(fraction: number | null | undefined, digits = 1): string {
  if (fraction == null || !Number.isFinite(fraction)) return "–"
  const s = (fraction * 100).toFixed(digits)
  return fraction > 0 ? `+${s}%` : `${s.replace("-", "−")}%`
}
