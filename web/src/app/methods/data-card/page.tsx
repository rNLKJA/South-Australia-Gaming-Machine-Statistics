import type { Metadata } from "next"
import Link from "next/link"

import { Markdown } from "@/components/common/markdown"
import { PageHeader } from "@/components/common/page-header"
import { SupportNote } from "@/components/common/support-note"
import { readDoc } from "@/server/content"

export const metadata: Metadata = {
  title: "Data card",
  description:
    "Sources, licences, processing, the council crosswalk, combined groups, gaps and known issues for the tidy tables.",
}

export default function DataCardPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <nav aria-label="Breadcrumb" className="pt-8 text-sm text-muted-foreground">
        <Link href="/methods" className="link">
          Methods
        </Link>{" "}
        / Data card
      </nav>
      <PageHeader kicker="Methods" title="Data card" />
      <SupportNote compact className="mb-10 max-w-3xl" />
      <article>
        <Markdown source={readDoc("data-card")} hideTitle topLevel={1} />
      </article>
    </div>
  )
}
