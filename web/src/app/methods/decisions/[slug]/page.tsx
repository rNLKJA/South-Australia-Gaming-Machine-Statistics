import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { Markdown } from "@/components/common/markdown"
import { PageHeader } from "@/components/common/page-header"
import { SupportNote } from "@/components/common/support-note"
import { getDecision, listDecisions } from "@/server/content"

export function generateStaticParams() {
  return listDecisions().map((d) => ({ slug: d.slug }))
}

export async function generateMetadata({
  params,
}: PageProps<"/methods/decisions/[slug]">): Promise<Metadata> {
  const { slug } = await params
  const d = getDecision(slug)
  return d ? { title: `${d.id}: ${d.title}`, description: d.decision } : {}
}

export default async function DecisionPage({ params }: PageProps<"/methods/decisions/[slug]">) {
  const { slug } = await params
  const d = getDecision(slug)
  if (!d) notFound()
  const all = listDecisions()
  const i = all.findIndex((x) => x.slug === slug)
  const prev = all[i - 1]
  const next = all[i + 1]
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <nav aria-label="Breadcrumb" className="pt-8 text-sm text-muted-foreground">
        <Link href="/methods" className="link">
          Methods
        </Link>{" "}
        / Decision records / {d.id}
      </nav>
      <PageHeader kicker={`${d.id} · ${d.status} · ${d.date}`} title={d.title} />
      <div className="mb-10 max-w-[75ch] border-l-[3px] border-terracotta py-1 pl-4">
        <p className="kicker text-terracotta">Decision</p>
        <p className="mt-1 text-lg leading-relaxed">{d.decision}</p>
      </div>
      <article>
        <Markdown source={d.body} topLevel={1} />
      </article>
      <nav
        aria-label="Other decision records"
        className="mt-14 flex max-w-[75ch] flex-wrap justify-between gap-4 border-t pt-6 text-sm"
      >
        {prev ? (
          <Link href={`/methods/decisions/${prev.slug}`} className="link">
            ← {prev.id}: {prev.title}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link href={`/methods/decisions/${next.slug}`} className="link text-right">
            {next.id}: {next.title} →
          </Link>
        ) : null}
      </nav>
      <SupportNote compact className="mt-12 max-w-3xl" />
    </div>
  )
}
