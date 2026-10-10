import type { HumanDecision } from "./types"

/**
 * Where the SQL in the "Ask the data" editor came from, kept apart from the draft card on screen.
 * The rules the page follows (and the tests check):
 *
 * - A result is labelled AI-assisted whenever the SQL that ran is a model's draft or an edit of one;
 *   only SQL the visitor wrote without a draft (or restored by discarding the draft) is unlabelled.
 * - Every run of a draft's SQL appends a decision to that draft's audit entry: "accepted" when it ran
 *   unchanged, "edited" with the exact SQL when it ran changed. Repeating the same run adds nothing;
 *   a different edit adds a new "edited" decision, so the log always holds the version that ran.
 * - Discarding a draft records "rejected" and puts back the SQL that was in the editor before the
 *   model's draft, so a rejected query can't then be run without its label.
 */

export interface SqlSource {
  /** The audit-log entry of the draft whose SQL is (or was edited from) the editor's content. */
  auditId: string
  model: string
  /** The model's SQL, trimmed. */
  sql: string
  /** What the editor held before any model draft, restored when the draft is discarded. */
  before: string
}

export type SqlOrigin = "ai" | "edited" | "manual"

export function sqlOrigin(source: SqlSource | null, sql: string): SqlOrigin {
  if (!source) return "manual"
  return sql.trim() === source.sql ? "ai" : "edited"
}

/** The last decision appended for an audit entry, to skip exact repeats. */
export interface LoggedDecision {
  decision: HumanDecision
  sql: string | null
}

/**
 * The decision a run should append to the source draft's audit entry, or null when there is
 * nothing new to record (manual SQL, or the same run as last time).
 */
export function decisionForRun(
  origin: SqlOrigin,
  sql: string,
  last: LoggedDecision | undefined
): LoggedDecision | null {
  if (origin === "manual") return null
  const next: LoggedDecision =
    origin === "ai" ? { decision: "accepted", sql: null } : { decision: "edited", sql: sql.trim() }
  if (last && last.decision === next.decision && last.sql === next.sql) return null
  return next
}

/** Skip a decision only when it repeats the last one exactly (used for accept and reject clicks). */
export function isRepeat(next: LoggedDecision, last: LoggedDecision | undefined): boolean {
  return !!last && last.decision === next.decision && last.sql === next.sql
}

/**
 * The source after a new draft arrives. An answerable draft fills the editor and becomes the
 * source (keeping the pre-draft SQL from any earlier draft); a declined draft leaves the editor and
 * its source alone.
 */
export function sourceAfterDraft(
  prev: SqlSource | null,
  editorSql: string,
  draft: { auditId: string; model: string; answerable: boolean; sql: string }
): SqlSource | null {
  if (!draft.answerable) return prev
  return {
    auditId: draft.auditId,
    model: draft.model,
    sql: draft.sql.trim(),
    before: prev ? prev.before : editorSql,
  }
}

/**
 * Discarding the draft with this audit id: when its SQL is the editor's source, the editor goes
 * back to the pre-draft SQL and loses its AI label; otherwise the editor is left as it is.
 */
export function discardDraft(
  source: SqlSource | null,
  auditId: string,
  editorSql: string
): { source: SqlSource | null; sql: string } {
  if (source && source.auditId === auditId) return { source: null, sql: source.before }
  return { source, sql: editorSql }
}
