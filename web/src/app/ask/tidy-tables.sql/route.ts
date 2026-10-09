import { buildLoadScript } from "@/lib/sql/load"
import { tidyTables } from "@/lib/sql/tables"

/**
 * The SQL script that builds the browser database on /ask: the eight tidy tables from Downloads,
 * generated at build time from the same code, ending with PRAGMA query_only = ON.
 */
export async function GET() {
  return new Response(buildLoadScript(tidyTables()), {
    headers: {
      "Content-Type": "application/sql; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  })
}
