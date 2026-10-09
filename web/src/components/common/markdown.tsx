import Link from "next/link"
import type { ReactNode } from "react"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"

import { docHref, slugify } from "@/lib/doc-links"
import { rehypeTypography } from "@/lib/typography"
import { cn } from "@/lib/utils"

function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(textOf).join("")
  if (node && typeof node === "object" && "props" in node) {
    return textOf((node as { props: { children?: ReactNode } }).props.children)
  }
  return ""
}

type Heading = "h1" | "h2" | "h3" | "h4" | "h5" | "h6"
const LEVELS: Heading[] = ["h1", "h2", "h3", "h4", "h5", "h6"]

/**
 * Renders the repository's markdown docs in the site's editorial style. Headings get ids (for
 * anchors such as /methods#limitations) and links between docs become site routes. `topLevel` is
 * the HTML heading a markdown `#` becomes, so `##` sections can be h2 on a page with its own h1.
 * Straight quotes become curly ones and d_z gets a real subscript (see lib/typography).
 */
export function Markdown({
  source,
  hideTitle = false,
  topLevel = 2,
  className,
}: {
  source: string
  hideTitle?: boolean
  topLevel?: 1 | 2
  className?: string
}) {
  const tag = (n: number): Heading => LEVELS[Math.min(LEVELS.length - 1, topLevel + n - 2)]
  const H1 = tag(1)
  const H2 = tag(2)
  const H3 = tag(3)
  const components: Components = {
    h1: ({ children }) =>
      hideTitle ? null : (
        <H1 id={slugify(textOf(children))} className="scroll-mt-24 text-3xl font-semibold">
          {children}
        </H1>
      ),
    h2: ({ children }) => (
      <H2
        id={slugify(textOf(children))}
        className="mt-10 scroll-mt-24 border-t pt-6 text-2xl font-semibold first:mt-0 first:border-t-0 first:pt-0"
      >
        {children}
      </H2>
    ),
    h3: ({ children }) => (
      <H3 id={slugify(textOf(children))} className="mt-6 scroll-mt-24 text-lg font-semibold">
        {children}
      </H3>
    ),
    p: ({ children }) => <p className="mt-3 leading-relaxed text-ink-soft">{children}</p>,
    ul: ({ children }) => (
      <ul className="mt-3 list-disc space-y-1.5 pl-5 leading-relaxed text-ink-soft">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="mt-3 list-decimal space-y-1.5 pl-5 leading-relaxed text-ink-soft">
        {children}
      </ol>
    ),
    a: ({ href, children }) => {
      const to = docHref(href ?? "")
      return to.startsWith("/") || to.startsWith("#") ? (
        <Link href={to} className="link">
          {children}
        </Link>
      ) : (
        <a href={to} className="link" rel="noreferrer">
          {children}
        </a>
      )
    },
    code: ({ children }) => (
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">{children}</code>
    ),
    table: ({ children }) => (
      <div className="mt-4 overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[480px] text-left text-sm">{children}</table>
      </div>
    ),
    thead: ({ children }) => <thead className="border-b">{children}</thead>,
    tbody: ({ children }) => <tbody className="divide-y">{children}</tbody>,
    th: ({ children }) => (
      <th scope="col" className="px-3 py-2 align-bottom font-semibold">
        {children}
      </th>
    ),
    td: ({ children }) => <td className="tabular px-3 py-2 align-top">{children}</td>,
    strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  }
  return (
    <div className={cn("max-w-[75ch]", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeTypography]}
        components={components}
      >
        {source}
      </ReactMarkdown>
    </div>
  )
}
