"use client"

import { Download, RefreshCw, Trash2 } from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"

import { AiLabel } from "@/components/common/ai-label"
import { Button } from "@/components/ui/button"
import { auditToCsv, auditToJson } from "@/lib/ai/audit-export"
import { AUDIT_EVENT, auditStore } from "@/lib/ai/audit-log"
import type { AuditEntry } from "@/lib/ai/types"
import { downloadText } from "@/lib/download-blob"
import { cn } from "@/lib/utils"

const DECISION_STYLE: Record<AuditEntry["human_decision"], string> = {
  pending: "text-ochre-ink",
  accepted: "text-teal",
  edited: "text-teal",
  rejected: "text-terracotta",
  no_output: "text-muted-foreground",
  not_applicable: "text-muted-foreground",
}

const DECISION_LABEL: Record<AuditEntry["human_decision"], string> = {
  pending: "Pending",
  accepted: "Accepted",
  edited: "Edited, then used",
  rejected: "Rejected",
  no_output: "No output (call failed)",
  not_applicable: "Evaluation run",
}

/** The AI audit log for this browser: every call, its input and output, and the human decision. */
export function AiLog() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null)
  const [feature, setFeature] = useState("all")
  const [confirmClear, setConfirmClear] = useState(false)
  const [unavailable, setUnavailable] = useState(false)

  const load = useCallback(async () => {
    try {
      setEntries(await auditStore().list())
    } catch {
      setUnavailable(true)
      setEntries([])
    }
  }, [])

  useEffect(() => {
    const refresh = () => void load()
    queueMicrotask(refresh)
    window.addEventListener(AUDIT_EVENT, refresh)
    return () => window.removeEventListener(AUDIT_EVENT, refresh)
  }, [load])

  const features = useMemo(
    () => [...new Set((entries ?? []).map((e) => e.feature))].sort(),
    [entries]
  )
  const shown = (entries ?? []).filter((e) => feature === "all" || e.feature === feature)
  // the local date (YYYY-MM-DD), matching the times shown on the entries
  const stamp = () => new Date().toLocaleDateString("en-CA")

  if (entries === null) return <p className="text-sm text-muted-foreground">Loading the log…</p>

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="kicker text-muted-foreground">Feature</span>
          <select
            value={feature}
            onChange={(e) => setFeature(e.target.value)}
            className="h-8 rounded-lg border border-input bg-card px-2 text-base md:text-sm"
          >
            <option value="all">All ({entries.length})</option>
            {features.map((f) => (
              <option key={f} value={f}>
                {f} ({entries.filter((e) => e.feature === f).length})
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw aria-hidden />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!shown.length}
            onClick={() =>
              downloadText(`ai-audit-log-${stamp()}.json`, auditToJson(shown), "application/json")
            }
          >
            <Download aria-hidden />
            JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!shown.length}
            onClick={() =>
              downloadText(
                `ai-audit-log-${stamp()}.csv`,
                auditToCsv(shown),
                "text/csv;charset=utf-8"
              )
            }
          >
            <Download aria-hidden />
            CSV
          </Button>
          {confirmClear ? (
            <>
              <Button
                variant="destructive"
                size="sm"
                onClick={async () => {
                  await auditStore().clear()
                  setConfirmClear(false)
                }}
              >
                Delete every entry
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmClear(false)}>
                Keep
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              disabled={!entries.length}
              onClick={() => setConfirmClear(true)}
            >
              <Trash2 aria-hidden />
              Clear log
            </Button>
          )}
        </div>
      </div>

      {unavailable ? (
        <p className="text-sm text-destructive">
          This browser doesn’t allow IndexedDB here (some private modes block it), so no log can be
          kept.
        </p>
      ) : null}

      {!shown.length ? (
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          No AI calls have been made from this browser yet. When you use{" "}
          <Link href="/ask" className="link">
            Ask the data
          </Link>{" "}
          or run the evaluation with your own key, each call appears here.
        </div>
      ) : (
        <ol className="space-y-3">
          {shown.map((e) => (
            <li key={e.id} className="rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {e.output != null ? (
                    <AiLabel />
                  ) : (
                    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                      AI call, no output
                    </span>
                  )}
                  <span className="font-medium">{e.feature}</span>
                  <span className="text-muted-foreground">
                    {new Date(e.timestamp).toLocaleString("en-AU")}
                  </span>
                </div>
                <span className={cn("text-sm font-semibold", DECISION_STYLE[e.human_decision])}>
                  {DECISION_LABEL[e.human_decision]}
                </span>
              </div>
              <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Provider">{e.provider}</Field>
                <Field label="Model">
                  {e.model}
                  {e.model !== e.requestedModel ? ` (asked for ${e.requestedModel})` : ""}
                </Field>
                <Field label="Latency">{e.latency_ms.toLocaleString("en-AU")} ms</Field>
                <Field label="Tokens">
                  {e.usage
                    ? `${e.usage.inputTokens.toLocaleString("en-AU")} in · ${e.usage.outputTokens.toLocaleString("en-AU")} out`
                    : "not reported"}
                </Field>
              </dl>
              {e.error ? <p className="mt-2 text-sm text-destructive">{e.error}</p> : null}
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-muted-foreground">
                  Input, output and decision history
                </summary>
                <div className="mt-2 grid gap-3 lg:grid-cols-2">
                  <Json
                    label="Input (sent to the provider with the schema prompt)"
                    value={e.input}
                  />
                  <Json label="Output" value={e.output} />
                </div>
                {e.decisions.length ? (
                  <ol className="mt-3 space-y-1">
                    {e.decisions.map((d, i) => (
                      <li key={i} className="text-xs text-muted-foreground">
                        {new Date(d.at).toLocaleString("en-AU")}: {DECISION_LABEL[d.decision]}
                        {d.edited_output ? ` → ${JSON.stringify(d.edited_output)}` : ""}
                      </li>
                    ))}
                  </ol>
                ) : null}
                <p className="mt-2 font-mono text-xs text-muted-foreground">id {e.id}</p>
              </details>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="tabular">{children}</dd>
    </div>
  )
}

function Json({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      <pre className="max-h-64 overflow-auto rounded bg-muted p-2 font-mono text-xs whitespace-pre-wrap">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  )
}
