"use client"

import { Monitor, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useSyncExternalStore } from "react"

import { Button } from "@/components/ui/button"

const ORDER = ["system", "light", "dark"] as const
const LABEL = { system: "System theme", light: "Light theme", dark: "Dark theme" } as const

const subscribe = () => () => {}

/** Cycles system → light → dark. Renders a stable placeholder until hydrated. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  )
  const current = (mounted ? theme : "system") as (typeof ORDER)[number]
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length]
  const Icon = current === "dark" ? Moon : current === "light" ? Sun : Monitor
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(next)}
      aria-label={`${LABEL[current]}. Switch to ${LABEL[next].toLowerCase()}`}
      title={`${LABEL[current]} (click for ${LABEL[next].toLowerCase()})`}
    >
      <Icon aria-hidden />
    </Button>
  )
}
