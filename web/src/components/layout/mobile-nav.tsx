"use client"

import { Menu } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { nav, site } from "@/lib/site"
import { cn } from "@/lib/utils"

export function MobileNav() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  // the same rule as the desktop NavLinks: a section stays current on its sub-pages
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button variant="ghost" size="icon" className="xl:hidden" aria-label="Open menu" />}
      >
        <Menu aria-hidden />
      </SheetTrigger>
      <SheetContent
        side="right"
        className="max-h-dvh w-[85vw] max-w-sm overflow-y-auto overscroll-contain bg-background p-0"
      >
        <div className="border-b px-5 py-4">
          <SheetTitle className="font-serif text-lg">{site.name}</SheetTitle>
        </div>
        <nav aria-label="Sections" className="px-2 pb-6">
          <ul className="flex flex-col">
            <li>
              <Link
                href="/"
                onClick={() => setOpen(false)}
                aria-current={pathname === "/" ? "page" : undefined}
                className={cn(
                  "block rounded-md px-3 py-2.5 text-base font-medium hover:bg-accent",
                  pathname === "/" && "bg-accent"
                )}
              >
                Overview
              </Link>
            </li>
            {nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={cn(
                    "block rounded-md px-3 py-2.5 hover:bg-accent",
                    isActive(item.href) && "bg-accent"
                  )}
                >
                  <span className="block text-base font-medium">{item.label}</span>
                  <span className="block text-sm text-muted-foreground">{item.description}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </SheetContent>
    </Sheet>
  )
}
