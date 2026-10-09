import type { Metadata } from "next"
import Link from "next/link"

import { EvalHarness } from "@/components/ask/eval-harness"
import { Callout } from "@/components/common/callout"
import { PageHeader, SectionHeading } from "@/components/common/page-header"
import { SupportNote } from "@/components/common/support-note"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { CATEGORY_LABEL, GOLD_QUESTIONS } from "@/lib/ai/sql-eval"
import { sqlSchema } from "@/lib/sql/tables"

export const metadata: Metadata = {
  title: "Text-to-SQL evaluation",
  description:
    "An evaluation harness for the bring-your-own-key text-to-SQL feature: 28 questions with reference queries checked against the site's own figures, execution accuracy with intervals, optional repeats and paired run comparisons.",
}

export default function EvaluationPage() {
  const schema = sqlSchema()
  const answerable = GOLD_QUESTIONS.filter((q) => q.category !== "abstain").length
  const abstain = GOLD_QUESTIONS.filter((q) => q.category === "abstain")
  const stated = abstain.filter((q) => q.scopeInPrompt)
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <PageHeader kicker="Ask the data · Evaluation" title="How often does the model get it right?">
        <p>
          A drafted query that runs is not the same as a right answer. This harness asks a model{" "}
          {GOLD_QUESTIONS.length} fixed questions, runs each query it writes through the same
          allow-list and database as the{" "}
          <Link href="/ask" className="link">
            Ask
          </Link>{" "}
          page, and compares the result with a hand-written reference query. {answerable} questions
          have an answer in the tables; for the other {GOLD_QUESTIONS.length - answerable}, the
          right response is to decline.
        </p>
      </PageHeader>
      <SupportNote compact className="mb-8 max-w-3xl" />

      <div className="mb-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Callout title="Reference answers are checked">
          Each reference query is run in the unit tests and compared with the figure the site
          computes in TypeScript (for example, FY 2024/25 NGR against the Statewide page’s annual
          total), so the benchmark can’t silently disagree with the site.
        </Callout>
        <Callout title="Scoring">
          A query passes when its result has the reference result’s values, whatever the column
          names. Whole numbers must match exactly and other numbers to four significant figures.
          “Strict” also requires no extra columns.
        </Callout>
        <Callout title="Small samples" tone="caution">
          {GOLD_QUESTIONS.length} questions give wide intervals: one question is about four
          percentage points. Accuracy has a Wilson 95% interval over the questions, and two runs are
          compared question by question rather than by their headline rates.
        </Callout>
        <Callout title="Runs vary" tone="caution">
          The same question can get a different answer on another call: some models don’t accept a
          temperature setting and others ignore it. Repeat the set three times to see how much
          accuracy moves; each question then scores its pass rate, and comparisons use those rates,
          so chance differences between runs aren’t read as a better model or prompt. Repeats don’t
          narrow the interval: the questions, not the calls, are the sample.
        </Callout>
      </div>

      <EvalHarness schema={schema} />

      <section aria-labelledby="questions" className="mt-14">
        <SectionHeading id="questions" kicker="The benchmark" title="Questions and what they test">
          <p>
            The questions are fixed, and no model has been run on them for this site. The prompt’s
            domain notes restate rules the site already follows (machines are averaged, groups stay
            whole), which some questions need. The “bare schema” prompt leaves the notes out, so
            comparing the two prompts shows what they are worth.
          </p>
          <p>
            The prompt’s rule for declining is generic (“if the tables below cannot answer the
            question”) and names no examples, so the {abstain.length} should-decline questions test
            whether a model recognises what the tables can’t answer. The prompt’s first sentence
            does state the scope (South Australian gaming-machine statistics, FY 2009-10 to FY
            2024-25), and {stated.length} of them ({stated.map((q) => q.id).join(", ")}) lean on it,
            so declining those is partly following the prompt. The results also give the decline
            rate on the other {abstain.length - stated.length}, the cleaner test. An earlier draft
            of the prompt listed the three original should-decline cases by name; questions a04 to
            a08 were added when that was removed.
          </p>
        </SectionHeading>
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead scope="col">#</TableHead>
                <TableHead scope="col">Question</TableHead>
                <TableHead scope="col">Category</TableHead>
                <TableHead scope="col" className="hidden md:table-cell">
                  Tests
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {GOLD_QUESTIONS.map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="tabular align-top text-muted-foreground">{q.id}</TableCell>
                  <TableCell className="align-top whitespace-normal">
                    {q.question}
                    {q.sql ? (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs text-muted-foreground">
                          Reference SQL
                        </summary>
                        <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 font-mono text-xs whitespace-pre-wrap">
                          {q.sql}
                        </pre>
                      </details>
                    ) : null}
                  </TableCell>
                  <TableCell className="align-top whitespace-normal">
                    {CATEGORY_LABEL[q.category]}
                  </TableCell>
                  <TableCell className="hidden align-top whitespace-normal text-muted-foreground md:table-cell">
                    {q.tests}
                    {q.scopeInPrompt ? (
                      <span className="mt-1 block text-xs">
                        Left out of the cleaner decline rate: {q.scopeInPrompt}
                      </span>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  )
}
