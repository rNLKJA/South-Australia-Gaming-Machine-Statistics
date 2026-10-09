import "server-only"

import cpiJson from "@/data/cpi.json"
import lgaJson from "@/data/lga.json"
import licencesJson from "@/data/licences.json"
import manufacturersJson from "@/data/manufacturers.json"
import metaJson from "@/data/meta.json"
import powerbiJson from "@/data/powerbi.json"
import statewideJson from "@/data/statewide.json"
import verificationJson from "@/data/verification.json"

import type {
  CpiPoint,
  CrosswalkEntry,
  LgaRow,
  LgaUnit,
  LicenceMonth,
  ManufacturerMonth,
  PowerBiVisual,
  StatewideMonth,
  Verification,
} from "./types"

/**
 * Typed access to the artefacts written by scripts/build_data.py and scripts/verify_pdfs.py.
 * Server-only: the raw tables stay on the server and only page-sized slices reach the browser.
 */
export const statewide = statewideJson.rows as StatewideMonth[]
export const licences = licencesJson.rows as LicenceMonth[]
export const manufacturers = manufacturersJson.rows as ManufacturerMonth[]
export const lgaRows = lgaJson.rows as LgaRow[]
export const lgaUnits = lgaJson.units as LgaUnit[]
export const crosswalk = lgaJson.crosswalk as CrosswalkEntry[]
export const cpi = cpiJson.series as CpiPoint[]
export const cpiSource = { name: cpiJson.source, url: cpiJson.url }
export const powerBiVisuals = powerbiJson.visuals as unknown as PowerBiVisual[]
export const verification = verificationJson as Verification
export const meta = metaJson
