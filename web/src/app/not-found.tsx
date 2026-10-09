import type { Metadata } from "next"
import Link from "next/link"

import { nav } from "@/lib/site"

export const metadata: Metadata = { title: "Page not found" }

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
      <p className="kicker text-terracotta">Error 404</p>
      <h1 className="mt-3 text-4xl font-semibold">That page isn’t in this edition</h1>
      <p className="mt-4 text-lg leading-relaxed text-ink-soft">
        The address may be mistyped, or the page may have moved. These sections are available:
      </p>
      <ul className="mt-6 divide-y border-y">
        <li>
          <Link href="/" className="flex justify-between gap-4 py-3 hover:text-teal">
            <span className="font-medium">Overview</span>
            <span className="text-sm text-muted-foreground">What this project is</span>
          </Link>
        </li>
        {nav.map((n) => (
          <li key={n.href}>
            <Link href={n.href} className="flex justify-between gap-4 py-3 hover:text-teal">
              <span className="font-medium">{n.label}</span>
              <span className="text-right text-sm text-muted-foreground">{n.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
