import Link from "next/link"

import { site } from "@/lib/site"

import { BrandMark } from "./brand-mark"
import { MobileNav } from "./mobile-nav"
import { NavLinks } from "./nav-links"
import { ThemeToggle } from "./theme-toggle"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link
          href="/"
          className="group flex min-w-0 items-center gap-2.5"
          aria-label={`${site.name}, home`}
        >
          <BrandMark className="size-8 shrink-0 text-foreground" />
          <span className="flex min-w-0 flex-col leading-none">
            <span className="truncate font-serif text-[1.05rem] font-semibold tracking-tight sm:text-lg">
              {site.name}
            </span>
            <span className="kicker mt-1 hidden text-[0.65rem] text-muted-foreground sm:block">
              South Australia · FY 2009/10 – 2024/25
            </span>
          </span>
        </Link>
        <nav aria-label="Sections" className="ml-auto hidden lg:block">
          <NavLinks className="gap-0.5" />
        </nav>
        <div className="ml-auto flex items-center gap-1 lg:ml-2">
          <ThemeToggle />
          <a
            href={site.repo}
            className="hidden size-8 items-center justify-center rounded-lg text-ink-soft hover:bg-muted hover:text-foreground sm:inline-flex"
            aria-label="Source code on GitHub"
            title="Source code on GitHub"
          >
            <svg viewBox="0 0 24 24" className="size-4" aria-hidden fill="currentColor">
              <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.7 5.4-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
            </svg>
          </a>
          <MobileNav />
        </div>
      </div>
    </header>
  )
}
