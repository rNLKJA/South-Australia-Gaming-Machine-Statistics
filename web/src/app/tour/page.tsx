import { ArrowRight, Clapperboard } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { Callout } from "@/components/common/callout"
import { PageHeader, SectionHeading } from "@/components/common/page-header"
import { LazyVideo } from "@/components/tour/lazy-video"
import { ScreenshotGallery } from "@/components/tour/screenshot-gallery"
import { buttonVariants } from "@/components/ui/button"
import {
  MOCK_ANSWER_PREFIX,
  MOCK_LABEL,
  SCREENSHOTS,
  WALKTHROUGHS,
  walkthroughMedia,
  type Walkthrough,
} from "@/lib/showcase"
import { site } from "@/lib/site"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Guided tour",
  description:
    "Three short captioned walkthroughs (statewide revenue with its gap and closures, the council map and funnel plot, and asking the data with optional AI) and screenshots of every key feature, recorded by a reproducible Playwright script.",
}

export default function TourPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <PageHeader kicker="Guided tour" title="The site in three short walkthroughs">
        <p>
          Each video follows one workflow from start to finish, with the step shown on screen, as
          captions and in the list beside it. A Playwright script recorded them from this site and
          checked every step on the way (the published figures, the interval it quotes, the drafted
          query passing the allow-list), so a broken feature would fail the recording rather than
          appear in it.
        </p>
        <nav aria-label="On this page" className="flex flex-wrap gap-x-5 gap-y-1 pt-1 text-base">
          {WALKTHROUGHS.map((w, i) => (
            <a key={w.id} href={`#${w.id}`} className="link">
              {i + 1}. {w.title}
            </a>
          ))}
          <a href="#screenshots" className="link">
            Screenshots
          </a>
        </nav>
      </PageHeader>

      <div className="space-y-20">
        {WALKTHROUGHS.map((w, i) => (
          <WalkthroughSection key={w.id} walkthrough={w} index={i} />
        ))}

        <section className="scroll-mt-20" aria-labelledby="screenshots">
          <SectionHeading
            id="screenshots"
            kicker="Screenshots"
            title="Every key feature at a glance"
          >
            <p>
              Captured by the same script, in light mode at 1440 × 900 (the landing page also in
              dark mode) and on a 390 px phone. Select one to enlarge it; the arrow keys step
              through the set.
            </p>
          </SectionHeading>
          <ScreenshotGallery items={SCREENSHOTS} />
        </section>

        <section
          aria-labelledby="how-made"
          className="grid gap-4 rounded-lg border bg-card p-5 sm:p-6 md:grid-cols-[auto_1fr]"
        >
          <Clapperboard className="size-6 text-teal" aria-hidden />
          <div className="space-y-2 text-sm leading-relaxed text-ink-soft">
            <h2 id="how-made" className="font-serif text-xl font-semibold text-foreground">
              How these were made
            </h2>
            <p>
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
                pnpm showcase
              </code>{" "}
              runs{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
                web/e2e/showcase.spec.ts
              </code>{" "}
              in the{" "}
              <a href={site.repo} className="link">
                repository
              </a>{" "}
              on the system Chrome: it plays each journey at a human pace with an on-screen caption
              and cursor, asserts what it shows, and records it at 1280 × 800. ffmpeg then encodes
              the H.264 videos on this page and the GIFs in the README. The captions and the step
              lists here are the same text as the on-screen steps.
            </p>
            <p>
              No real API key is used anywhere in these recordings. Where the AI feature appears,
              the key is a placeholder, every request to the provider is intercepted in the browser,
              and the reply is a labelled mock whose explanation starts with “{MOCK_ANSWER_PREFIX}”
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}

/** "Steps 4 to 7" for a run of consecutive steps, otherwise "Steps 2, 5 and 7". */
function stepRange(steps: readonly number[]) {
  const sorted = [...steps].sort((a, b) => a - b)
  const consecutive = sorted.every((s, i) => i === 0 || s === sorted[i - 1] + 1)
  if (sorted.length > 2 && consecutive) return `Steps ${sorted[0]} to ${sorted.at(-1)}`
  if (sorted.length === 1) return `Step ${sorted[0]}`
  return `Steps ${sorted.slice(0, -1).join(", ")} and ${sorted.at(-1)}`
}

function WalkthroughSection({
  walkthrough: w,
  index,
}: {
  walkthrough: Walkthrough
  index: number
}) {
  const media = walkthroughMedia(w.id)
  const mocked = new Set(w.mockedSteps ?? [])
  const stepsId = `${w.id}-steps`
  return (
    <section className="scroll-mt-20" aria-labelledby={w.id}>
      <SectionHeading
        id={w.id}
        kicker={`Walkthrough ${index + 1} of ${WALKTHROUGHS.length} · ${w.route}`}
        title={w.title}
      >
        <p>{w.summary}</p>
      </SectionHeading>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_330px]">
        <figure className="min-w-0 space-y-3">
          <LazyVideo
            src={media.mp4}
            poster={media.poster}
            captions={media.captions}
            label={`${w.title}: a ${w.steps.length}-step walkthrough with captions`}
            width={1280}
            height={800}
          />
          <figcaption className="flex flex-wrap items-start gap-x-4 gap-y-1 text-xs leading-relaxed text-muted-foreground">
            <span className="min-w-0 flex-1">
              <span className="font-medium text-foreground">Setup:</span> {w.setup}
            </span>
            <a href={media.mp4} className="link">
              Open the MP4
            </a>
          </figcaption>
          {mocked.size > 0 ? (
            <Callout title={`${MOCK_LABEL}.`} tone="caution">
              {stepRange([...mocked])} use a placeholder key. Requests to the provider are
              intercepted in the browser and answered by a mock, so no model was called: the reply
              shows how the feature labels, shows, runs and logs a drafted query, not what a real
              model would write.
            </Callout>
          ) : null}
        </figure>

        <div className="space-y-4">
          <h3 id={stepsId} className="font-serif text-lg font-semibold">
            Steps{" "}
            <span className="font-sans text-sm font-normal text-muted-foreground">
              (transcript)
            </span>
          </h3>
          <ol aria-labelledby={stepsId} className="space-y-2.5">
            {w.steps.map((step, k) => (
              <li key={step} className="flex gap-3 text-sm leading-relaxed">
                <span className="tabular flex h-6 min-w-6 shrink-0 items-center justify-center rounded bg-teal-soft px-1 text-xs font-semibold text-teal">
                  {k + 1}
                </span>
                <span>
                  {step}
                  {mocked.has(k + 1) ? (
                    <span className="block text-xs text-ochre-ink">{MOCK_LABEL}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
          <Link href={w.route} className={cn(buttonVariants({ variant: "outline" }), "gap-2")}>
            Try it yourself <ArrowRight aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  )
}
