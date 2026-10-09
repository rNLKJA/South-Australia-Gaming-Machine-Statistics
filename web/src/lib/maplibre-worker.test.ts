import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)))

describe("bundled MapLibre worker", () => {
  it("matches the installed maplibre-gl version (run `pnpm sync:maplibre-worker` after upgrading)", () => {
    const vendored = read("../../public/vendor/maplibre-gl-worker.mjs")
    const installed = read("../../node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs")
    expect(vendored.equals(installed)).toBe(true)
  })
})
