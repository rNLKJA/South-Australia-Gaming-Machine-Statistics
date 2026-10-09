import { Download as DownloadIcon, FileText } from "lucide-react"
import type { Metadata } from "next"

import { Callout } from "@/components/common/callout"
import { PageHeader } from "@/components/common/page-header"
import { meta } from "@/lib/data"
import { ATTRIBUTION, downloads } from "@/lib/downloads"
import { fmtInt } from "@/lib/format"
import { site } from "@/lib/site"

export const metadata: Metadata = {
  title: "Downloads",
  description:
    "Tidy CSV files derived from the SA gaming machine statistics workbook: statewide, licences, manufacturers and council areas, with attribution.",
}

export default function DownloadsPage() {
  const files = downloads()
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <PageHeader kicker="Downloads" title="The tables behind every chart">
        <p>
          Each file is generated at build time by the same code that draws the charts, so the
          numbers match the site exactly. They are derived, tidy tables (one row per observation)
          and do not include the CBS PDFs, which are best read on the CBS website.
        </p>
      </PageHeader>

      <ul className="grid gap-4 md:grid-cols-2">
        {files.map((f) => (
          <li key={f.file} className="flex flex-col rounded-lg border bg-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-serif text-lg font-semibold">{f.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">{f.description}</p>
              </div>
              {f.file.endsWith(".csv") ? (
                <DownloadIcon className="mt-1 size-5 shrink-0 text-terracotta" aria-hidden />
              ) : (
                <FileText className="mt-1 size-5 shrink-0 text-teal" aria-hidden />
              )}
            </div>
            {f.columns.length ? (
              <p className="mt-3 font-mono text-xs leading-relaxed break-words text-muted-foreground">
                {f.columns.join(", ")}
              </p>
            ) : null}
            <div className="mt-auto flex items-center justify-between gap-3 pt-4">
              <a
                href={`/downloads/${f.file}`}
                download={f.file.endsWith(".csv") ? f.file : undefined}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                {f.file}
              </a>
              {f.rows ? (
                <span className="tabular text-sm text-muted-foreground">{fmtInt(f.rows)} rows</span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      <section aria-labelledby="attribution" className="mt-12 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="rounded-lg border bg-card p-5">
          <h2 id="attribution" className="text-xl font-semibold">
            Attribution
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Please cite the original publisher when you use these tables:
          </p>
          <blockquote className="mt-3 border-l-[3px] border-terracotta pl-4 text-sm leading-relaxed">
            {ATTRIBUTION}
          </blockquote>
          <p className="mt-3 text-xs text-muted-foreground">
            Built from workbook SHA-256{" "}
            <code className="font-mono break-all">{meta.workbook.sha256.slice(0, 16)}…</code>. CPI
            to {meta.cpiLatestQuarter}.
          </p>
        </div>
        <div className="space-y-4">
          <Callout title="Licence">
            The underlying statistics are published by the Government of South Australia; check the{" "}
            <a href={site.cbsUrl} className="link">
              CBS gaming statistics page
            </a>{" "}
            for its terms. ABS boundaries and CPI are CC BY 4.0. The code that derives these tables
            is MIT licensed.
          </Callout>
          <Callout title="Using the council table" tone="caution">
            Keep combined groups whole. Dividing a group’s figures between its councils produces
            numbers CBS never published, and can approach figures for single venues.
          </Callout>
          <Callout title="Original files">
            The archived CBS PDFs, the original workbook and the Power BI report are in the{" "}
            <a href={`${site.repo}/tree/main/original`} className="link">
              original folder on GitHub
            </a>
            .
          </Callout>
        </div>
      </section>
    </div>
  )
}
