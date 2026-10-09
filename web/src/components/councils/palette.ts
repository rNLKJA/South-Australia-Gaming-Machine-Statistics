/** Sequential ochre-to-terracotta ramp. Light: pale = low. Dark: dim = low, bright = high. */
export const RAMP = {
  light: ["#f0dfc2", "#e3b47f", "#d0844f", "#ad5428", "#6f3013"],
  dark: ["#3d2b1d", "#6e3f22", "#a8572d", "#da7c42", "#f4b679"],
} as const

export const NO_DATA = { light: "#e4ded1", dark: "#2a302e" } as const
/** Areas that were published but have no value for the measure (FY 2019/20 machine counts). */
export const NOT_PUBLISHED = { light: "#b8c6c4", dark: "#506a68" } as const
/** Choropleth fill opacity: lower in dark mode so basemap labels stay legible over the fills. */
export const FILL_OPACITY = { light: 0.88, dark: 0.7 } as const
/** Halo for basemap labels drawn above the fills in dark mode. */
export const LABEL_HALO = { light: "#fbf8f1", dark: "#121615" } as const
export const OUTLINE = { light: "#7c7466", dark: "#8d9a95" } as const
export const GROUP_OUTLINE = { light: "#1d1b17", dark: "#ebe5d8" } as const
export const SELECT_OUTLINE = { light: "#0e4f53", dark: "#6cbcb1" } as const

export const OPENFREEMAP_STYLE = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
} as const

/** A minimal style used when the OpenFreeMap tiles can't be reached: our boundaries on paper. */
export function fallbackStyle(mode: "light" | "dark") {
  return {
    version: 8 as const,
    sources: {},
    layers: [
      {
        id: "paper",
        type: "background" as const,
        paint: { "background-color": mode === "dark" ? "#121615" : "#f6f2e9" },
      },
    ],
  }
}
