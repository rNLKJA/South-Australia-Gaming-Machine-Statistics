"use client"

import { Download, Loader2, Play, Square, Trash2 } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { AiSettingsDialog } from "@/components/ai/ai-settings-dialog"
import { AiLabel } from "@/components/common/ai-label"
import { ScrollRegion } from "@/components/common/scroll-region"
import { Segmented } from "@/components/common/segmented"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAiSettings } from "@/hooks/use-ai-settings"
import { auditStore } from "@/lib/ai/audit-log"
import { runAudited } from "@/lib/ai/client"
import { AiError } from "@/lib/ai/errors"
import { activeModel, estimateCostUsd, PROVIDER_LABEL } from "@/lib/ai/models"
import { buildSqlRequest, SQL_EVAL_FEATURE, SqlAnswerSchema } from "@/lib/ai/sql-assistant"
import {
  CATEGORY_LABEL,
  compareRuns,
  GOLD_QUESTIONS,
  OUTCOME_LABEL,
  runToRows,
  scoreAttempt,
  summariseRun,
  type EvalItemResult,
  type EvalRun,
  type ResultTable,
} from "@/lib/ai/sql-eval"
import { toCsv } from "@/lib/csv"
import { downloadText } from "@/lib/download-blob"
import { fmtPct, signed } from "@/lib/format"
import { createBrowserEngine, type SqlEngine } from "@/lib/sql/browser"
import type { PromptVariant, SchemaTable } from "@/lib/sql/schema"
import { DEFAULT_SEED } from "@/lib/stats/rng"

const RUNS_KEY = "sa-gaming-eval-runs"
const MAX_RUNS = 12
/** Rough per-question token use for the cost preview (measured runs report the real figures). */
const EST_INPUT = 2800
const EST_OUTPUT = 350

function loadRuns(): EvalRun[] {
  try {
    const raw = window.localStorage.getItem(RUNS_KEY)
    return raw ? (JSON.parse(raw) as EvalRun[]) : []
  } catch {
    return []
  }
}

function saveRuns(runs: EvalRun[]) {
  try {
    window.localStorage.setItem(RUNS_KEY, JSON.stringify(runs.slice(0, MAX_RUNS)))
  } catch {
    // storage full or unavailable: runs stay in memory for this visit
  }
}

function nowIso(): string {
  return new Date().toISOString()
}

function newRun(provider: string, model: string, variant: PromptVariant, repeats: number): EvalRun {
  return {
    id: `run-${Date.now().toString(36)}`,
    startedAt: nowIso(),
    finishedAt: null,
    provider,
    model,
    variant,
    items: [],
    seed: DEFAULT_SEED,
    repeats,
  }
}

type Repeats = "1" | "3"

const pct = (x: number) => fmtPct(x, 0)
const ci = (a: { estimate: number; lower: number; upper: number }) =>
  `${pct(a.estimate)} (${pct(a.lower)}–${pct(a.upper)})`
/** A pass count: whole with one repeat, one decimal when it is a sum of pass rates. */
const passes = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(1))
/** Percentage points with a typographic minus: "−17". */
const points = (x: number) => signed(x * 100, (v) => v.toFixed(0))

export function EvalHarness({ schema }: { schema: SchemaTable[] }) {
  const { settings, hasKey, keyFor } = useAiSettings()
  const [variant, setVariant] = useState<PromptVariant>("described")
  const [repeatChoice, setRepeatChoice] = useState<Repeats>("1")
  const [runs, setRuns] = useState<EvalRun[]>([])
  const [current, setCurrent] = useState<EvalRun | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pair, setPair] = useState<[string, string] | null>(null)
  const stop = useRef(false)
  const engine = useRef<SqlEngine | null>(null)
  const references = useRef(new Map<string, ResultTable>())

  useEffect(() => {
    engine.current = createBrowserEngine(schema.map((t) => t.name))
    // read saved runs after mount (localStorage is not available during prerendering)
    const saved = loadRuns()
    queueMicrotask(() => setRuns(saved))
  }, [schema])

  const model = activeModel(settings)
  const n = GOLD_QUESTIONS.length
  const k = Number(repeatChoice)
  const requests = n * k
  const estimate = estimateCostUsd(model, requests * EST_INPUT, requests * EST_OUTPUT)

  const runSql = async (sql: string): Promise<ResultTable> => {
    const r = await engine.current!.query(sql)
    return { columns: r.columns, rows: r.rows }
  }

  const start = async () => {
    setConfirming(false)
    setError(null)
    stop.current = false
    const key = keyFor(settings.provider)
    const base = newRun(settings.provider, model, variant, k)
    let items: EvalItemResult[] = []
    setCurrent(base)
    const plan = Array.from({ length: k }, (_, repeat) =>
      GOLD_QUESTIONS.map((q) => ({ q, repeat }))
    ).flat()
    for (const { q, repeat } of plan) {
      if (stop.current) break
      if (q.sql && !references.current.has(q.id)) {
        references.current.set(q.id, await runSql(q.sql))
      }
      let item: EvalItemResult
      try {
        const { result, entry } = await runAudited(
          auditStore(),
          SQL_EVAL_FEATURE,
          { question_id: q.id, question: q.question, prompt_variant: variant, repeat: repeat + 1 },
          settings,
          key,
          buildSqlRequest(q.question, schema, variant),
          SqlAnswerSchema,
          { decision: "not_applicable" }
        )
        const scored = await scoreAttempt(
          q,
          { answer: result.output },
          runSql,
          references.current.get(q.id) ?? null
        )
        item = {
          id: q.id,
          category: q.category,
          ...scored,
          sql: result.output.answerable ? result.output.sql : null,
          latencyMs: result.latencyMs,
          inputTokens: result.usage?.inputTokens ?? null,
          outputTokens: result.usage?.outputTokens ?? null,
          cachedInputTokens: result.usage?.cachedInputTokens ?? null,
          auditId: entry.id,
          answeredBy: result.model,
          repeat,
        }
      } catch (e) {
        const err = e instanceof AiError ? e : new AiError("unknown")
        if (err.kind === "no_key" || err.kind === "invalid_key") {
          setError(err.message)
          break
        }
        const scored = await scoreAttempt(
          q,
          { answer: null, errorKind: err.kind, errorDetail: err.detail ?? err.message },
          runSql,
          null
        )
        item = {
          id: q.id,
          category: q.category,
          ...scored,
          sql: null,
          latencyMs: null,
          inputTokens: err.usage?.inputTokens ?? null,
          outputTokens: err.usage?.outputTokens ?? null,
          cachedInputTokens: err.usage?.cachedInputTokens ?? null,
          auditId: null,
          answeredBy: err.model,
          repeat,
        }
      }
      items = [...items, item]
      setCurrent({ ...base, items })
    }
    setCurrent(null)
    if (items.length) {
      // a stopped run keeps only the repeats it started
      const run: EvalRun = {
        ...base,
        items,
        finishedAt: nowIso(),
        repeats: Math.max(...items.map((i) => (i.repeat ?? 0) + 1)),
      }
      const next = [run, ...runs].slice(0, MAX_RUNS)
      setRuns(next)
      saveRuns(next)
    }
  }

  const shown = current ?? runs[0] ?? null
  const summary = useMemo(() => (shown ? summariseRun(shown.items) : null), [shown])
  const comparison = useMemo(() => {
    if (!pair) return null
    const a = runs.find((r) => r.id === pair[0])
    const b = runs.find((r) => r.id === pair[1])
    if (!a || !b || a.id === b.id) return null
    return { a, b, c: compareRuns(a.items, b.items, DEFAULT_SEED) }
  }, [pair, runs])

  const exportJson = () =>
    downloadText(
      "text-to-sql-evaluation.json",
      JSON.stringify(
        {
          exported_at: new Date().toISOString(),
          questions: GOLD_QUESTIONS,
          runs: runs.map((r) => ({ ...r, summary: summariseRun(r.items) })),
        },
        null,
        2
      ),
      "application/json"
    )
  const exportCsv = () => {
    const rows = runs.flatMap(runToRows)
    if (!rows.length) return
    const headers = Object.keys(rows[0]) as (keyof (typeof rows)[number])[]
    downloadText(
      "text-to-sql-evaluation.csv",
      toCsv(
        headers.map((h) => ({ header: h, value: (r: (typeof rows)[number]) => r[h] })),
        rows
      ),
      "text/csv;charset=utf-8"
    )
  }

  return (
    <div className="space-y-10">
      <section aria-labelledby="run" className="rounded-lg border bg-card p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="run" className="font-serif text-xl font-semibold">
              Run the evaluation
            </h2>
            <p className="mt-1 max-w-[65ch] text-sm text-muted-foreground">
              {n} questions, one request each per repeat, to {PROVIDER_LABEL[settings.provider]} (
              {model}) with your key. Results stay in this browser; every call is in the AI log.
            </p>
          </div>
          <AiSettingsDialog />
        </div>
        <div className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-4">
          <Segmented
            label="Prompt"
            value={variant}
            onChange={setVariant}
            options={[
              { value: "described", label: "Described schema" },
              { value: "bare", label: "Bare schema (ablation)" },
            ]}
          />
          <Segmented
            label="Repeats"
            value={repeatChoice}
            onChange={setRepeatChoice}
            options={[
              { value: "1", label: "Once" },
              { value: "3", label: "3 times" },
            ]}
          />
          {current ? (
            <Button variant="outline" onClick={() => (stop.current = true)}>
              <Square aria-hidden />
              Stop after this question
            </Button>
          ) : confirming ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={start}>
                <Play aria-hidden />
                Start {requests} requests
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button onClick={() => setConfirming(true)} disabled={!hasKey}>
              <Play aria-hidden />
              Run evaluation
            </Button>
          )}
        </div>
        {confirming ? (
          <p className="mt-3 text-sm text-ink-soft">
            This sends {requests} requests with your key.{" "}
            {estimate != null
              ? `At list prices that is roughly US$${estimate.toFixed(2)} (an estimate from about ${EST_INPUT.toLocaleString("en-AU")} input and ${EST_OUTPUT} output tokens per question; prompt caching usually makes it less).`
              : "The cost depends on the model you chose."}
          </p>
        ) : null}
        {!hasKey ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No results are published here: the site has no AI budget, so the harness runs only with
            a visitor’s own key. Add one in AI settings to run it.
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {current ? (
          <p role="status" className="mt-3 flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {(current.repeats ?? 1) > 1
              ? `Repeat ${Math.min(Math.floor(current.items.length / n) + 1, current.repeats ?? 1)} of ${current.repeats}, question ${(current.items.length % n) + 1} of ${n}…`
              : `Question ${Math.min(current.items.length + 1, n)} of ${n}…`}
          </p>
        ) : null}
      </section>

      {shown && summary ? (
        <section aria-labelledby="results" className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="results" className="font-serif text-2xl font-semibold">
              {current ? "Current run" : "Latest run"}
            </h2>
            <AiLabel
              kind="assisted"
              detail={`${PROVIDER_LABEL[shown.provider as "anthropic" | "openai"] ?? shown.provider}, ${shown.model}, ${shown.variant} prompt`}
            />
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
            <Metric
              label="Execution accuracy"
              value={ci(summary.lenient)}
              detail={
                summary.repeats > 1
                  ? `mean pass rate over ${summary.n} questions × ${summary.repeats} repeats; bootstrap 95% CI over questions`
                  : `${summary.lenient.passes} of ${summary.n} questions; Wilson 95% CI`
              }
            />
            <Metric
              label="Answerable questions"
              value={ci(summary.answerable)}
              detail={`${passes(summary.answerable.passes)} of ${summary.answerable.n}`}
            />
            <Metric
              label="Declined when it should"
              value={`${passes(summary.abstention.passes)} of ${summary.abstention.n}`}
              detail={`${passes(summary.abstentionUnprompted.passes)} of ${summary.abstentionUnprompted.n} where the prompt doesn’t state the scope`}
            />
            <Metric
              label="Tokens"
              value={`${summary.inputTokens.toLocaleString("en-AU")} in · ${summary.outputTokens.toLocaleString("en-AU")} out`}
              detail={`median latency ${summary.medianLatencyMs != null ? Math.round(summary.medianLatencyMs) : "–"} ms${
                estimateCostUsd(
                  shown.model,
                  summary.inputTokens,
                  summary.outputTokens,
                  summary.cachedInputTokens
                ) != null
                  ? `; about US$${estimateCostUsd(shown.model, summary.inputTokens, summary.outputTokens, summary.cachedInputTokens)!.toFixed(3)}`
                  : ""
              }`}
            />
          </dl>
          {summary.spread ? (
            <p className="max-w-[75ch] text-sm leading-relaxed text-ink-soft">
              <strong className="text-foreground">Run-to-run spread.</strong> Accuracy by repeat:{" "}
              {summary.spread.perRepeat.map(pct).join(", ")} (range {pct(summary.spread.min)} to{" "}
              {pct(summary.spread.max)}). {summary.spread.mixed} of {summary.n} questions passed in
              some repeats and failed in others; their pass rates sit between 0 and 1 in the figures
              above.
            </p>
          ) : null}
          <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead scope="col">Category</TableHead>
                    <TableHead scope="col" className="text-right">
                      Passed
                    </TableHead>
                    <TableHead scope="col" className="text-right">
                      Accuracy (95% CI)
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.byCategory.map((c) => (
                    <TableRow key={c.category}>
                      <TableHead scope="row" className="font-medium">
                        {CATEGORY_LABEL[c.category]}
                      </TableHead>
                      <TableCell className="tabular text-right">
                        {passes(c.passes)} / {c.n}
                      </TableCell>
                      <TableCell className="tabular text-right">{c.n ? ci(c.ci) : "–"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="border-t px-4 py-3 text-xs text-muted-foreground">
                Outcomes:{" "}
                {Object.entries(summary.outcomes)
                  .filter(([, v]) => v > 0)
                  .map(([o, v]) => `${OUTCOME_LABEL[o as keyof typeof OUTCOME_LABEL]} ${v}`)
                  .join(" · ")}
                {summary.repeats > 1 ? ` (${summary.attempts} attempts)` : ""}. Strict accuracy (no
                extra columns): {ci(summary.strict)}.
              </p>
            </div>
            <ScrollRegion className="max-h-[30rem] overflow-auto rounded-lg border bg-card">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow className="hover:bg-transparent">
                    <TableHead scope="col">Question</TableHead>
                    <TableHead scope="col">Outcome</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {GOLD_QUESTIONS.filter((g) => shown.items.some((i) => i.id === g.id)).map((q) => {
                    const tries = shown.items
                      .filter((i) => i.id === q.id)
                      .sort((a, b) => (a.repeat ?? 0) - (b.repeat ?? 0))
                    const first = tries[0]
                    const passed = tries.filter((i) => i.lenient).length
                    const failed = tries.find((i) => !i.lenient)
                    return (
                      <TableRow key={q.id}>
                        <TableCell className="align-top whitespace-normal">
                          <span className="tabular mr-1.5 text-xs text-muted-foreground">
                            {q.id}
                          </span>
                          {q.question}
                          {first.sql ? (
                            <details className="mt-1">
                              <summary className="cursor-pointer text-xs text-muted-foreground">
                                Model’s SQL{tries.length > 1 ? " (first repeat)" : ""}
                              </summary>
                              <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 font-mono text-xs whitespace-pre-wrap">
                                {first.sql}
                              </pre>
                            </details>
                          ) : null}
                        </TableCell>
                        <TableCell className="align-top whitespace-normal">
                          <span
                            className={
                              passed === tries.length
                                ? "font-medium text-teal"
                                : "font-medium text-terracotta"
                            }
                          >
                            {tries.length > 1
                              ? `Passed ${passed} of ${tries.length}`
                              : OUTCOME_LABEL[first.outcome]}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {tries.length > 1
                              ? tries.map((i) => OUTCOME_LABEL[i.outcome]).join(" · ")
                              : first.detail}
                            {tries.length > 1 && failed
                              ? `; repeat ${(failed.repeat ?? 0) + 1}: ${failed.detail}`
                              : ""}
                          </span>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </ScrollRegion>
          </div>
        </section>
      ) : null}

      {runs.length ? (
        <section aria-labelledby="runs" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="runs" className="font-serif text-2xl font-semibold">
              Saved runs ({runs.length})
            </h2>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={exportCsv}>
                <Download aria-hidden />
                CSV
              </Button>
              <Button variant="outline" size="sm" onClick={exportJson}>
                <Download aria-hidden />
                JSON
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setRuns([])
                  saveRuns([])
                  setPair(null)
                }}
              >
                <Trash2 aria-hidden />
                Clear runs
              </Button>
            </div>
          </div>
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead scope="col">Started</TableHead>
                  <TableHead scope="col">Model</TableHead>
                  <TableHead scope="col">Prompt</TableHead>
                  <TableHead scope="col" className="text-right">
                    Accuracy (95% CI)
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((r) => {
                  const s = summariseRun(r.items)
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="tabular">
                        {new Date(r.startedAt).toLocaleString("en-AU")}
                      </TableCell>
                      <TableCell>{r.model}</TableCell>
                      <TableCell>{r.variant}</TableCell>
                      <TableCell className="tabular text-right">
                        {ci(s.lenient)} · n = {s.n}
                        {s.repeats > 1 ? ` × ${s.repeats}` : ""}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          {runs.length >= 2 ? (
            <div className="rounded-lg border bg-card p-4 sm:p-6">
              <h3 className="font-serif text-lg font-semibold">Compare two runs</h3>
              <p className="mt-1 max-w-[70ch] text-sm text-muted-foreground">
                Paired on the same questions: a bootstrap interval for the difference in accuracy (
                {(4000).toLocaleString("en-AU")} resamples of questions, seed {DEFAULT_SEED}), and,
                for two single runs, McNemar’s exact test on the questions only one run got right.
                With repeats, each question’s pass rate is averaged over its repeats first, so
                run-to-run noise is not mistaken for a difference between configurations.
              </p>
              <div className="mt-4 flex flex-wrap gap-4">
                {(["A", "B"] as const).map((label, k) => (
                  <label key={label} className="flex flex-col gap-1.5 text-sm">
                    <span className="kicker text-muted-foreground">Run {label}</span>
                    <select
                      className="h-8 rounded-lg border border-input bg-card px-2 text-sm"
                      value={pair?.[k] ?? ""}
                      onChange={(e) => {
                        const next: [string, string] = pair ?? [runs[0].id, runs[1].id]
                        next[k] = e.target.value
                        setPair([next[0], next[1]])
                      }}
                    >
                      <option value="" disabled>
                        Choose a run
                      </option>
                      {runs.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.model}, {r.variant}
                          {(r.repeats ?? 1) > 1 ? ` ×${r.repeats}` : ""},{" "}
                          {new Date(r.startedAt).toLocaleTimeString("en-AU")}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              {comparison ? (
                <p className="mt-4 text-sm leading-relaxed">
                  {comparison.c.mcnemarP != null ? (
                    <>
                      Both right on {comparison.c.bothPass}, only A on {comparison.c.onlyA}, only B
                      on {comparison.c.onlyB}, neither on {comparison.c.neither} (n ={" "}
                      {comparison.c.n}).{" "}
                    </>
                  ) : (
                    <>
                      {comparison.c.n} questions, pass rates averaged over {comparison.c.repeats[0]}{" "}
                      and {comparison.c.repeats[1]} repeats.{" "}
                    </>
                  )}
                  Accuracy difference A − B:{" "}
                  <strong>
                    {points(comparison.c.difference.estimate)} points (95% CI{" "}
                    {points(comparison.c.difference.lower)} to{" "}
                    {points(comparison.c.difference.upper)})
                  </strong>
                  {comparison.c.mcnemarP != null
                    ? `; McNemar exact p = ${comparison.c.mcnemarP.toFixed(3)}`
                    : ""}
                  . With {comparison.c.n} questions only large differences can be told apart from
                  chance.
                </p>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">Choose two different runs.</p>
              )}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="border-t-2 border-foreground/70 pt-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="tabular mt-1 font-serif text-2xl font-semibold">{value}</dd>
      <dd className="mt-1 text-xs text-muted-foreground">{detail}</dd>
    </div>
  )
}
