import { existsSync, readFileSync, statSync } from "node:fs"
import path from "node:path"

import initSqlJs from "sql.js"
import { describe, expect, it } from "vitest"

import { MOCK_QUESTION, mockAnswer } from "../../e2e/mock-ai"
import { SqlAnswerSchema } from "./ai/sql-assistant"
import { lgaUnits } from "./data"
import { rankUnits, unitsForFy } from "./lga"
import {
  MOCK_ANSWER_PREFIX,
  MOCK_SQL,
  SCREENSHOTS,
  WALKTHROUGHS,
  screenshotSrc,
  walkthroughMedia,
} from "./showcase"
import { validateSql } from "./sql/guard"
import { buildLoadScript } from "./sql/load"
import { tidyTables } from "./sql/tables"

const WEB = process.cwd()
const ROOT = path.resolve(WEB, "..")
const PUBLIC = path.join(WEB, "public")
const DOCS_SHOWCASE = path.join(ROOT, "docs", "showcase")
const README = readFileSync(path.join(ROOT, "README.md"), "utf8")

const KB = 1024
const MB = 1024 * KB
const publicFile = (src: string) => path.join(PUBLIC, src)

describe("showcase definitions", () => {
  it("number the screenshots 01, 02, ... with unique kebab-case names", () => {
    SCREENSHOTS.forEach((s, i) => {
      expect(s.id).toMatch(/^\d{2}-[a-z0-9]+(-[a-z0-9]+)*$/)
      expect(s.id.slice(0, 2)).toBe(String(i + 1).padStart(2, "0"))
    })
    expect(new Set(SCREENSHOTS.map((s) => s.id)).size).toBe(SCREENSHOTS.length)
    expect(SCREENSHOTS[0].id).toBe("01-landing-light")
    expect(SCREENSHOTS[1].id).toBe("02-landing-dark")
    const mobile = SCREENSHOTS.filter((s) => s.viewport === "mobile").length
    expect(mobile).toBeGreaterThanOrEqual(2)
    expect(mobile).toBeLessThanOrEqual(3)
  })

  it("keep mocked steps inside each walkthrough and mark the AI one", () => {
    for (const w of WALKTHROUGHS) {
      expect(w.steps.length).toBeGreaterThan(3)
      expect(new Set(w.steps).size).toBe(w.steps.length)
      for (const k of w.mockedSteps ?? []) {
        expect(k).toBeGreaterThanOrEqual(1)
        expect(k).toBeLessThanOrEqual(w.steps.length)
      }
    }
    expect(WALKTHROUGHS.find((w) => w.id === "ask-the-data")?.mockedSteps?.length).toBeGreaterThan(
      0
    )
  })
})

describe("the tour's mocked AI reply", () => {
  const TABLES = tidyTables().map((t) => t.name)

  it("says it is a mock and matches the structured-output contract", () => {
    const answer = SqlAnswerSchema.parse(mockAnswer(MOCK_QUESTION))
    expect(answer.answerable).toBe(true)
    expect(answer.sql).toBe(MOCK_SQL)
    expect(answer.explanation.startsWith(MOCK_ANSWER_PREFIX)).toBe(true)
  })

  it("passes the allow-list and returns the five areas with the most machines", async () => {
    const v = validateSql(MOCK_SQL, TABLES)
    expect(v.ok, v.ok ? "" : v.error).toBe(true)
    const SQL = await initSqlJs()
    const db = new SQL.Database()
    db.exec(buildLoadScript(tidyTables()))
    const [res] = db.exec(MOCK_SQL)
    const expected = rankUnits(unitsForFy(lgaUnits, "2024-25"), "machines")
      .slice(0, 5)
      .map((u) => [u.label, u.machines])
    expect(res.values.map((r) => [r[0], r[2]])).toEqual(expected)
    db.close()
  })

  it("declines anything else, still labelled", () => {
    const answer = SqlAnswerSchema.parse(mockAnswer("Which venue had the most machines?"))
    expect(answer.answerable).toBe(false)
    expect(answer.explanation.startsWith(MOCK_ANSWER_PREFIX)).toBe(true)
  })
})

describe("showcase media (pnpm showcase)", () => {
  it("has a PNG under 600 KB and a WebP copy for every screenshot", () => {
    for (const s of SCREENSHOTS) {
      const png = path.join(DOCS_SHOWCASE, `${s.id}.png`)
      expect(existsSync(png), png).toBe(true)
      expect(statSync(png).size, png).toBeLessThan(600 * KB)
      expect(existsSync(publicFile(screenshotSrc(s.id))), s.id).toBe(true)
    }
  })

  it("has an MP4 and a GIF of at most 8 MB, a poster and captions for every walkthrough", () => {
    for (const w of WALKTHROUGHS) {
      const media = walkthroughMedia(w.id)
      const mp4 = publicFile(media.mp4)
      const gif = path.join(DOCS_SHOWCASE, `${w.id}.gif`)
      for (const file of [mp4, gif]) {
        expect(existsSync(file), file).toBe(true)
        expect(statSync(file).size, file).toBeLessThanOrEqual(8 * MB)
      }
      expect(existsSync(publicFile(media.poster)), media.poster).toBe(true)
    }
  })

  it("captions every step of each video, in order, with the on-screen text", () => {
    for (const w of WALKTHROUGHS) {
      const vtt = readFileSync(publicFile(walkthroughMedia(w.id).captions), "utf8")
      expect(vtt.startsWith("WEBVTT")).toBe(true)
      const cues = [...vtt.matchAll(/^Step (\d+) of (\d+)\. (.*)$/gm)]
      expect(cues.map((m) => Number(m[1]))).toEqual(w.steps.map((_, i) => i + 1))
      cues.forEach((m, i) => {
        expect(Number(m[2])).toBe(w.steps.length)
        expect(m[3].startsWith(w.steps[i])).toBe(true)
        expect(m[3].includes("Mocked AI response")).toBe(w.mockedSteps?.includes(i + 1) ?? false)
      })
    }
  })
})

describe("README showcase section", () => {
  it("shows every screenshot and links the tour", () => {
    for (const s of SCREENSHOTS) expect(README).toContain(`docs/showcase/${s.id}.png`)
    expect(README).toContain("https://sa-gaming-machine-stats.vercel.app/tour")
  })

  it("lists each walkthrough's steps exactly as the videos caption them", () => {
    for (const w of WALKTHROUGHS) {
      expect(README).toContain(`docs/showcase/${w.id}.gif`)
      w.steps.forEach((step, i) => expect(README).toContain(`${i + 1}. ${step}`))
    }
  })
})
