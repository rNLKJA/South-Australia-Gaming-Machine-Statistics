"use client"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"

export interface SegmentOption<T extends string> {
  value: T
  label: string
  disabled?: boolean
}

/** Single-choice segmented control (a toggle group that can't be emptied). */
export function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
  className,
  hideLabel = false,
}: {
  label: string
  value: T
  onChange: (value: T) => void
  options: SegmentOption<T>[]
  className?: string
  hideLabel?: boolean
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className={cn("kicker text-muted-foreground", hideLabel && "sr-only")}>{label}</span>
      <ToggleGroup
        aria-label={label}
        value={[value]}
        onValueChange={(v) => {
          const next = v[0] as T | undefined
          if (next) onChange(next)
        }}
        spacing={0}
        variant="outline"
        size="sm"
        className="flex-wrap bg-card"
      >
        {options.map((o) => (
          <ToggleGroupItem
            key={o.value}
            value={o.value}
            disabled={o.disabled}
            className="aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background aria-pressed:hover:bg-foreground/90"
          >
            {o.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}
