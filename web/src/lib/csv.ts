export interface CsvColumn<T> {
  header: string
  value: (row: T) => string | number | boolean | null | undefined
}

function cell(v: string | number | boolean | null | undefined): string {
  if (v == null) return ""
  const s = typeof v === "number" ? (Number.isFinite(v) ? String(v) : "") : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** RFC 4180 CSV with a header row and CRLF line endings. */
export function toCsv<T>(columns: CsvColumn<T>[], rows: T[]): string {
  const lines = [columns.map((c) => cell(c.header)).join(",")]
  for (const r of rows) lines.push(columns.map((c) => cell(c.value(r))).join(","))
  return lines.join("\r\n") + "\r\n"
}
