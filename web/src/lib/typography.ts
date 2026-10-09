/**
 * Typographic touches for text written in plain ASCII (the repository's markdown docs): curly
 * quotes and apostrophes, and d_z with a real subscript, so the rendered docs match the hand-written
 * pages.
 */

/** Straight quotes to curly ones: ' and " open after a space or an opening bracket, close otherwise. */
export function smartQuotes(text: string, openBefore = true): string {
  let out = ""
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch !== "'" && ch !== '"') {
      out += ch
      continue
    }
    const prev = i > 0 ? text[i - 1] : null
    const opens = prev === null ? openBefore : /[\s([{—–-]/.test(prev)
    if (ch === "'") out += opens ? "‘" : "’"
    else out += opens ? "“" : "”"
  }
  return out
}

interface HastText {
  type: "text"
  value: string
}
interface HastElement {
  type: "element"
  tagName: string
  properties?: Record<string, unknown>
  children: HastNode[]
}
type HastNode = HastText | HastElement | { type: string; children?: HastNode[]; value?: string }

const SKIP = new Set(["code", "pre", "kbd", "samp"])

/** Split "d_z" (the paired effect size) into d + <sub>z</sub>. */
function withSubscripts(value: string): HastNode[] {
  const parts = value.split(/\bd_z\b/)
  if (parts.length === 1) return [{ type: "text", value }]
  const out: HastNode[] = []
  parts.forEach((p, i) => {
    if (i > 0) {
      out.push({ type: "text", value: "d" })
      out.push({
        type: "element",
        tagName: "sub",
        properties: {},
        children: [{ type: "text", value: "z" }],
      })
    }
    if (p) out.push({ type: "text", value: p })
  })
  return out
}

/**
 * A rehype plugin applying smartQuotes and the d_z subscript to every text node outside code.
 * A quote at the start of a text node opens only if the previous text ended in a space (so a quote
 * right after **bold** text closes, as it should).
 */
export function rehypeTypography() {
  return (tree: HastNode) => {
    let lastChar = " "
    const walk = (node: HastNode) => {
      if (!("children" in node) || !node.children) return
      const next: HastNode[] = []
      for (const child of node.children) {
        if (child.type === "text" && typeof child.value === "string") {
          const v = smartQuotes(child.value, /[\s([{]/.test(lastChar))
          if (v.length) lastChar = v[v.length - 1]
          next.push(...withSubscripts(v))
        } else if (child.type === "element" && SKIP.has((child as HastElement).tagName)) {
          lastChar = "x"
          next.push(child)
        } else {
          if (
            child.type === "element" &&
            /^(p|li|h[1-6]|td|th|blockquote)$/.test((child as HastElement).tagName)
          ) {
            lastChar = " "
          }
          walk(child)
          next.push(child)
        }
      }
      node.children = next
    }
    walk(tree)
  }
}
