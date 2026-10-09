import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export function Stat({
  label,
  value,
  detail,
  accent = "ink",
  className,
}: {
  label: string
  value: ReactNode
  detail?: ReactNode
  accent?: "ink" | "terracotta" | "teal" | "ochre"
  className?: string
}) {
  return (
    <div className={cn("border-t-2 pt-3", className)} style={{ borderColor: accentVar(accent) }}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="tabular mt-1 font-serif text-3xl font-semibold tracking-tight sm:text-[2.1rem]">
        {value}
      </p>
      {detail ? <p className="mt-1 text-sm text-ink-soft">{detail}</p> : null}
    </div>
  )
}

function accentVar(a: "ink" | "terracotta" | "teal" | "ochre") {
  return a === "ink" ? "var(--rule)" : `var(--${a})`
}
