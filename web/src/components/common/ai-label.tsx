import { Sparkles } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * The visible label on every AI output. "generated" is text the model wrote (a draft query, an
 * explanation); "assisted" is a result computed by the database from a query the model drafted.
 */
export function AiLabel({
  kind = "generated",
  className,
  detail,
}: {
  kind?: "generated" | "assisted"
  className?: string
  detail?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-ochre/50 bg-ochre-soft px-2 py-0.5 text-xs font-semibold text-ochre-ink",
        className
      )}
    >
      <Sparkles className="size-3" aria-hidden />
      {kind === "generated" ? "AI-generated" : "AI-assisted"}
      {detail ? <span className="font-normal">· {detail}</span> : null}
    </span>
  )
}
