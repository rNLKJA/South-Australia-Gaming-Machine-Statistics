"use client"

import { Download, Loader2, Play, Square, Trash2 } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { AiSettingsDialog } from "@/components/ai/ai-settings-dialog"
import { AiLabel } from "@/components/common/ai-label"
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
import { fmtPct } from "@/lib/format"
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

function newRun(provider: string, model: string, variant: PromptVariant): EvalRun {
  return {
    id: `run-${Date.now().toString(36)}`,
    startedAt: nowIso(),
    finishedAt: null,
    provider,
    model,
    variant,
    items: [],
    seed: DEFAULT_SEED,
  }
}

const pct = (x: number) => fmtPct(x, 0)
const ci = (a: { estimate: number; lower: number; upper: number }) =>
  `${pct(a.estimate)} (${pct(a.lower)}–${pct(a.upper)})`

export function EvalHarness({ schema }: { schema: SchemaTable[] }) {
  const { settings, hasKey, keyFor } = useAiSettings()
  const [variant, setVariant] = useState<PromptVariant>("described")
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
  const estimate = estimateCostUsd(model, n * EST_INPUT, n * EST_OUTPUT)

  const runSql = async (sql: string): Promise<ResultTable> => {
    const r = await engine.current!.query(sql)
    return { columns: r.columns, rows: r.rows }
  }

  const start = async () => {
    setConfirming(false)
    setError(null)
    stop.current = false
    const key = keyFor(settings.provider)
    const base = newRun(settings.provider, model, variant)
    let items: EvalItemResult[] = []
    setCurrent(base)
    for (const q of GOLD_QUESTIONS) {
      if (stop.current) break
      if (q.sql && !references.current.has(q.id)) {
        references.current.set(q.id, await runSql(q.sql))
      }
      let item: EvalItemResult
      try {
        const { result, entry } = await runAudited(
          auditStore(),
          SQL_EVAL_FEATURE,
          { question_id: q.id, question: q.question, prompt_variant: variant },
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
        }
      }
      items = [...items, item]
      setCurrent({ ...base, items })
    }
    setCurrent(null)
    if (items.length) {
      const run: EvalRun = { ...base, items, finishedAt: nowIso() }
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
              {n} questions, one request each, to {PROVIDER_LABEL[settings.provider]} ({model}) with
              your key. Results stay in this browser; every call is in the AI log.
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
          {current ? (
            <Button variant="outline" onClick={() => (stop.current = true)}>
              <Square aria-hidden />
              Stop after this question
            </Button>
          ) : confirming ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={start}>
                <Play aria-hidden />
                Start {n} requests
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
            This sends {n} requests with your key.{" "}
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
            Question {Math.min(current.items.length + 1, n)} of {n}…
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
              detail={`${summary.lenient.passes} of ${summary.n} questions; Wilson 95% CI`}
            />
            <Metric
              label="Answerable questions"
              value={ci(summary.answerable)}
              detail={`${summary.answerable.passes} of ${summary.answerable.n}`}
            />
            <Metric
              label="Declined when it should"
              value={`${summary.abstention.passes} of ${summary.abstention.n}`}
              detail="Questions the tables can’t answer"
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
                        {c.passes} / {c.n}
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
                  .map(([k, v]) => `${OUTCOME_LABEL[k as keyof typeof OUTCOME_LABEL]} ${v}`)
                  .join(" · ")}
                . Strict accuracy (no extra columns): {ci(summary.strict)}.
              </p>
            </div>
            <div className="max-h-[30rem] overflow-auto rounded-lg border bg-card">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow className="hover:bg-transparent">
                    <TableHead scope="col">Question</TableHead>
                    <TableHead scope="col">Outcome</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shown.items.map((i) => {
                    const q = GOLD_QUESTIONS.find((g) => g.id === i.id)!
                    return (
                      <TableRow key={i.id}>
                        <TableCell className="align-top whitespace-normal">
                          <span className="tabular mr-1.5 text-xs text-muted-foreground">
                            {i.id}
                          </span>
                          {q.question}
                          {i.sql ? (
                            <details className="mt-1">
                              <summary className="cursor-pointer text-xs text-muted-foreground">
                                Model’s SQL
                              </summary>
                              <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 font-mono text-xs whitespace-pre-wrap">
                                {i.sql}
                              </pre>
                            </details>
                          ) : null}
                        </TableCell>
                        <TableCell className="align-top whitespace-normal">
                          <span
                            className={
                              i.lenient ? "font-medium text-teal" : "font-medium text-terracotta"
                            }
                          >
                            {OUTCOME_LABEL[i.outcome]}
                          </span>
                          <span className="block text-xs text-muted-foreground">{i.detail}</span>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
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
                Paired on the same questions: McNemar’s exact test on the questions only one run got
                right, and a bootstrap interval for the difference in accuracy (
                {(4000).toLocaleString("en-AU")} resamples of questions, seed {DEFAULT_SEED}).
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
                          {r.model}, {r.variant},{" "}
                          {new Date(r.startedAt).toLocaleTimeString("en-AU")}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              {comparison ? (
                <p className="mt-4 text-sm leading-relaxed">
                  Both right on {comparison.c.bothPass}, only A on {comparison.c.onlyA}, only B on{" "}
                  {comparison.c.onlyB}, neither on {comparison.c.neither} (n = {comparison.c.n}).
                  Accuracy difference A − B:{" "}
                  <strong>
                    {(comparison.c.difference.estimate * 100).toFixed(0)} points (95% CI{" "}
                    {(comparison.c.difference.lower * 100).toFixed(0)} to{" "}
                    {(comparison.c.difference.upper * 100).toFixed(0)})
                  </strong>
                  ; McNemar exact p = {comparison.c.mcnemarP.toFixed(3)}. With {comparison.c.n}{" "}
                  questions only large differences can be told apart from chance.
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
