"use client"

import { Download, Loader2, Play, Sparkles, X } from "lucide-react"
import Link from "next/link"
import { useEffect, useId, useRef, useState } from "react"

import { AiSettingsDialog } from "@/components/ai/ai-settings-dialog"
import { AiLabel } from "@/components/common/ai-label"
import { Button } from "@/components/ui/button"
import { useAiSettings } from "@/hooks/use-ai-settings"
import { auditStore } from "@/lib/ai/audit-log"
import { runAudited } from "@/lib/ai/client"
import {
  decisionForRun,
  discardDraft,
  isRepeat,
  sourceAfterDraft,
  sqlOrigin,
  type LoggedDecision,
  type SqlOrigin,
  type SqlSource,
} from "@/lib/ai/draft-tracking"
import { AiError } from "@/lib/ai/errors"
import { activeModel, PROVIDER_LABEL } from "@/lib/ai/models"
import {
  buildSqlRequest,
  MAX_QUESTION_LENGTH,
  SQL_FEATURE,
  SqlAnswerSchema,
  type SqlAnswer,
} from "@/lib/ai/sql-assistant"
import type { HumanDecision } from "@/lib/ai/types"
import { toCsv } from "@/lib/csv"
import { downloadText } from "@/lib/download-blob"
import {
  createBrowserEngine,
  MAX_ROWS,
  SqlError,
  type QueryResult,
  type SqlEngine,
} from "@/lib/sql/browser"
import type { SchemaTable } from "@/lib/sql/schema"

import { ResultsTable } from "./results-table"

interface Draft {
  question: string
  answer: SqlAnswer
  auditId: string
  model: string
  provider: string
  latencyMs: number
}

const STARTER_SQL = `SELECT financial_year, ngr_aud_million, gaming_tax_aud_million
FROM statewide_annual
ORDER BY financial_year`

/**
 * Ask the data: write SQL yourself, or (with your own key) let a model draft it. Either way the
 * query is shown, checked against the allow-list and run read-only in this browser. Where the
 * editor's SQL came from is tracked separately from the draft card (lib/ai/draft-tracking), so a
 * result is labelled whenever a model wrote or seeded the query that produced it, and every run of
 * a drafted query is recorded in the AI log with the exact SQL that ran.
 */
export function AskData({ schema, examples }: { schema: SchemaTable[]; examples: string[] }) {
  const { settings, hasKey, keyFor } = useAiSettings()
  const [question, setQuestion] = useState("")
  const [sql, setSql] = useState(STARTER_SQL)
  const [draft, setDraft] = useState<Draft | null>(null)
  /** The model draft the editor's SQL came from (it outlives the draft card). */
  const [source, setSource] = useState<SqlSource | null>(null)
  /** Latest decision per audit entry, for display. */
  const [decisions, setDecisions] = useState<Record<string, HumanDecision>>({})
  const [drafting, setDrafting] = useState(false)
  const [running, setRunning] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [sqlError, setSqlError] = useState<string | null>(null)
  const [result, setResult] = useState<
    (QueryResult & { origin: SqlOrigin; model: string | null }) | null
  >(null)
  const engine = useRef<SqlEngine | null>(null)
  /** The last decision appended per audit entry, so only exact repeats are skipped. */
  const logged = useRef(new Map<string, LoggedDecision>())
  const ids = { q: useId(), sql: useId() }

  useEffect(() => {
    engine.current = createBrowserEngine(schema.map((t) => t.name))
  }, [schema])

  const record = async (auditId: string, next: LoggedDecision) => {
    if (isRepeat(next, logged.current.get(auditId))) return
    logged.current.set(auditId, next)
    setDecisions((m) => ({ ...m, [auditId]: next.decision }))
    await auditStore().setDecision(
      auditId,
      next.decision,
      next.decision === "edited" ? { sql: next.sql } : undefined
    )
  }

  const draftSql = async () => {
    const q = question.trim()
    if (!q) return
    setAiError(null)
    setDrafting(true)
    try {
      const { result: r, entry } = await runAudited(
        auditStore(),
        SQL_FEATURE,
        { question: q, prompt_variant: "described", tables: schema.map((t) => t.name) },
        settings,
        keyFor(settings.provider),
        buildSqlRequest(q, schema, "described"),
        SqlAnswerSchema
      )
      setDraft({
        question: q,
        answer: r.output,
        auditId: entry.id,
        model: r.model,
        provider: PROVIDER_LABEL[r.provider],
        latencyMs: r.latencyMs,
      })
      setDecisions((m) => ({ ...m, [entry.id]: "pending" }))
      setResult(null)
      setSqlError(null)
      const next = sourceAfterDraft(source, sql, {
        auditId: entry.id,
        model: r.model,
        answerable: r.output.answerable,
        sql: r.output.sql,
      })
      setSource(next)
      if (r.output.answerable) setSql(r.output.sql.trim())
    } catch (e) {
      const err = e instanceof AiError ? e : null
      setAiError(
        err ? `${err.message}${err.detail ? ` (${err.detail})` : ""}` : "The request failed."
      )
    } finally {
      setDrafting(false)
    }
  }

  const run = async () => {
    if (!engine.current) return
    setRunning(true)
    setSqlError(null)
    const src = source
    const origin = sqlOrigin(src, sql)
    try {
      const r = await engine.current.query(sql)
      setResult({ ...r, origin, model: src?.model ?? null })
      if (src) {
        const next = decisionForRun(origin, sql, logged.current.get(src.auditId))
        if (next) await record(src.auditId, next)
      }
    } catch (e) {
      setResult(null)
      setSqlError(
        e instanceof SqlError
          ? `${e.kind === "rejected" ? "Not run: " : ""}${e.message}`
          : "The query failed."
      )
    } finally {
      setRunning(false)
    }
  }

  /** Reject a model draft: log it and, if its SQL is in the editor, put back the pre-draft SQL. */
  const discard = async (auditId: string) => {
    await record(auditId, { decision: "rejected", sql: null })
    const after = discardDraft(source, auditId, sql)
    setSource(after.source)
    setSql(after.sql)
    if (after.sql !== sql) setResult(null)
    if (draft?.auditId === auditId) setDraft(null)
  }

  const exportCsv = () => {
    if (!result) return
    const csv = toCsv(
      result.columns.map((header, j) => ({
        header,
        value: (r: (typeof result.rows)[number]) => r[j],
      })),
      result.rows
    )
    downloadText("query-result.csv", csv, "text/csv;charset=utf-8")
  }

  const model = activeModel(settings)

  return (
    <div className="space-y-8">
      <section aria-labelledby="ask-ai" className="rounded-lg border bg-card p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="ask-ai" className="flex items-center gap-2 font-serif text-xl font-semibold">
              <Sparkles className="size-4 text-ochre" aria-hidden />
              Draft a query from a question
            </h2>
            <p className="mt-1 max-w-[62ch] text-sm text-muted-foreground">
              Optional. With your own key, {PROVIDER_LABEL[settings.provider]} ({model}) drafts the
              SQL; you see it, can edit it, and decide whether to run it.
            </p>
          </div>
          <AiSettingsDialog />
        </div>
        <label htmlFor={ids.q} className="sr-only">
          Your question
        </label>
        <textarea
          id={ids.q}
          value={question}
          maxLength={MAX_QUESTION_LENGTH}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void draftSql()
          }}
          rows={3}
          placeholder="For example: which council areas had more than 500 machines in FY 2024-25?"
          className="mt-4 w-full rounded-lg border border-input bg-background px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {examples.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setQuestion(ex)}
              className="rounded-full border bg-background px-3 py-1 text-left text-xs text-ink-soft hover:border-foreground/40 hover:text-foreground"
            >
              {ex}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={draftSql} disabled={!hasKey || drafting || !question.trim()}>
            {drafting ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
            {drafting ? "Drafting…" : "Draft SQL"}
          </Button>
          {!hasKey ? (
            <p className="text-sm text-muted-foreground">
              Add a key in AI settings to use this. Without one, write SQL below: everything else
              works.
            </p>
          ) : null}
        </div>
        {aiError ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {aiError}
          </p>
        ) : null}

        {draft ? (
          <div className="mt-5 rounded-lg border border-ochre/40 bg-ochre-soft/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <AiLabel detail={`${draft.provider}, ${draft.model}, ${draft.latencyMs} ms`} />
              <Button variant="ghost" size="sm" onClick={() => discard(draft.auditId)}>
                <X aria-hidden />
                Discard draft
              </Button>
            </div>
            <p className="mt-3 text-sm">
              <span className="text-muted-foreground">Question: </span>
              {draft.question}
            </p>
            {draft.answer.answerable ? (
              <p className="mt-2 text-sm leading-relaxed">{draft.answer.explanation}</p>
            ) : (
              <p className="mt-2 text-sm leading-relaxed">
                <strong>The model says these tables can’t answer this.</strong>{" "}
                {draft.answer.explanation}
              </p>
            )}
            {draft.answer.assumptions.length ? (
              <div className="mt-2 text-sm">
                <p className="text-muted-foreground">Assumptions it made:</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  {draft.answer.assumptions.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="mt-3 text-xs text-muted-foreground">
              {draft.answer.answerable ? "Check the query below before running it. " : ""}
              Decision so far: <strong>{decisions[draft.auditId] ?? "pending"}</strong> (recorded in
              the{" "}
              <Link href="/ai-log" className="link">
                AI log
              </Link>
              ).
            </p>
            {!draft.answer.answerable ? (
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => record(draft.auditId, { decision: "accepted", sql: null })}
              >
                Accept this answer
              </Button>
            ) : null}
          </div>
        ) : null}
      </section>

      <section aria-labelledby="sql-editor" className="rounded-lg border bg-card p-4 sm:p-6">
        <h2 id="sql-editor" className="font-serif text-xl font-semibold">
          SQL
        </h2>
        <p className="mt-1 max-w-[70ch] text-sm text-muted-foreground">
          One SELECT (or WITH) query over the eight tables listed below. It runs in your browser on
          a read-only copy of the data; at most {MAX_ROWS} rows come back.
        </p>
        {source ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {sqlOrigin(source, sql) === "ai" ? (
              <AiLabel detail={`query drafted by ${source.model}; check it before running`} />
            ) : (
              <AiLabel detail={`edited by you from ${source.model}’s draft`} />
            )}
            {draft?.auditId !== source.auditId ? (
              <Button variant="ghost" size="sm" onClick={() => discard(source.auditId)}>
                <X aria-hidden />
                Discard the model’s query
              </Button>
            ) : null}
          </div>
        ) : null}
        <label htmlFor={ids.sql} className="sr-only">
          SQL query
        </label>
        <textarea
          id={ids.sql}
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void run()
          }}
          rows={7}
          spellCheck={false}
          className="mt-4 w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-[13px] leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button onClick={run} disabled={running || !sql.trim()}>
            {running ? <Loader2 className="animate-spin" aria-hidden /> : <Play aria-hidden />}
            {running ? "Running…" : "Run query"}
          </Button>
          <span className="text-xs text-muted-foreground">Ctrl or ⌘ + Enter runs the query.</span>
        </div>
        {sqlError ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {sqlError}
          </p>
        ) : null}

        {result ? (
          <div className="mt-6 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {result.origin !== "manual" ? (
                  <AiLabel
                    kind="assisted"
                    detail={
                      result.origin === "ai"
                        ? `query drafted by ${result.model ?? "a model"}, run by you`
                        : `query drafted by ${result.model ?? "a model"}, edited and run by you`
                    }
                  />
                ) : null}
                <span className="text-muted-foreground">
                  {result.rows.length.toLocaleString("en-AU")} row
                  {result.rows.length === 1 ? "" : "s"} · {result.ms} ms
                </span>
              </div>
              <Button variant="outline" size="sm" onClick={exportCsv}>
                <Download aria-hidden />
                CSV
              </Button>
            </div>
            {result.truncated ? (
              <p role="status" className="text-sm text-ink-soft">
                Showing the first {MAX_ROWS} rows; the query matched more. Add a LIMIT or a filter
                to see the rest.
              </p>
            ) : null}
            <ResultsTable result={result} />
          </div>
        ) : null}
      </section>
    </div>
  )
}
