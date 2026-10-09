"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { QueryResult } from "@/lib/sql/browser"

function cell(v: string | number | null): string {
  if (v === null) return "NULL"
  if (typeof v === "number") {
    if (Number.isInteger(v)) return v.toLocaleString("en-AU")
    return v.toLocaleString("en-AU", { maximumFractionDigits: 6 })
  }
  return v
}

/** A query result as a scrollable table (numbers right-aligned, NULL shown as such). */
export function ResultsTable({ result }: { result: QueryResult }) {
  const numeric = result.columns.map((_, j) =>
    result.rows.every((r) => r[j] === null || typeof r[j] === "number")
  )
  if (!result.columns.length) {
    return <p className="text-sm text-muted-foreground">The query returned no columns.</p>
  }
  return (
    <div className="max-h-[28rem] overflow-auto rounded-lg border bg-card">
      <Table>
        <TableHeader className="sticky top-0 bg-card">
          <TableRow className="hover:bg-transparent">
            {result.columns.map((c, j) => (
              <TableHead key={`${c}-${j}`} scope="col" className={numeric[j] ? "text-right" : ""}>
                {c}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {result.rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={result.columns.length} className="text-muted-foreground italic">
                No rows matched.
              </TableCell>
            </TableRow>
          ) : (
            result.rows.map((r, i) => (
              <TableRow key={i}>
                {r.map((v, j) => (
                  <TableCell
                    key={j}
                    className={
                      numeric[j]
                        ? "tabular text-right"
                        : v === null
                          ? "text-muted-foreground italic"
                          : "max-w-80 whitespace-normal"
                    }
                  >
                    {cell(v)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
