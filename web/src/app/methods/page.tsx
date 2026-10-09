import { ArrowRight } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { Markdown } from "@/components/common/markdown"
import { PageHeader } from "@/components/common/page-header"
import { SupportNote } from "@/components/common/support-note"
import { site } from "@/lib/site"
import { listDecisions, readDoc } from "@/server/content"

export const metadata: Metadata = {
  title: "Methods and decisions",
  description:
    "Data provenance, methods, evaluation design, assumptions, limitations, decision records, the data card, the model card and the AI use statement.",
}

const LINKS = [
  {
    href: "/methods/data-card",
    title: "Data card",
    text: "Sources, licences, the crosswalk, combined groups, gaps and known issues.",
  },
  {
    href: "/methods/model-card",
    title: "Model card",
    text: "The three statistical models and the text-to-SQL feature: use, evaluation, failure modes.",
  },
  {
    href: "/analysis",
    title: "Analysis",
    text: "Trends, councils and concentration, with intervals and seeds.",
  },
  {
    href: "/data-quality",
    title: "Data quality",
    text: "The PDF cross-check, reconciliation, groups, crosswalk, gaps and the Power BI totals.",
  },
  {
    href: "/ask/evaluation",
    title: "Text-to-SQL evaluation",
    text: "23 questions with checked reference answers, Wilson intervals, paired comparisons.",
  },
  {
    href: "/ai-log",
    title: "AI log",
    text: "Every AI call from this browser, with the human decision, exportable.",
  },
]

export default function MethodsPage() {
  const decisions = listDecisions()
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <PageHeader kicker="Methods" title="How the numbers were made, and the decisions behind them">
        <p>
          Provenance, methods, evaluation design, assumptions, limitations and what I would change,
          followed by the decision records and the AI use statement. The same documents are in the
          repository’s{" "}
          <a href={`${site.repo}/tree/main/docs`} className="link">
            docs/ folder
          </a>
          .
        </p>
      </PageHeader>
      <SupportNote compact className="mb-10 max-w-3xl" />

      <nav aria-label="Related pages" className="mb-14">
        <ul className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {LINKS.map((l) => (
            <li key={l.href} className="bg-card">
              <Link href={l.href} className="group flex h-full flex-col p-5 hover:bg-accent/50">
                <span className="flex items-center gap-2 font-serif text-lg font-semibold">
                  {l.title}
                  <ArrowRight
                    className="size-4 text-terracotta transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </span>
                <span className="mt-1 text-sm leading-relaxed text-muted-foreground">{l.text}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <article>
          <Markdown source={readDoc("methods")} hideTitle topLevel={1} />
        </article>
        <aside aria-labelledby="decisions" className="lg:sticky lg:top-24 lg:self-start">
          <h2 id="decisions" className="text-xl font-semibold">
            Decision records
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Context, the decision, options, why, what happened and what I’d change. Past records are
            superseded, never edited.
          </p>
          <ol className="mt-4 space-y-3">
            {decisions.map((d) => (
              <li key={d.slug}>
                <Link
                  href={`/methods/decisions/${d.slug}`}
                  className="group block rounded-lg border bg-card p-3 hover:bg-accent/50"
                >
                  <span className="kicker text-terracotta">
                    {d.id} · {d.status}
                  </span>
                  <span className="mt-1 block text-sm font-semibold group-hover:underline">
                    {d.title}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </aside>
      </div>

      <section
        aria-labelledby="ai-use-statement"
        className="mt-16 rounded-lg border bg-card p-5 sm:p-8"
      >
        <Markdown source={readDoc("ai-use-statement")} topLevel={2} />
      </section>
    </div>
  )
}
