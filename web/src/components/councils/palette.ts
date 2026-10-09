/**
 * Sequential ochre-to-terracotta ramp. Light: pale = low. Dark: dim = low, bright = high.
 * The lowest dark class is lifted well clear of the near-black basemap (about 2.2:1 after the
 * fill opacity), so the smallest areas never read as empty.
 */
export const RAMP = {
  light: ["#ecd09f", "#dfa96f", "#cb7c45", "#a84f25", "#6c2e12"],
  dark: ["#7a4a26", "#a0562b", "#c66a34", "#e58b4c", "#f7bd82"],
} as const

/**
 * Councils with no venues reported: a neutral diagonal hatch, so they differ from the lowest
 * class by texture as well as colour (WCAG 1.4.11; readable without colour vision).
 */
export const NO_DATA_HATCH = {
  light: { bg: "#ebe7de", stripe: "#a39c8e" },
  dark: { bg: "#262c2a", stripe: "#6b7773" },
} as const
export const NO_DATA = { light: NO_DATA_HATCH.light.bg, dark: NO_DATA_HATCH.dark.bg } as const
export const HATCH_IMAGE = "no-venues-hatch"
const HATCH_SIZE = 8

/** The map's hatch tile: 2 px stripes every 8 px, rising left to right, seamless when repeated. */
export function hatchImage(mode: "light" | "dark") {
  const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const bg = [...hex(NO_DATA_HATCH[mode].bg), 255]
  const stripe = [...hex(NO_DATA_HATCH[mode].stripe), 255]
  const data = new Uint8Array(HATCH_SIZE * HATCH_SIZE * 4)
  for (let y = 0; y < HATCH_SIZE; y++) {
    for (let x = 0; x < HATCH_SIZE; x++) {
      data.set((x + y) % HATCH_SIZE < 2 ? stripe : bg, (y * HATCH_SIZE + x) * 4)
    }
  }
  return { width: HATCH_SIZE, height: HATCH_SIZE, data }
}

/** The same hatch for legend swatches. */
export function hatchCss(mode: "light" | "dark"): string {
  const { bg, stripe } = NO_DATA_HATCH[mode]
  return `repeating-linear-gradient(135deg, ${stripe} 0 1.5px, ${bg} 1.5px 4px)`
}
/** Areas that were published but have no value for the measure (FY 2019/20 machine counts). */
export const NOT_PUBLISHED = { light: "#b8c6c4", dark: "#506a68" } as const
/** Choropleth fill opacity; basemap labels sit above the fills (with a dark halo in dark mode). */
export const FILL_OPACITY = { light: 0.88, dark: 0.85 } as const
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
