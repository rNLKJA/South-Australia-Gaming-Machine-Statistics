"use client"

import type { ComponentProps } from "react"

import { useScrollFocusable } from "@/hooks/use-scroll-focusable"
import { cn } from "@/lib/utils"

/**
 * A scrolling box that keyboard users can reach: it becomes focusable (so arrow keys scroll it)
 * only while its content overflows. Focus shows as an inset outline, which the box can't clip.
 */
export function ScrollRegion({
  axis = "both",
  className,
  ...props
}: ComponentProps<"div"> & { axis?: "x" | "both" }) {
  const { ref, scrollable } = useScrollFocusable<HTMLDivElement>(axis)
  return (
    <div
      ref={ref}
      tabIndex={scrollable ? 0 : undefined}
      className={cn(
        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
        className
      )}
      {...props}
    />
  )
}
