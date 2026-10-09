import "server-only"

import { existsSync, readdirSync, readFileSync } from "node:fs"
import path from "node:path"

import { smartQuotes } from "@/lib/typography"

/**
 * The markdown documents rendered under /methods: copies of the repository's docs/ kept in
 * web/content/ by tools/sync-docs.mjs (Vercel builds from web/ only). Read at build time.
 */
const CONTENT = path.join(process.cwd(), "content")

export type DocName = "methods" | "data-card" | "model-card" | "ai-use-statement"

export function readDoc(name: DocName): string {
  return readFileSync(path.join(CONTENT, `${name}.md`), "utf8")
}

export interface DecisionRecord {
  slug: string
  id: string
  title: string
  status: string
  date: string
  decision: string
  /**
   * The earlier record this one replaces, from a "Supersedes" line such as
   * "DR-004, in part: how the evaluation's intervals are computed". Past records are never edited;
   * the site shows the link on the superseded record instead.
   */
  supersedes: { id: string; part: string | null } | null
  /** Later records that replace this one (filled in by listDecisions). */
  supersededBy: { id: string; slug: string; part: string | null }[]
  /** The markdown after the title and the metadata list. */
  body: string
}

function field(md: string, name: string): string {
  const m = new RegExp(`^- \\*\\*${name}:\\*\\* (.+)$`, "m").exec(md)
  return m ? m[1].trim() : ""
}

function parseSupersedes(text: string): DecisionRecord["supersedes"] {
  const m = /^(DR-\d{3})(?:, in part: (.+))?$/.exec(text)
  return m ? { id: m[1], part: m[2] ? smartQuotes(m[2].trim()) : null } : null
}

export function parseDecision(slug: string, md: string): DecisionRecord {
  const h1 = /^# (DR-\d{3}): (.+)$/m.exec(md)
  if (!h1) throw new Error(`${slug}: missing "# DR-NNN: title" heading`)
  const firstSection = md.indexOf("\n## ")
  return {
    slug,
    id: h1[1],
    // display text: curly quotes, as on the hand-written pages
    title: smartQuotes(h1[2].trim()),
    status: field(md, "Status"),
    date: field(md, "Date"),
    decision: smartQuotes(field(md, "Decision")),
    supersedes: parseSupersedes(field(md, "Supersedes")),
    supersededBy: [],
    body: firstSection >= 0 ? md.slice(firstSection + 1) : md,
  }
}

export function listDecisions(): DecisionRecord[] {
  const dir = path.join(CONTENT, "decisions")
  if (!existsSync(dir)) return []
  const all = readdirSync(dir)
    .filter((f) => /^DR-\d{3}-.+\.md$/.test(f))
    .sort()
    .map((f) => parseDecision(f.replace(/\.md$/, ""), readFileSync(path.join(dir, f), "utf8")))
  for (const d of all) {
    d.supersededBy = all
      .filter((o) => o.supersedes?.id === d.id)
      .map((o) => ({ id: o.id, slug: o.slug, part: o.supersedes!.part }))
  }
  return all
}

export function getDecision(slug: string): DecisionRecord | null {
  return listDecisions().find((d) => d.slug === slug) ?? null
}
