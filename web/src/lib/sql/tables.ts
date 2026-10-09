import "server-only"

import { downloads } from "../downloads"
import { inferType, type LoadTable } from "./load"
import { tableNameForFile, type SchemaTable } from "./schema"

/** Text columns with this many distinct values or fewer list them in the schema. */
const MAX_LISTED_VALUES = 8

/** The eight tidy CSV tables from /downloads as typed tables (built from the same code). */
export function tidyTables(): (LoadTable & { schema: SchemaTable })[] {
  return downloads()
    .filter((d) => d.file.endsWith(".csv") && d.values)
    .map((d) => {
      const rows = d.values!()
      const columns = d.columns.map((name, j) => {
        const vals = rows.map((r) => r[j])
        const type = inferType(vals)
        const distinct =
          type === "TEXT"
            ? [...new Set(vals.filter((v): v is string => typeof v === "string"))].sort()
            : []
        return {
          name,
          type,
          ...(distinct.length && distinct.length <= MAX_LISTED_VALUES ? { values: distinct } : {}),
        }
      })
      const name = tableNameForFile(d.file)
      return {
        name,
        columns,
        rows,
        schema: {
          name,
          file: d.file,
          title: d.title,
          description: d.description,
          rows: rows.length,
          columns,
        },
      }
    })
}

export function sqlSchema(): SchemaTable[] {
  return tidyTables().map((t) => t.schema)
}
