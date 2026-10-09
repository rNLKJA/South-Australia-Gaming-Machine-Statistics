import { toCsv } from "../csv"
import type { AuditEntry } from "./types"

export const AUDIT_CSV_COLUMNS = [
  "id",
  "timestamp",
  "feature",
  "provider",
  "model",
  "requested_model",
  "latency_ms",
  "input_tokens",
  "output_tokens",
  "cached_input_tokens",
  "human_decision",
  "decided_at",
  "error",
  "input",
  "output",
  "edited_output",
  "decision_history",
] as const

const json = (v: unknown) => (v === null || v === undefined ? "" : JSON.stringify(v))

/** One flat row per call; structured fields are embedded as JSON text. */
export function auditToCsv(entries: readonly AuditEntry[]): string {
  return toCsv(
    AUDIT_CSV_COLUMNS.map((header) => ({
      header,
      value: (e: AuditEntry) => {
        switch (header) {
          case "requested_model":
            return e.requestedModel
          case "input_tokens":
            return e.usage?.inputTokens ?? null
          case "output_tokens":
            return e.usage?.outputTokens ?? null
          case "cached_input_tokens":
            return e.usage?.cachedInputTokens ?? null
          case "input":
            return json(e.input)
          case "output":
            return json(e.output)
          case "edited_output":
            return json(e.edited_output)
          case "decision_history":
            return json(e.decisions ?? [])
          case "decided_at":
            return e.decided_at ?? ""
          case "error":
            return e.error ?? ""
          default:
            return e[header] as string | number
        }
      },
    })),
    [...entries]
  )
}

export function auditToJson(entries: readonly AuditEntry[]): string {
  return JSON.stringify(
    {
      exported_at: new Date().toISOString(),
      source: "SA Gaming Machine Statistics, AI audit log (this browser only)",
      note: "API keys are never stored in this log.",
      entries,
    },
    null,
    2
  )
}
