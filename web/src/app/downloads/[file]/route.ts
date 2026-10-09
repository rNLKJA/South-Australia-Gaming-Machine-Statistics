import { downloadByFile, downloads } from "@/lib/downloads"

export function generateStaticParams() {
  return downloads().map((d) => ({ file: d.file }))
}

/** Static CSV (and README) downloads, generated at build time from the same code as the pages. */
export async function GET(_request: Request, ctx: RouteContext<"/downloads/[file]">) {
  const { file } = await ctx.params
  const d = downloadByFile(file)
  if (!d) return new Response("Not found", { status: 404 })
  const isCsv = file.endsWith(".csv")
  return new Response(d.body(), {
    headers: {
      "Content-Type": isCsv ? "text/csv; charset=utf-8" : "text/plain; charset=utf-8",
      "Content-Disposition": `${isCsv ? "attachment" : "inline"}; filename="${file}"`,
      "Cache-Control": "public, max-age=3600",
    },
  })
}
