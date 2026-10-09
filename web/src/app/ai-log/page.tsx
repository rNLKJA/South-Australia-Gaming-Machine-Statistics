import type { Metadata } from "next"
import Link from "next/link"

import { AiLog } from "@/components/ai/ai-log"
import { AiSettingsDialog } from "@/components/ai/ai-settings-dialog"
import { Callout } from "@/components/common/callout"
import { PageHeader } from "@/components/common/page-header"
import { SupportNote } from "@/components/common/support-note"

export const metadata: Metadata = {
  title: "AI log",
  description:
    "Every AI call made on this site from your browser: input, output, model, latency, token usage and the human decision, exportable as JSON or CSV. API keys are never logged.",
}

export default function AiLogPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <PageHeader kicker="AI log" title="Every AI call from this browser">
        <p>
          Each call a model makes on this site is recorded here: what was sent (your question and
          the prompt variant, never your key), what came back, which model answered, how long it
          took, the tokens billed, and what you did with the answer. The log lives in this browser’s
          IndexedDB; this site has no server-side copy.
        </p>
      </PageHeader>
      <SupportNote compact className="mb-8 max-w-3xl" />
      <div className="mb-8 grid gap-6 md:grid-cols-[1.4fr_1fr]">
        <Callout title="Human decisions">
          <strong>Accepted</strong>: the model’s query was run unchanged. <strong>Edited</strong>:
          you changed it before running it (the version you ran is kept). <strong>Rejected</strong>:
          you discarded the draft. Evaluation runs are scored automatically and marked as such.
          Later decisions are appended, never overwritten.
        </Callout>
        <div className="flex flex-col items-start gap-3 rounded-lg border bg-card p-4 text-sm">
          <p className="text-ink-soft">
            Remove your key or switch provider at any time. The log is independent of the key:
            clearing one doesn’t clear the other.
          </p>
          <AiSettingsDialog />
          <Link href="/methods#ai-use-statement" className="link">
            Read the AI use statement
          </Link>
        </div>
      </div>
      <AiLog />
    </div>
  )
}
