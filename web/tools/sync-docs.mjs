// Copy the repository's docs (methods, data card, model card, AI use statement, decision records)
// into web/content/, where the website renders them. The copies are committed because Vercel
// builds from web/ only; src/server/content.test.ts fails if they drift from docs/.
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const docs = path.resolve(web, "..", "docs")
const out = path.join(web, "content")

if (!existsSync(docs)) {
  console.log(
    "sync-docs: ../docs not found (building from web/ alone); keeping the committed copies"
  )
  process.exit(0)
}
rmSync(path.join(out, "decisions"), { recursive: true, force: true })
mkdirSync(path.join(out, "decisions"), { recursive: true })
for (const f of ["methods.md", "data-card.md", "model-card.md", "ai-use-statement.md"]) {
  copyFileSync(path.join(docs, f), path.join(out, f))
}
const records = readdirSync(path.join(docs, "decisions"))
  .filter((f) => /^DR-\d{3}-.+\.md$/.test(f))
  .sort()
for (const f of records) {
  copyFileSync(path.join(docs, "decisions", f), path.join(out, "decisions", f))
}
// the slugs src/proxy.ts accepts: any other /methods/decisions/<slug> gets a real 404
writeFileSync(
  path.join(out, "decision-slugs.json"),
  JSON.stringify(records.map((f) => f.replace(/\.md$/, ""))) + "\n"
)
console.log("sync-docs: copied docs/ into web/content/")
