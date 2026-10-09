"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"
import { nav } from "@/lib/site"

export function NavLinks({
  className,
  onNavigate,
}: {
  className?: string
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  return (
    <ul className={cn("flex", className)}>
      {nav.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative inline-flex items-center px-2.5 py-2 text-sm font-medium text-ink-soft transition-colors hover:text-foreground",
                "after:absolute after:inset-x-2.5 after:-bottom-px after:h-0.5 after:bg-terracotta after:opacity-0 after:transition-opacity",
                active && "text-foreground after:opacity-100"
              )}
            >
              {item.label}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
