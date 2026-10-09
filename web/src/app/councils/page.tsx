import type { Metadata } from "next"
import Link from "next/link"

import { Callout } from "@/components/common/callout"
import { PageHeader } from "@/components/common/page-header"
import { CouncilExplorer } from "@/components/councils/council-explorer"
import { crosswalk, lgaUnits } from "@/lib/data"
import { fmtAudCompact, fmtPct } from "@/lib/format"
import { fyLabel } from "@/lib/fy"
import { LGA_FYS, LGA_LAST_FY, rankUnits, unitsForFy } from "@/lib/lga"
import { sum } from "@/lib/stats"

export const metadata: Metadata = {
  title: "Councils",
  description:
    "Gaming-machine NGR, machines and venues by South Australian local government area, FY 2013/14 to FY 2024/25, with combined council groups shown as CBS published them.",
}

export default function CouncilsPage() {
  const latest = unitsForFy(lgaUnits, LGA_LAST_FY)
  const total = sum(latest.map((u) => u.ngr))
  const top5 = rankUnits(latest, "ngr").slice(0, 5)
  const top5Share = sum(top5.map((u) => u.ngr)) / total
  const groups = latest.filter((u) => u.kind === "group")
  // ABS code → the name this site uses for the council (one per code with its own boundary).
  const councilNames = Object.fromEntries(
    crosswalk.filter((c) => c.geometry).map((c) => [c.absCode, c.displayName])
  )

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <PageHeader kicker="Councils" title="Where gaming-machine revenue is spent, by council area">
        <p>
          Each year CBS publishes NGR, machines and venues for every local government area with
          gaming venues. In FY 2024/25 the five largest areas ({top5.map((u) => u.label).join(", ")}
          ) accounted for {fmtPct(top5Share, 0)} of the state’s {fmtAudCompact(total)}.
        </p>
      </PageHeader>

      <Callout
        title="Combined groups are shown as one area"
        tone="caution"
        className="mb-8 max-w-4xl"
      >
        To protect venue confidentiality CBS combines councils with few venues into groups: fewer
        than five venues up to FY 2021/22, and fewer than three from FY 2022/23 ({groups.length}{" "}
        groups in {fyLabel(LGA_LAST_FY)}). The original workbook divided each group’s figures
        equally across its members; this site rebuilds the groups and maps them as one shape,
        because the equal split is not an observation. Names are matched to ABS council boundaries
        through a{" "}
        <Link href="/data-quality#crosswalk" className="link">
          documented crosswalk
        </Link>
        .
      </Callout>

      <CouncilExplorer units={lgaUnits} fys={LGA_FYS} councilNames={councilNames} />

      <div className="mt-10 grid gap-6 md:grid-cols-3">
        <Callout title="FY 2019/20">
          The FY 2019/20 release has no machine column, and NGR for the year reflects the COVID-19
          closures from March 2020.
        </Callout>
        <Callout title="Boundaries">
          Council boundaries are ABS Local Government Areas 2024, simplified to about 100 m. Older
          council names (Mallala, Le Hunte, Wakefield Region) are mapped to today’s areas.
        </Callout>
        <Callout title="The unincorporated area">
          CBS reports the unincorporated area in two parts (Far North and West Coast); ABS has one
          boundary for it, which the map draws with the Far North part.
        </Callout>
      </div>
    </div>
  )
}
