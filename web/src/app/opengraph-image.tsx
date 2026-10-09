import { ImageResponse } from "next/og"

import { statewide } from "@/lib/data"
import { annualStatewide } from "@/lib/statewide"

export const alt = "SA Gaming Machine Statistics: sixteen years of CBS gaming-machine data"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OpengraphImage() {
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
        fontFamily: "Georgia, serif",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 22, letterSpacing: 3, color: "#b0502b", fontFamily: "sans-serif" }}>
          SOUTH AUSTRALIA · FY 2009/10 – 2024/25
        </div>
        <div style={{ fontSize: 68, fontWeight: 700, marginTop: 18, lineHeight: 1.05 }}>
          SA Gaming Machine Statistics
        </div>
        <div style={{ fontSize: 28, marginTop: 18, color: "#3a362f", fontFamily: "sans-serif" }}>
          Revenue, tax, councils, licences and manufacturers from the CBS releases
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
    size
  )
}
