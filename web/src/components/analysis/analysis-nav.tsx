import Link from "next/link"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export const ANALYSIS_PAGES = [
  { href: "/analysis", label: "Overview" },
  { href: "/analysis/trends", label: "Trends" },
  { href: "/analysis/councils", label: "Councils" },
  { href: "/analysis/concentration", label: "Concentration" },
] as const

/** Tabs between the Analysis pages. */
export function AnalysisNav({ current }: { current: (typeof ANALYSIS_PAGES)[number]["href"] }) {
  return (
    <nav aria-label="Analysis pages" className="mb-10 border-b">
      <ul className="-mb-px flex flex-wrap gap-x-1">
        {ANALYSIS_PAGES.map((p) => (
          <li key={p.href}>
            <Link
              href={p.href}
              aria-current={p.href === current ? "page" : undefined}
              className={cn(
                "inline-block border-b-2 px-3 py-2 text-sm font-medium text-ink-soft hover:text-foreground",
                p.href === current ? "border-terracotta text-foreground" : "border-transparent"
              )}
            >
              {p.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/** A compact block stating how a result was computed (method, n, seed). */
export function MethodNote({
  children,
  inCard = false,
}: {
  children: ReactNode
  /** Inside a bordered card: pad the note to the card's edges. */
  inCard?: boolean
}) {
  return (
    <p
      className={cn(
        "mt-3 border-t pt-3 text-xs leading-relaxed text-muted-foreground",
        inCard && "mt-0 px-4 pb-3"
      )}
    >
      {children}
    </p>
  )
}
