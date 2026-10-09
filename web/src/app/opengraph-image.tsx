import { cacheLife } from "next/cache"
import { ImageResponse } from "next/og"

import { statewide } from "@/lib/data"
import { annualStatewide } from "@/lib/statewide"

export const alt = "SA Gaming Machine Statistics: sixteen years of CBS gaming-machine data"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

const KICKER = "SOUTH AUSTRALIA · FY 2009/10 – 2024/25"
const TITLE = "SA Gaming Machine Statistics"
const SUBTITLE = "Revenue, tax, councils, licences and manufacturers from the CBS releases"

/**
 * The site's display fonts (Newsreader, Public Sans; both SIL OFL) as TrueType, subset to the
 * characters drawn. If Google Fonts can't be reached the image still builds with the default font.
 */
async function googleFont(family: string, weight: number, text: string) {
  try {
    const url = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${weight}&text=${encodeURIComponent(text)}`
    const css = await (await fetch(url)).text()
    const src = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1]
    if (!src) return null
    const res = await fetch(src)
    return res.ok ? await res.arrayBuffer() : null
  } catch {
    return null
  }
}

/** Both fonts, fetched once and cached so the image prerenders as a static file. */
async function loadFonts() {
  "use cache"
  cacheLife("max")
  const [display, sans] = await Promise.all([
    googleFont("Newsreader", 600, TITLE),
    googleFont("Public Sans", 500, KICKER + SUBTITLE),
  ])
  return { display, sans }
}

export default async function OpengraphImage() {
  const { display, sans } = await loadFonts()
  const fonts = [
    display && {
      name: "Newsreader",
      data: display,
      weight: 600 as const,
      style: "normal" as const,
    },
    sans && { name: "Public Sans", data: sans, weight: 500 as const, style: "normal" as const },
  ].filter((f) => !!f)
  const years = annualStatewide(statewide)
  const max = 1100
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#f6f2e9",
        color: "#1d1b17",
        padding: "64px 72px",
        fontFamily: "Newsreader, serif",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{ fontSize: 22, letterSpacing: 3, color: "#b0502b", fontFamily: "Public Sans" }}
        >
          {KICKER}
        </div>
        <div style={{ fontSize: 76, fontWeight: 600, marginTop: 18, lineHeight: 1.05 }}>
          {TITLE}
        </div>
        <div style={{ fontSize: 28, marginTop: 18, color: "#3a362f", fontFamily: "Public Sans" }}>
          {SUBTITLE}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 14,
          height: 220,
          borderBottom: "3px solid #1d1b17",
        }}
      >
        {years.map((y) => (
          <div
            key={y.fy}
            style={{
              width: 48,
              height: `${((y.ngr ?? 0) / max) * 100}%`,
              background: y.fy === "2019-20" ? "#b97f22" : "#b0502b",
            }}
          />
        ))}
      </div>
    </div>,
    { ...size, fonts }
  )
}
