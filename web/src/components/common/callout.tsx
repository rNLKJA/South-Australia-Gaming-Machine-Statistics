import { AlertTriangle, Info } from "lucide-react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/** A ruled margin note. "caution" is for figures that should not be read at face value. */
export function Callout({
  title,
  children,
  tone = "info",
  className,
}: {
  title?: string
  children: ReactNode
  tone?: "info" | "caution"
  className?: string
}) {
  const Icon = tone === "caution" ? AlertTriangle : Info
  return (
    <div
      role="note"
      className={cn(
        "flex gap-3 border-l-[3px] py-1 pl-4 text-sm leading-relaxed",
        tone === "caution" ? "border-ochre" : "border-teal",
        className
      )}
    >
      <Icon
        className={cn("mt-0.5 size-4 shrink-0", tone === "caution" ? "text-ochre" : "text-teal")}
        aria-hidden
      />
      <div className="min-w-0 space-y-1">
        {title ? <p className="font-semibold text-foreground">{title}</p> : null}
        <div className="text-ink-soft">{children}</div>
      </div>
    </div>
  )
}
