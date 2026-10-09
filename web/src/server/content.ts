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
  /** The markdown after the title and the metadata list. */
  body: string
}

function field(md: string, name: string): string {
  const m = new RegExp(`^- \\*\\*${name}:\\*\\* (.+)$`, "m").exec(md)
  return m ? m[1].trim() : ""
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
    body: firstSection >= 0 ? md.slice(firstSection + 1) : md,
  }
}

export function listDecisions(): DecisionRecord[] {
  const dir = path.join(CONTENT, "decisions")
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => /^DR-\d{3}-.+\.md$/.test(f))
    .sort()
    .map((f) => parseDecision(f.replace(/\.md$/, ""), readFileSync(path.join(dir, f), "utf8")))
}

export function getDecision(slug: string): DecisionRecord | null {
  return listDecisions().find((d) => d.slug === slug) ?? null
}
