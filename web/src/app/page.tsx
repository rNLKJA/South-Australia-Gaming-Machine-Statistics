import { ArrowRight } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"

import { lgaUnits, licences, manufacturers, statewide, verification } from "@/lib/data"
import { fmtChange, fmtInt, fmtMillions, fmtPct } from "@/lib/format"
import { fyLabel, fyShort } from "@/lib/fy"
import { annualLicences } from "@/lib/licences"
import { annualManufacturers, monthlyShares } from "@/lib/manufacturers"
import { nav, site } from "@/lib/site"
import { sum } from "@/lib/stats"
import { annualStatewide, type StatewideYear } from "@/lib/statewide"

export default function Home() {
  const years = annualStatewide(statewide)
  const latest = years.at(-1)!
  const first = years[0]
  const lgaGap = sum(lgaUnits.filter((u) => u.fy === "2014-15").map((u) => u.ngr)) / 1e6
  const groupsLatest = lgaUnits.filter((u) => u.fy === "2024-25" && u.kind === "group").length
  const ent = annualLicences(licences, "entitlements").filter((r) => r.fy === "2024-25")
  const entitlements = sum(ent.map((r) => r.end ?? 0))
  const maker = annualManufacturers(monthlyShares(manufacturers)).at(-1)!
  const checked = [
    verification.statewide,
    verification.lga,
    verification.licences,
    verification.manufacturers,
  ]
  const found = sum(checked.map((f) => f.found))
  const total = sum(checked.map((f) => f.checked))
  const exceptions = sum(checked.map((f) => f.misses.length))
  const scanned = sum(checked.map((f) => f.imageOnly?.length ?? 0))
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

  const cards: Record<string, string> = {
    "/statewide": `${fmtMillions(latest.ngr)} NGR in ${fyLabel(latest.fy)}, ${fmtChange(latest.ngrChange)} on the year before.`,
    "/councils": `${groupsLatest} combined council groups in FY 2024/25, mapped whole instead of split.`,
    "/licences": `${fmtInt(entitlements)} machine entitlements held at June 2025.`,
    "/manufacturers": `Aristocrat supplied ${fmtPct(maker.shares["Aristocrat"], 0)} of machines in FY 2024/25.`,
    "/data-quality": `${fmtInt(found)} of ${fmtInt(total)} figures found in the CBS PDFs; ${plural(exceptions, "exception", "exceptions")}${scanned ? ` and ${plural(scanned, "scanned PDF", "scanned PDFs")}` : ""} listed.`,
    "/analysis":
      "Every estimate with an interval: the 2020 break, council funnel plots and when concentration turned.",
    "/ask":
      "Query the tidy tables with read-only SQL in your browser; bring your own key to have a model draft it.",
    "/methods":
      "Provenance, assumptions, limitations, five decision records, a data card and a model card.",
    "/downloads":
      "Eight tidy CSV tables and a read-me, generated from the same code as the charts.",
  }

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <section className="grid gap-10 pt-12 pb-14 sm:pt-16 lg:grid-cols-[1.25fr_1fr] lg:items-end">
        <div>
          <p className="kicker text-terracotta">
            South Australia · Consumer and Business Services data
          </p>
          <h1 className="mt-4 text-display font-semibold">
            Sixteen years of gaming-machine statistics, in one place
          </h1>
          <p className="mt-6 max-w-[60ch] text-lg leading-relaxed text-ink-soft">
            South Australia’s regulator publishes its gaming-machine figures as separate PDF
            releases: a monthly statewide report, quarterly licence statistics, manufacturer counts
            and an annual breakdown by council. This project gathers about 110 of those releases,
            from July 2009 to June 2025, checks them, and lets you explore them together.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/statewide"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Explore the statewide trends <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link
              href="/councils"
              className="inline-flex items-center gap-2 rounded-md border border-foreground/20 bg-card px-4 py-2.5 text-sm font-semibold hover:bg-accent"
            >
              Open the council map
            </Link>
          </div>
        </div>
        <figure className="rounded-lg border bg-card p-5">
          <figcaption className="flex items-baseline justify-between gap-3">
            <span className="font-serif text-lg font-semibold">Net gambling revenue</span>
            <span className="text-xs text-muted-foreground">$ million, by financial year</span>
          </figcaption>
          <Sparkbars years={years} gapValue={lgaGap} />
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Hollow bar: FY 2014/15, from the LGA release (no statewide release archived). Ochre: FY
            2019/20, when venues closed for COVID-19.
          </p>
        </figure>
      </section>

      <section aria-labelledby="headline" className="double-rule pt-8">
        <h2 id="headline" className="sr-only">
          {fyLabel(latest.fy)} in four numbers
        </h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4">
          <Figure
            label={`Net gambling revenue, ${fyLabel(latest.fy)}`}
            value={fmtMillions(latest.ngr)}
          >
            Player losses on machines in hotels and clubs. {fmtMillions(first.ngr)} in FY 2009/10.
          </Figure>
          <Figure label="Gaming tax" value={fmtMillions(latest.tax)}>
            {fmtPct(latest.taxRate)} of NGR, up from {fmtPct(first.taxRate)} in FY 2009/10.
          </Figure>
          <Figure label="Machines in venues, June 2025" value={fmtInt(latest.machinesJune)}>
            Down from {fmtInt(first.machinesJune)} in June 2010.
          </Figure>
          <Figure label="Venues, June 2025" value={fmtInt(latest.venuesJune)}>
            Down from {fmtInt(first.venuesJune)} in June 2010.
          </Figure>
        </dl>
      </section>

      <section aria-labelledby="sections" className="mt-20">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 id="sections" className="text-3xl font-semibold">
            Explore
          </h2>
          <p className="hidden text-sm text-muted-foreground sm:block">
            {nav.length} sections, one dataset
          </p>
        </div>
        <ul className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {nav.map((n, i) => (
            <li key={n.href} className="bg-card">
              <Link href={n.href} className="group flex h-full flex-col p-5 hover:bg-accent/50">
                <span className="kicker tabular text-muted-foreground">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="mt-2 flex items-center gap-2 font-serif text-xl font-semibold">
                  {n.label}
                  <ArrowRight
                    className="size-4 text-terracotta transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </span>
                <span className="mt-1 text-sm text-muted-foreground">{n.description}</span>
                <span className="mt-4 text-sm leading-relaxed text-ink-soft">{cards[n.href]}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="reading" className="mt-20 grid gap-10 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <h2 id="reading" className="text-3xl font-semibold">
            Reading the numbers
          </h2>
          <p className="mt-3 leading-relaxed text-ink-soft">
            Four things to know before comparing figures across the site.
          </p>
        </div>
        <dl className="grid gap-6 sm:grid-cols-2">
          <Term title="Net gambling revenue (NGR)">
            The amount players lost: money wagered on machines minus the prizes paid out. It is the
            base for gaming tax, and what remains after tax is the venue share.
          </Term>
          <Term title="Financial years">
            All periods follow the South Australian financial year, 1 July to 30 June. FY 2024/25
            runs from July 2024 to June 2025.
          </Term>
          <Term title="Counts are snapshots">
            Machines, venues, licences and entitlements are counted at a point in time. A year is
            described by its average or its June figure, never by adding months together.
          </Term>
          <Term title="Small councils are grouped">
            CBS publishes councils with few venues as combined groups: fewer than five venues up to
            FY 2021/22, fewer than three from FY 2022/23. Group figures belong to the whole group
            and are never divided between its councils here.
          </Term>
        </dl>
      </section>

      <section aria-labelledby="about" className="mt-20 rounded-lg border bg-card p-6 sm:p-8">
        <p className="kicker text-terracotta">About this project</p>
        <h2 id="about" className="mt-2 text-3xl font-semibold">
          A personal data project, 2025
        </h2>
        <div className="mt-6 grid gap-8 lg:grid-cols-3">
          <div className="space-y-3 leading-relaxed text-ink-soft lg:col-span-2">
            <p>
              In September 2025 I ({site.author}) collected the CBS gaming-machine releases for FY
              2009/10 to FY 2024/25, transcribed them into one Excel workbook with a data
              dictionary, and built a Power BI report on top. In 2026 I rebuilt it as this website
              so anyone can use it without Excel or Power BI.
            </p>
            <p>
              The revival keeps the original figures. It adds what the first version lacked: a check
              of every figure against the PDFs, combined council groups rebuilt instead of split, a
              crosswalk to current council boundaries, corrected yearly totals for point-in-time
              counts, real-terms dollars and downloadable tables.
            </p>
            <p>
              <strong className="text-foreground">Provenance.</strong> The original archive (the
              PDFs, the workbook and the Power BI file) is kept unchanged in the repository’s{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
                original/
              </code>{" "}
              folder, and every number here is derived from that workbook by scripts that anyone can
              run. This is not affiliated with Consumer and Business Services, the Government of
              South Australia or my employer, and it takes no position for or against gambling.
            </p>
            <p>
              <a href={site.repo} className="link font-medium">
                Source code and original files on GitHub
              </a>
            </p>
          </div>
          <dl className="space-y-4 text-sm">
            <div className="border-t pt-3">
              <dt className="kicker text-muted-foreground">Original stack (2025)</dt>
              <dd className="mt-1 leading-relaxed">
                CBS PDF releases, Microsoft Excel workbook, Power BI Desktop report
              </dd>
            </div>
            <div className="border-t pt-3">
              <dt className="kicker text-muted-foreground">Revived stack (2026)</dt>
              <dd className="mt-1 leading-relaxed">
                Python (uv, openpyxl, Shapely, pdfplumber) to derive the data; Next.js 16,
                TypeScript, Tailwind CSS, Recharts and MapLibre with OpenFreeMap; Vitest
              </dd>
            </div>
            <div className="border-t pt-3">
              <dt className="kicker text-muted-foreground">Data</dt>
              <dd className="mt-1 leading-relaxed">
                {site.cbsName}. Council boundaries and CPI from the Australian Bureau of Statistics
                (CC BY 4.0).
              </dd>
            </div>
          </dl>
        </div>
      </section>
    </div>
  )
}

function Figure({ label, value, children }: { label: string; value: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="tabular mt-1 font-serif text-[1.75rem] font-semibold tracking-tight sm:text-4xl">
        {value}
      </dd>
      <dd className="mt-2 text-sm leading-relaxed text-ink-soft">{children}</dd>
    </div>
  )
}

function Term({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-t-2 border-foreground/80 pt-3">
      <dt className="font-semibold">{title}</dt>
      <dd className="mt-1 text-sm leading-relaxed text-ink-soft">{children}</dd>
    </div>
  )
}

/** A small server-rendered bar chart of annual NGR. */
function Sparkbars({ years, gapValue }: { years: StatewideYear[]; gapValue: number }) {
  const W = 480
  const H = 170
  const pad = { top: 12, bottom: 22, left: 50, right: 2 }
  const max = 1100
  const n = years.length
  const slot = (W - pad.left - pad.right) / n
  const bw = slot * 0.68
  const y = (v: number) => pad.top + (H - pad.top - pad.bottom) * (1 - v / max)
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="mt-4 h-auto w-full"
      role="img"
      aria-label={`Annual net gambling revenue from ${fmtMillions(years[0].ngr)} in FY 2009/10 to ${fmtMillions(years.at(-1)!.ngr)} in FY 2024/25, with a dip to ${fmtMillions(years.find((x) => x.fy === "2019-20")!.ngr)} in FY 2019/20.`}
    >
      {[250, 500, 750, 1000].map((g) => (
        <g key={g}>
          <line
            x1={pad.left}
            x2={W}
            y1={y(g)}
            y2={y(g)}
            stroke="var(--chart-grid)"
            strokeWidth={1}
          />
          <text
            x={pad.left - 6}
            y={y(g) + 3.5}
            textAnchor="end"
            fontSize={10.5}
            fill="var(--chart-axis)"
          >
            {g === 1000 ? "$1,000m" : `$${g}m`}
          </text>
        </g>
      ))}
      {years.map((yr, i) => {
        const x = pad.left + i * slot + (slot - bw) / 2
        const v = yr.ngr ?? gapValue
        const gap = yr.ngr == null
        const covid = yr.fy === "2019-20"
        return (
          <g key={yr.fy}>
            <rect
              x={x}
              y={y(v)}
              width={bw}
              height={y(0) - y(v)}
              fill={gap ? "none" : covid ? "var(--ochre)" : "var(--terracotta)"}
              stroke={gap ? "var(--terracotta)" : "none"}
              strokeWidth={gap ? 1.5 : 0}
              strokeDasharray={gap ? "3 2" : undefined}
            />
            {i === 0 || i === n - 1 ? (
              <text
                x={x + bw / 2}
                y={H - 6}
                textAnchor={i === 0 ? "start" : "end"}
                fontSize={10.5}
                fill="var(--chart-axis)"
              >
                {fyShort(yr.fy)}
              </text>
            ) : null}
          </g>
        )
      })}
      <line x1={pad.left} x2={W} y1={y(0)} y2={y(0)} stroke="var(--chart-axis)" strokeWidth={1} />
    </svg>
  )
}
