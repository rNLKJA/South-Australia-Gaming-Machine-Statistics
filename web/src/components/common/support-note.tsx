import { LifeBuoy } from "lucide-react"

import { site } from "@/lib/site"
import { cn } from "@/lib/utils"

/**
 * The gambling-harm support line, shown on every page. Neutral and practical. The full note in the
 * footer is the page's "Gambling support" landmark; the compact copy near the top of a page is a
 * plain note, so a page never has two landmarks with the same name.
 */
export function SupportNote({
  className,
  compact = false,
}: {
  className?: string
  compact?: boolean
}) {
  const Tag = compact ? "div" : "aside"
  return (
    <Tag
      {...(compact ? { role: "note" } : {})}
      aria-label="Gambling support"
      className={cn(
        "flex gap-3 rounded-lg border border-teal/25 bg-teal-soft/60 p-4 text-sm text-foreground",
        className
      )}
    >
      <LifeBuoy className="mt-0.5 size-4 shrink-0 text-teal" aria-hidden />
      <p className="leading-relaxed">
        {compact ? null : (
          <>
            If gambling is affecting you or someone close to you, free and confidential help is
            available 24 hours a day.{" "}
          </>
        )}
        Gambling Help Line{" "}
        <a href={site.helpLineHref} className="link font-semibold whitespace-nowrap">
          {site.helpLine}
        </a>{" "}
        or{" "}
        <a href={site.helpOnline} className="link font-semibold">
          gamblinghelponline.org.au
        </a>
        .
      </p>
    </Tag>
  )
}
