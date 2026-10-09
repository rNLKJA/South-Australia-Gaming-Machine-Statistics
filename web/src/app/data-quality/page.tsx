import { CheckCircle2, CircleAlert } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import type { ReactNode } from "react"

import { Callout } from "@/components/common/callout"
import { PageHeader, SectionHeading } from "@/components/common/page-header"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  crosswalk,
  licences,
  lgaRows,
  lgaUnits,
  manufacturers,
  powerBiVisuals,
  statewide,
  verification,
} from "@/lib/data"
import { fmtAudCents, fmtDec1, fmtInt, fmtMillions, fmtPct } from "@/lib/format"
import { fyLabel, fyShort, monthLabel } from "@/lib/fy"
import { GROUPING_RULE_CHANGE_FY, LGA_FYS, LGA_NO_MACHINES_FY, reconcile } from "@/lib/lga"
import { missingLicenceMonths } from "@/lib/licences"
import { missingManufacturerMonths } from "@/lib/manufacturers"
import { asBuiltComparisons, powerBiFields } from "@/lib/powerbi"
import { annualStatewide, STATEWIDE_MISSING_FY } from "@/lib/statewide"
import type { CrosswalkRelation, VerificationFamily } from "@/lib/types"

export const metadata: Metadata = {
  title: "Data quality",
  description:
    "How the consolidated workbook was checked against the CBS PDFs: reconciliation, combined council groups, the name crosswalk, gaps, and the Power BI aggregation issue.",
}

const RELATION_LABEL: Record<CrosswalkRelation, string> = {
  same: "Same name",
  spelling: "Spelling variant",
  suffix: "Council-type suffix",
  renamed: "Council renamed",
  fragment: "Fragment of one council",
  part: "Part of the unincorporated area",
}

const TOC = [
  { id: "cross-check", label: "Checked against the PDFs" },
  { id: "reconciliation", label: "LGA and statewide totals" },
  { id: "groups", label: "Combined groups and the equal split" },
  { id: "crosswalk", label: "Council name crosswalk" },
  { id: "gaps", label: "Gaps and breaks" },
  { id: "power-bi", label: "The Power BI totals" },
]

export default function DataQualityPage() {
  const groupCount = (fy: string) =>
    lgaUnits.filter((u) => u.fy === fy && u.kind === "group").length
  const ruleFyIndex = LGA_FYS.indexOf(GROUPING_RULE_CHANGE_FY)
  const sw = new Map(annualStatewide(statewide).map((y) => [y.fy, y.ngr]))
  const rec = reconcile(lgaRows, lgaUnits, sw)
  const printed = new Map((verification.lga.totals ?? []).map((t) => [t.fy, t.printedTotal]))
  const families: VerificationFamily[] = [
    verification.statewide,
    verification.lga,
    verification.licences,
    verification.manufacturers,
  ]

  // Distinct combined groups and split councils, with the years they were published.
  const compositions = new Map<
    string,
    { label: string; years: string[]; names: Set<string>; kind: string }
  >()
  for (const u of lgaUnits) {
    if (u.kind === "single") continue
    const c = compositions.get(u.id) ?? {
      label: u.label,
      years: [],
      names: new Set<string>(),
      kind: u.kind,
    }
    c.years.push(u.fy)
    u.workbookNames.forEach((n) => c.names.add(n))
    compositions.set(u.id, c)
  }
  const groupList = [...compositions.values()]
    .filter((c) => c.kind === "group")
    .sort((a, b) => a.label.localeCompare(b.label))
  const splitList = [...compositions.values()]
    .filter((c) => c.kind === "split")
    .sort((a, b) => a.label.localeCompare(b.label))
  const example = lgaUnits.find(
    (u) => u.fy === "2013-14" && u.label === "Barunga West, Copper Coast"
  )!
  const fractional = lgaRows.filter((r) => r.machines % 1 !== 0 || r.premises % 1 !== 0).length

  const xwChanged = crosswalk
    .filter((c) => c.relation !== "same")
    .sort(
      (a, b) =>
        a.displayName.localeCompare(b.displayName) || a.workbookName.localeCompare(b.workbookName)
    )
  const xwSame = crosswalk.filter((c) => c.relation === "same")

  const fields = powerBiFields(powerBiVisuals)
  const comparisons = asBuiltComparisons("2024-25", { statewide, licences, manufacturers })

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <PageHeader
        kicker="Data quality"
        title="What was checked, what is missing, and what was corrected"
      >
        <p>
          The original project transcribed about 110 CBS PDFs into one workbook and built a Power BI
          report on it. Before putting the figures online, every number was checked against the PDFs
          it came from, and the places where the workbook or the report need care are listed here.
          Nothing is hidden or smoothed over.
        </p>
      </PageHeader>

      <nav aria-label="On this page" className="mb-12 rounded-lg border bg-card p-4">
        <p className="kicker mb-2 text-muted-foreground">On this page</p>
        <ol className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {TOC.map((t, i) => (
            <li key={t.id}>
              <a href={`#${t.id}`} className="hover:text-teal hover:underline">
                <span className="tabular mr-2 text-muted-foreground">{i + 1}.</span>
                {t.label}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <Section id="cross-check" n={1} title="Checked against the PDFs">
        <p>
          A script reads the text of every archived PDF and looks for each workbook figure in the
          release it was transcribed from (a presence check, not a position check). Small counts
          under 100 are skipped because they appear everywhere.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {families.map((f) => (
            <div key={f.family} className="rounded-lg border bg-card p-4">
              <p className="text-sm font-medium">{f.family}</p>
              <p className="tabular mt-2 font-serif text-3xl font-semibold">
                {fmtPct(f.found / f.checked, f.found === f.checked ? 0 : 1)}
              </p>
              <p className="tabular text-sm text-muted-foreground">
                {fmtInt(f.found)} of {fmtInt(f.checked)} values found
              </p>
              <p className="mt-2 flex items-center gap-1.5 text-sm">
                {f.misses.length ? (
                  <CircleAlert className="size-4 text-ochre" aria-hidden />
                ) : (
                  <CheckCircle2 className="size-4 text-teal" aria-hidden />
                )}
                {f.misses.length
                  ? `${f.misses.length} exception${f.misses.length > 1 ? "s" : ""}`
                  : "No exceptions"}
              </p>
            </div>
          ))}
        </div>
        <h3 className="mt-8 text-xl font-semibold">The exceptions</h3>
        <ul className="mt-3 space-y-3 text-[0.95rem] leading-relaxed">
          <li>
            <strong>Prospect and Walkerville, FY 2015/16.</strong> The workbook has{" "}
            {fmtAudCents(14393352.18)} for the group; the CBS release prints{" "}
            {fmtAudCents(14393272.17)}. The workbook is {fmtAudCents(80.01)} too high, which is also
            why its FY 2015/16 LGA total is {fmtAudCents(80.11)} above the printed total.
          </li>
          <li>
            <strong>Light and Mallala machines, FY 2013/14.</strong> CBS printed 109 machines for
            the group. The workbook split them as 54.5 and 55, which add to 109.5, so the rebuilt
            group shows 110.
          </li>
          <li>
            <strong>Hotel entitlements, April 2025.</strong> The workbook has 11,484; the CBS
            release prints 11,474 for April (11,482 is May’s figure).
          </li>
          <li>
            <strong>One image-only PDF.</strong>{" "}
            {(verification.licences.imageOnly ?? []).join(", ")} (Gaming Machine Licence Statistics)
            is a scanned print with no text layer, so its three months could not be checked
            automatically.
          </li>
        </ul>
        <p className="mt-4 text-sm text-muted-foreground">
          These are left as transcribed so the site matches the original workbook; the sizes
          involved are immaterial to every chart.
        </p>
      </Section>

      <Section id="reconciliation" n={2} title="LGA and statewide totals agree">
        <p>
          Two independent CBS series measure the same NGR: the monthly statewide release and the
          annual release by council area. Adding up every council row should give the statewide
          figure. Statewide months are printed to the nearest $10,000, so twelve of them can drift
          by up to $60,000 from the exact total.
        </p>
        <div className="mt-5 rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead scope="col">Financial year</TableHead>
                <TableHead scope="col" className="text-right">
                  LGA rows (workbook)
                </TableHead>
                <TableHead scope="col" className="text-right">
                  LGA release total (printed)
                </TableHead>
                <TableHead scope="col" className="text-right">
                  Statewide (sum of months)
                </TableHead>
                <TableHead scope="col" className="text-right">
                  LGA − statewide
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rec.map((r) => (
                <TableRow key={r.fy}>
                  <TableHead scope="row" className="font-medium whitespace-nowrap">
                    {fyLabel(r.fy)}
                  </TableHead>
                  <TableCell className="tabular text-right">{fmtAudCents(r.lgaTotal)}</TableCell>
                  <TableCell className="tabular text-right">
                    {fmtAudCents(printed.get(r.fy))}
                  </TableCell>
                  <TableCell className="tabular text-right">
                    {r.statewide == null ? (
                      <span className="text-muted-foreground italic">no release</span>
                    ) : (
                      fmtMillions(r.statewide / 1e6, 2)
                    )}
                  </TableCell>
                  <TableCell className="tabular text-right">
                    {r.difference == null
                      ? "–"
                      : `${r.difference > 0 ? "+" : "−"}$${fmtInt(Math.abs(r.difference))}`}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          The largest gap is $15,769 in FY 2016/17, about 0.002% of the year’s NGR. Because the two
          series agree, the FY {fyShort(STATEWIDE_MISSING_FY)} LGA total can stand in for the
          missing statewide year on the annual chart, clearly marked.
        </p>
      </Section>

      <Section id="groups" n={3} title="Combined groups and the equal split">
        <p>
          CBS combines councils with few venues into groups so that no single venue’s revenue can be
          worked out. The releases up to FY 2021/22 say a council with fewer than five venues is
          grouped with another; from FY 2022/23 the threshold is fewer than three. The workbook
          stored each group by repeating it on every member’s row after dividing it equally. In FY
          2013/14, for example, CBS published <em>Barunga West, Copper Coast</em> as one row with
          NGR of {fmtAudCents(example.ngr)}; the workbook shows {fmtAudCents(example.perRowNgr)}{" "}
          against each council. That is why {fmtInt(fractional)} workbook rows have fractional
          machine or venue counts such as 85.5 or 187.33.
        </p>
        <p>
          This site groups the workbook rows back together (rows of one year with identical NGR and
          NGR per venue belong to one published row), maps each group as a single shape, and never
          presents a member’s equal share as its own figure. The rebuilt rows match the number of
          rows CBS printed each year, and every rebuilt NGR figure is found in its PDF except the
          one listed above.
        </p>
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-lg border bg-card">
            <p className="border-b px-4 py-3 font-serif text-lg font-semibold">
              Combined groups ({groupList.length} compositions)
            </p>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead scope="col">Published group</TableHead>
                  <TableHead scope="col">Years</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupList.map((g) => (
                  <TableRow key={g.label}>
                    <TableCell className="whitespace-normal">{g.label}</TableCell>
                    <TableCell className="tabular whitespace-normal text-muted-foreground">
                      {yearSpan(g.years)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="rounded-lg border bg-card">
            <p className="border-b px-4 py-3 font-serif text-lg font-semibold">
              Single councils split by name ({splitList.length})
            </p>
            <p className="px-4 pt-3 text-sm text-muted-foreground">
              Councils whose name contains a comma, slash or ampersand were also split into several
              rows. They are one council and are treated as one.
            </p>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead scope="col">Council</TableHead>
                  <TableHead scope="col">Workbook rows</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {splitList.map((g) => (
                  <TableRow key={g.label}>
                    <TableCell className="whitespace-normal">
                      {g.label}
                      <span className="tabular block text-xs text-muted-foreground">
                        {yearSpan(g.years)}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-normal text-muted-foreground">
                      {[...g.names].join(", ")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </Section>

      <Section id="crosswalk" n={4} title="Council name crosswalk">
        <p>
          Council names drift across the LGA releases: typos, punctuation, council-type suffixes,
          renamed councils and the workbook’s own splits. Each of the {crosswalk.length} names in
          the workbook is mapped by hand to an ABS Local Government Area (2024 edition) in{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
            scripts/lga_crosswalk.csv
          </code>
          . The {xwChanged.length} names that differ from the ABS area are listed here.
        </p>
        <div className="mt-5 rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead scope="col" className="whitespace-normal">
                  Name in the workbook
                </TableHead>
                <TableHead scope="col" className="hidden sm:table-cell">
                  Mapped to
                </TableHead>
                <TableHead scope="col">Why</TableHead>
                <TableHead scope="col" className="hidden md:table-cell">
                  Years
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {xwChanged.map((c) => (
                <TableRow key={c.workbookName}>
                  <TableCell className="font-medium whitespace-normal">
                    {c.workbookName}
                    {/* Phones fold "Mapped to" in here so the reason stays on screen. */}
                    <span className="block text-xs font-normal text-muted-foreground sm:hidden">
                      → {c.displayName}
                    </span>
                  </TableCell>
                  <TableCell className="hidden whitespace-normal sm:table-cell">
                    {c.displayName}
                    {c.absName !== c.displayName ? (
                      <span className="block text-xs text-muted-foreground">ABS: {c.absName}</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    <Badge variant="outline" className="mb-1">
                      {RELATION_LABEL[c.relation]}
                    </Badge>
                    <span className="block text-xs leading-snug text-muted-foreground">
                      {c.note}
                    </span>
                  </TableCell>
                  <TableCell className="tabular hidden text-xs whitespace-normal text-muted-foreground md:table-cell">
                    {yearSpan(c.years)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <details className="mt-3 rounded-lg border bg-card px-4 py-3 text-sm">
          <summary className="cursor-pointer font-medium">
            The {xwSame.length} names that match an ABS area directly
          </summary>
          <p className="mt-2 leading-relaxed text-muted-foreground">
            {xwSame.map((c) => c.workbookName).join(", ")}.
          </p>
        </details>
      </Section>

      <Section id="gaps" n={5} title="Gaps and breaks in the series">
        <ul className="mt-2 space-y-4 text-[0.95rem] leading-relaxed">
          <Gap title={`Statewide: ${fyLabel(STATEWIDE_MISSING_FY)} is missing`}>
            No statewide release for that year is in the archive, and the CBS website blocks
            automated downloads, so the monthly figures were not filled in. The annual NGR comes
            from the LGA release instead and is marked as such.
          </Gap>
          <Gap title={`Licences: ${missingLicenceMonths(licences).map(monthLabel).join(", ")}`}>
            The 2017-18 Quarter 1 release is not in the archive.
          </Gap>
          <Gap
            title={`Manufacturers: ${missingManufacturerMonths(manufacturers).map(monthLabel).join(", ")}`}
          >
            The archived “2023-24 Q2” file repeats Quarter 1, so the second quarter of FY 2023/24 is
            missing.
          </Gap>
          <Gap title={`Councils: no machine counts for ${fyLabel(LGA_NO_MACHINES_FY)}`}>
            That year’s LGA release has no machine column. The workbook stores 0 for every area; the
            site treats the counts as not published.
          </Gap>
          <Gap title="Licences: casino entitlements under Special Circumstances, 2014">
            From January to December 2014 the Special Circumstances entitlements jump by about 1,000
            (to 2,185, then 2,212), and fall back to 1,192 in January 2015 when the casino is first
            listed with 1,020 of its own. The figures are shown as published.
          </Gap>
          <Gap title="COVID-19, FY 2019/20">
            Venues closed in late March 2020. The statewide release reports zero machines for March
            to June 2020 and almost no NGR for April to June. FY 2019/20 is shaded on every chart.
          </Gap>
          <Gap title="Council venue counts, FY 2021/22">
            The FY 2021/22 LGA release totals 603 venues, against 484 the year before and 488 the
            year after. The figure is shown as published.
          </Gap>
          <Gap title="Revised LGA release, FY 2022/23">
            CBS reissued the FY 2022/23 LGA release in January 2024 to correct its source data. The
            archive holds the reissued version.
          </Gap>
          <Gap title={`Grouping rule changed in ${fyLabel(GROUPING_RULE_CHANGE_FY)}`}>
            The FY 2013/14 to 2021/22 LGA releases group a council with fewer than five venues; the
            FY 2022/23 release and later ones group only those with fewer than three. That is why
            the number of combined groups falls from {groupCount(LGA_FYS[ruleFyIndex - 1])} to{" "}
            {groupCount(GROUPING_RULE_CHANGE_FY)} that year, and why Campbelltown and Kangaroo
            Island (three venues each) are published on their own from then, as Grant was in FY
            2022/23.
          </Gap>
          <Gap title="Changing council groups">
            The groups CBS combines also change from year to year under the same rule (Grant and
            Mount Gambier were separate in FY 2022/23 and combined again the year after, for
            example). A council’s history on the Councils page notes every change of group.
          </Gap>
        </ul>
      </Section>

      <Section id="power-bi" n={6} title="The Power BI totals: summing snapshots">
        <p>
          The original Power BI report puts a financial-year axis on tables that hold one row per
          month and uses the default{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">Sum</code>{" "}
          aggregation. That is right for flows such as NGR and tax, which accumulate over the year,
          but wrong for stocks (machines, venues, entitlements, licences) and for shares: twelve
          snapshots added together are about twelve times the real level. This site averages
          snapshots (or takes June) instead, as the workbook’s own INFO pivots do.
        </p>
        <div className="mt-6 rounded-lg border bg-card">
          <p className="border-b px-4 py-3 font-serif text-lg font-semibold">
            As built in Power BI versus corrected, {fyLabel("2024-25")}
          </p>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead scope="col" className="hidden sm:table-cell">
                  Power BI page
                </TableHead>
                <TableHead scope="col">Measure</TableHead>
                <TableHead scope="col" className="text-right">
                  As built (Sum)
                </TableHead>
                <TableHead scope="col" className="text-right">
                  Corrected
                </TableHead>
                <TableHead scope="col" className="hidden text-right sm:table-cell">
                  Ratio
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comparisons.map((c) => (
                <TableRow key={c.measure}>
                  <TableCell className="hidden whitespace-normal text-muted-foreground sm:table-cell">
                    {c.page}
                  </TableCell>
                  <TableCell className="min-w-36 font-medium whitespace-normal">
                    {c.measure}
                    <span className="block text-xs font-normal text-muted-foreground">
                      <span className="sm:hidden">{c.page} · </span>
                      {c.correctedMethod}
                    </span>
                  </TableCell>
                  <TableCell className="tabular text-right">
                    {fmtValue(c.asBuilt, c.unit)}
                  </TableCell>
                  <TableCell className="tabular text-right">
                    {fmtValue(c.corrected, c.unit)}
                    {/* Phones show the ratio under the corrected value instead of a column. */}
                    <span className="block text-xs sm:hidden">
                      <Ratio asBuilt={c.asBuilt} corrected={c.corrected} />
                    </span>
                  </TableCell>
                  <TableCell className="tabular hidden text-right sm:table-cell">
                    <Ratio asBuilt={c.asBuilt} corrected={c.corrected} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <details className="mt-3 rounded-lg border bg-card px-4 py-3 text-sm">
          <summary className="cursor-pointer font-medium">
            Every aggregated field in the report ({fields.length})
          </summary>
          <Table className="mt-2">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead scope="col">Page</TableHead>
                <TableHead scope="col">Visual</TableHead>
                <TableHead scope="col">Field</TableHead>
                <TableHead scope="col">Verdict</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((f, i) => (
                <TableRow key={`${f.page}-${f.field}-${i}`}>
                  <TableCell className="whitespace-normal">{f.page}</TableCell>
                  <TableCell>{f.visualType}</TableCell>
                  <TableCell className="whitespace-normal">
                    {f.aggregation}({f.label})
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    {f.kind === "flow"
                      ? "Correct: a flow"
                      : f.kind === "split"
                        ? "Shows equal-split rows per council name"
                        : f.byYear
                          ? "Inflated about 12× by summing months"
                          : "Not on a time axis"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </details>
        <Callout className="mt-6" title="Reproducible">
          The field list is read from the <code className="font-mono text-[0.85em]">.pbix</code>{" "}
          file’s report layout by{" "}
          <code className="font-mono text-[0.85em]">scripts/build_data.py</code>. The site’s unit
          tests check that the statewide as-built sums of machines and venues equal the workbook’s
          INFO pivots exactly, and that the licence and manufacturer as-built sums are twelve times
          the monthly mean for a full year (the workbook has no “Sum of” pivot for those). See{" "}
          <Link href="/downloads" className="link">
            Downloads
          </Link>{" "}
          for the corrected tables.
        </Callout>
      </Section>
    </div>
  )
}

function Ratio({ asBuilt, corrected }: { asBuilt: number; corrected: number }) {
  return Math.abs(asBuilt / corrected - 1) < 1e-9 ? (
    <span className="text-teal">correct</span>
  ) : (
    <span className="text-terracotta">{fmtDec1(asBuilt / corrected)}×</span>
  )
}

function Section({
  id,
  n,
  title,
  children,
}: {
  id: string
  n: number
  title: string
  children: ReactNode
}) {
  return (
    <section aria-labelledby={id} className="mb-16 scroll-mt-24">
      <SectionHeading id={id} kicker={`Section ${n}`} title={title} />
      <div className="max-w-none space-y-3 leading-relaxed text-ink-soft [&>p]:max-w-[75ch]">
        {children}
      </div>
    </section>
  )
}

function Gap({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li className="border-l-[3px] border-ochre pl-4">
      <p className="font-semibold text-foreground">{title}</p>
      <p className="max-w-[75ch] text-ink-soft">{children}</p>
    </li>
  )
}

function fmtValue(v: number, unit: "count" | "share" | "money") {
  if (unit === "money") return fmtMillions(v, 2)
  if (unit === "share") return fmtPct(v, 1)
  return Number.isInteger(v) ? fmtInt(v) : fmtDec1(v)
}

/** "2013-14, 2014-15, 2015-16, 2017-18" -> "2013/14–2015/16, 2017/18". */
function yearSpan(fys: string[]): string {
  const idx = [...new Set(fys)]
    .map((f) => LGA_FYS.indexOf(f))
    .filter((i) => i >= 0)
    .sort((a, b) => a - b)
  if (!idx.length) return "–"
  const runs: [number, number][] = []
  for (const i of idx) {
    const last = runs.at(-1)
    if (last && i === last[1] + 1) last[1] = i
    else runs.push([i, i])
  }
  return runs
    .map(([a, b]) =>
      a === b ? fyShort(LGA_FYS[a]) : `${fyShort(LGA_FYS[a])}–${fyShort(LGA_FYS[b])}`
    )
    .join(", ")
}
