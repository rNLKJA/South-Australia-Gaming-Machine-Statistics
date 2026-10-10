"use client"

import { useEffect, useRef, useState } from "react"

import { overflows } from "@/lib/scrollable"

/**
 * For a box that may scroll: whether it currently overflows, so it can take keyboard focus
 * (tabIndex 0) only then. A scrolling box with nothing focusable inside is otherwise out of reach
 * of keyboard users (WCAG 2.1.1); a box that doesn't scroll shouldn't add a tab stop.
 */
export function useScrollFocusable<T extends HTMLElement>(axis: "x" | "both" = "both") {
  const ref = useRef<T>(null)
  const [scrollable, setScrollable] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const check = () => setScrollable(overflows(el, axis))
    check()
    if (typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(check)
    ro.observe(el)
    for (const child of Array.from(el.children)) ro.observe(child)
    return () => ro.disconnect()
  }, [axis])

  return { ref, scrollable }
}
