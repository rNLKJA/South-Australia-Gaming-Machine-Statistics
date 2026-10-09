import type { StructuredRequest } from "./types"

/**
 * Which build of the site made a call: the short commit on Vercel (or a local git checkout), set
 * at build time in next.config.ts. Logged with every AI call so an entry can be traced to the code
 * that produced its prompt.
 */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "dev"

/**
 * SHA-256 (hex) of what the model is told apart from the question: the system prompt (rules,
 * schema and domain notes) and the output JSON Schema. Two audit entries or evaluation runs with
 * the same hash were given the same instructions, so a change to the prompt between deploys shows
 * up in the log. Returns null where Web Crypto is unavailable (insecure contexts).
 */
export async function promptSha256(
  req: Pick<StructuredRequest, "system" | "jsonSchema">
): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) return null
  const text = `${req.system}\n\n${JSON.stringify(req.jsonSchema)}`
  try {
    const digest = await subtle.digest("SHA-256", new TextEncoder().encode(text))
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("")
  } catch {
    return null
  }
}
