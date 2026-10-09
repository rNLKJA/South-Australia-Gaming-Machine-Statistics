import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/** A figure with a title, a short standfirst, the chart, and a source line. */
export function ChartFrame({
  title,
  description,
  source,
  actions,
  children,
  className,
  headingLevel = "h2",
}: {
  title: string
  description?: ReactNode
  source?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  /** The figure title is a heading so screen-reader users can jump between charts. */
  headingLevel?: "h2" | "h3"
}) {
  const Heading = headingLevel
  return (
    <figure className={cn("rounded-lg border bg-card p-4 sm:p-6", className)}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <figcaption className="max-w-2xl">
          <Heading className="font-serif text-xl font-semibold tracking-tight">{title}</Heading>
          {description ? (
            <div className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</div>
          ) : null}
        </figcaption>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <div className="mt-5">{children}</div>
      {source ? (
        <p className="mt-4 border-t pt-3 text-xs leading-relaxed text-muted-foreground">{source}</p>
      ) : null}
    </figure>
  )
}
