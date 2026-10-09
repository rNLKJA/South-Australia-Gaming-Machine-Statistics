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

/** "$9.3m (95% CI $5.9m to $12.8m)": an estimate with its interval in one formatter. */
export function fmtInterval(
  est: number | null | undefined,
  lower: number | null | undefined,
  upper: number | null | undefined,
  fmt: (v: number) => string
): string {
  if (est == null || lower == null || upper == null) return "–"
  return `${fmt(est)} (95% CI ${fmt(lower)} to ${fmt(upper)})`
}

/** Prefix a formatted value with + or − (the typographic minus). */
export function signed(v: number, fmt: (v: number) => string): string {
  if (!Number.isFinite(v)) return "–"
  const s = fmt(Math.abs(v))
  if (s === fmt(0)) return s
  return v > 0 ? `+${s}` : v < 0 ? `−${s}` : s
}

/** p-values: "< 0.001" below a thousandth, otherwise two or three significant digits. */
export function fmtP(p: number | null | undefined): string {
  if (p == null || !Number.isFinite(p)) return "–"
  if (p < 0.001) return "< 0.001"
  return p < 0.01 ? p.toFixed(3) : p.toFixed(2)
}

/** A plain decimal with a typographic minus: -0.51 -> "−0.51". */
export function fmtDecimal(v: number | null | undefined, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return "–"
  return v.toFixed(digits).replace(/^-/, "−")
}

/** Axis labels for $ million values with a typographic minus: -30 -> "−$30m". */
export function fmtAxisMillions(v: number): string {
  const r = Math.round(v)
  return r < 0 ? `−$${Math.abs(r)}m` : `$${r}m`
}
