import Link from "next/link"

import { SupportNote } from "@/components/common/support-note"
import { nav, site } from "@/lib/site"

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t bg-card/60">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <SupportNote className="mb-10" />
        <div className="grid gap-10 text-sm md:grid-cols-[1.4fr_1fr_1fr]">
          <div className="space-y-3">
            <p className="font-serif text-lg font-semibold">{site.name}</p>
            <p className="max-w-prose leading-relaxed text-muted-foreground">
              A personal data project by {site.author}. It is not affiliated with Consumer and
              Business Services, the Government of South Australia or my employer, and nothing here
              promotes gambling. Figures are transcribed from public CBS releases; treat the{" "}
              <a href={site.cbsUrl} className="link">
                CBS gaming statistics page
              </a>{" "}
              as authoritative.
            </p>
          </div>
          <div>
            <p className="kicker mb-3 text-muted-foreground">Sections</p>
            <ul className="space-y-1.5">
              {nav.map((n) => (
                <li key={n.href}>
                  <Link href={n.href} className="hover:text-teal hover:underline">
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="kicker mb-3 text-muted-foreground">Sources</p>
            <ul className="space-y-2 leading-snug text-muted-foreground">
              <li>Gaming statistics: {site.cbsName}.</li>
              <li>Council boundaries and CPI: Australian Bureau of Statistics, CC BY 4.0.</li>
              <li>Basemap: OpenFreeMap, © OpenMapTiles, © OpenStreetMap contributors.</li>
              <li>
                <a href={site.repo} className="link">
                  Code and original archive on GitHub
                </a>{" "}
                (MIT).
              </li>
            </ul>
          </div>
        </div>
        <p className="mt-10 border-t pt-6 text-xs text-muted-foreground">
          Personal project, 2025; revived as a website in 2026. Data © Government of South Australia
          and the Australian Bureau of Statistics.
        </p>
      </div>
    </footer>
  )
}
