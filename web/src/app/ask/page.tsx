import type { Metadata } from "next"
import Link from "next/link"

import { AskData } from "@/components/ask/ask-data"
import { Callout } from "@/components/common/callout"
import { PageHeader, SectionHeading } from "@/components/common/page-header"
import { SupportNote } from "@/components/common/support-note"
import { DOMAIN_NOTES } from "@/lib/sql/schema"
import { sqlSchema } from "@/lib/sql/tables"

export const metadata: Metadata = {
  title: "Ask the data",
  description:
    "Query the tidy tables with read-only SQL in your browser, or bring your own Anthropic or OpenAI key to have a model draft the SQL. Every AI call is labelled and logged.",
}

const EXAMPLES = [
  "Which five council areas had the most gaming machines in FY 2024-25?",
  "How did gaming tax change between FY 2015-16 and FY 2024-25?",
  "What was IGT's average share of machines in each financial year?",
  "How many club licences were live in June 2025?",
]

export default function AskPage() {
  const schema = sqlSchema()
  const notes = DOMAIN_NOTES.split("\n").slice(1)
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <PageHeader kicker="Ask the data" title="Query the tables yourself, with or without AI">
        <p>
          The eight tables from Downloads are loaded into a read-only SQLite database inside your
          browser. Write SQL against them directly, or bring your own API key and let a language
          model draft the query from a plain-English question. You always see the SQL before it
          runs.
        </p>
      </PageHeader>
      <SupportNote compact className="mb-8 max-w-3xl" />

      <div className="mb-10 grid gap-6 md:grid-cols-3">
        <Callout title="Read-only, three ways">
          Every query is checked against an allow-list (one SELECT, these tables, listed functions
          only), the database refuses writes, and a query that runs longer than five seconds is
          stopped.
        </Callout>
        <Callout title="Your key stays with you">
          The key is kept in this tab (or this browser, if you choose) and sent only to the
          provider. This site has no server-side AI and never sees the key.
        </Callout>
        <Callout title="Labelled and logged">
          Model output is marked AI-generated, results from a model’s query AI-assisted, and every
          call is in the{" "}
          <Link href="/ai-log" className="link">
            AI log
          </Link>{" "}
          with your decision. How well it works:{" "}
          <Link href="/ask/evaluation" className="link">
            the evaluation
          </Link>
          .
        </Callout>
      </div>

      <AskData schema={schema} examples={EXAMPLES} />

      <section aria-labelledby="schema" className="mt-14">
        <SectionHeading id="schema" kicker="Reference" title="Tables and columns">
          <p>
            The same tables as the CSV downloads, with the same column names. The notes below are
            also given to the model.
          </p>
        </SectionHeading>
        <div className="grid gap-4 md:grid-cols-2">
          {schema.map((t) => (
            <details key={t.name} className="rounded-lg border bg-card px-4 py-3 text-sm">
              <summary className="cursor-pointer">
                <code className="font-mono font-medium">{t.name}</code>{" "}
                <span className="text-muted-foreground">
                  · {t.rows.toLocaleString("en-AU")} rows
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{t.description}</span>
              </summary>
              <ul className="mt-3 space-y-1">
                {t.columns.map((c) => (
                  <li key={c.name} className="flex flex-wrap gap-x-2">
                    <code className="font-mono">{c.name}</code>
                    <span className="text-xs text-muted-foreground">{c.type}</span>
                    {c.values ? (
                      <span className="text-xs text-muted-foreground">
                        {c.values.map((v) => `'${v}'`).join(", ")}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
        <div className="mt-6 rounded-lg border bg-card p-4 text-sm">
          <p className="font-semibold">Notes that matter when you query</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 leading-relaxed text-ink-soft">
            {notes.map((n) => (
              <li key={n}>{n.replace(/^- /, "")}</li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}
