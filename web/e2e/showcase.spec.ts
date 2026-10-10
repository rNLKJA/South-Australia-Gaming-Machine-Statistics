/**
 * The guided tour, as an end-to-end test.
 *
 *   pnpm showcase                                   # production, records media
 *   BASE_URL=http://localhost:3532 pnpm showcase    # a local `pnpm build` first
 *   pnpm showcase:test                              # journeys only: no pauses, no video
 *
 * Each journey checks what it shows (the published figures, the interrupted time series estimate,
 * the slider reaching both ends of the series, the mocked query passing the allow-list and
 * returning five rows, the audit log entry), so a broken feature fails the tour instead of
 * producing a misleading video. Nothing is random: every page shows the published CBS figures and
 * the analyses use the fixed seed 20090701.
 *
 * No real API key is used: the AI steps type a placeholder, and every request to a provider is
 * answered in the browser by e2e/mock-ai.ts.
 */
import path from "node:path"

import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from "@playwright/test"

import {
  MOCK_LABEL,
  MOCK_SQL,
  SCREENSHOTS,
  WALKTHROUGHS,
  type WalkthroughId,
} from "../src/lib/showcase"
import { MOCK_QUESTION, PLACEHOLDER_KEY, mockAiProviders } from "./mock-ai"
import {
  FAST,
  SHOT_DIR,
  Tour,
  ensureDirs,
  finishRecording,
  recordingContext,
} from "./showcase-helpers"

const walkthrough = (id: WalkthroughId) => WALKTHROUGHS.find((w) => w.id === id)!

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready)
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined)
}

/**
 * Viewport screenshot to .showcase/screens/<id>.png, optionally with `align` scrolled to `offset`
 * px from the top (applied twice, after layout settles).
 */
async function shot(page: Page, id: string, align?: { target: Locator; offset: number }) {
  if (!SCREENSHOTS.some((s) => s.id === id)) throw new Error(`Unknown screenshot ${id}`)
  await page.mouse.move(0, 0)
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.())
  for (let i = 0; i < 2; i++) {
    if (align) {
      await align.target.evaluate((el, offset) => {
        const top = el.getBoundingClientRect().top + window.scrollY - offset
        window.scrollTo({ top, behavior: "instant" })
      }, align.offset)
    }
    await page.waitForTimeout(500)
  }
  await page.screenshot({ path: path.join(SHOT_DIR, `${id}.png`) })
}

/** A visible "mocked" label pinned to the page, for screenshots of mocked AI output. */
async function pinMockLabel(page: Page) {
  await page.evaluate((label) => {
    const el = document.createElement("div")
    el.textContent = label
    el.setAttribute("aria-hidden", "true")
    el.style.cssText =
      "position:fixed;right:24px;top:84px;z-index:2147483647;padding:8px 14px;border-radius:6px;" +
      "background:#f3e6cb;color:#5c3b08;border:2px dashed #8a5a10;font:700 15px/1.2 ui-sans-serif,system-ui,sans-serif;" +
      "text-transform:uppercase;letter-spacing:.04em;box-shadow:0 8px 24px rgba(0,0,0,.18)"
    document.body.appendChild(el)
  }, MOCK_LABEL)
}

const h1 = (page: Page) => page.getByRole("heading", { level: 1 })
const sections = (page: Page) => page.getByRole("navigation", { name: "Sections" })
const analysisNav = (page: Page) => page.getByRole("navigation", { name: "Analysis pages" })

/** The figure that holds the chart titled `title`. */
const figure = (page: Page, title: string | RegExp) =>
  page.locator("figure").filter({ has: page.getByRole("heading", { name: title }) })

// ---------------------------------------------------------------------------- councils map

const council = {
  slider: (page: Page) => page.getByRole("slider", { name: "Financial year" }),
  track: (page: Page) => page.locator("[data-slot=slider-track]").first(),
  year: (page: Page) => page.locator("[aria-live=polite]").filter({ hasText: /^FY \d{4}\/\d{2}$/ }),
  ranking: (page: Page) => page.getByRole("table", { name: /^Council areas ranked by/ }),
  map: (page: Page) => page.getByRole("region", { name: /^Map of South Australian council areas/ }),
}

async function councilMapReady(page: Page) {
  await expect(council.map(page)).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText("Loading council boundaries…")).toBeHidden({ timeout: 60_000 })
  await expect(council.map(page).locator("canvas").first()).toBeVisible({ timeout: 60_000 })
}

// ---------------------------------------------------------------------------- ask the data

async function addPlaceholderKey(
  page: Page,
  type: (target: Locator, text: string) => Promise<void>
) {
  const dialog = page.getByRole("dialog", { name: "AI settings" })
  await expect(dialog).toBeVisible()
  await type(dialog.getByLabel("Anthropic API key"), PLACEHOLDER_KEY)
  return dialog
}

/** The model's draft card: the innermost block holding both the question and "Discard draft". */
const draftCard = (page: Page) =>
  page
    .locator("#main div")
    .filter({ has: page.getByRole("button", { name: "Discard draft" }) })
    .filter({ hasText: "Question:" })
    .last()

async function expectMockedDraft(page: Page) {
  const card = draftCard(page)
  await expect(card).toBeVisible({ timeout: 30_000 })
  await expect(card.getByText("AI-generated")).toBeVisible()
  await expect(card).toContainText("Mocked response for illustration.")
  await expect(page.getByLabel("SQL query")).toHaveValue(MOCK_SQL)
  return card
}

const resultRows = (page: Page) => page.getByText(/^\d+ rows? · \d+ ms$/)

test.beforeAll(() => ensureDirs())

test.describe("journeys (recorded)", () => {
  test("1. a decade of pokies revenue: statewide trends, the gap and the closures", async ({
    browser,
  }) => {
    const context = await recordingContext(browser)
    const page = await context.newPage()
    const tour = new Tour(page, walkthrough("decade-of-revenue"))
    const chart = figure(page, /^Net gambling revenue, by (financial year|month)$/)

    await page.goto("/statewide")
    await expect(h1(page)).toHaveText("Revenue, tax and machines across sixteen years")
    await settle(page)
    tour.markStart()

    await tour.caption(1)
    await tour.pause(1000)
    await tour.hover(page.getByText("Net gambling revenue, FY 2024/25").first(), 800)
    await tour.pause(1200)
    await tour.scrollTo(chart, { offset: 76, ms: 1200 })
    await expect(chart.getByRole("heading")).toHaveText("Net gambling revenue, by financial year")
    await tour.hover(chart.locator("svg text", { hasText: "’24–25" }).first(), 900)
    await tour.pause(1400)

    await tour.caption(2)
    const noRelease = chart.locator("svg text", { hasText: "No release" })
    await tour.hover(noRelease, 800)
    await tour.pause(700)
    // the hollow LGA marker sits in the band, below its label
    const band = await noRelease.boundingBox()
    if (band) await tour.glide(band.x + band.width / 2, band.y + 125, 700)
    await tour.pause(1800)
    await tour.hover(
      chart
        .getByRole("listitem")
        .filter({ hasText: "FY 2014/15 total from the LGA release" })
        .first(),
      800
    )
    await tour.pause(1600)

    await tour.caption(3)
    const covid = chart.locator("svg text", { hasText: "COVID-19" })
    await tour.hover(covid, 800)
    const covidBox = await covid.boundingBox()
    if (covidBox) await tour.glide(covidBox.x + covidBox.width / 2, covidBox.y + 220, 700)
    await tour.pause(2200)

    await tour.caption(4)
    await tour.click(chart.getByRole("button", { name: "Month", exact: true }))
    await expect(chart.getByRole("heading")).toHaveText("Net gambling revenue, by month")
    await tour.pause(800)
    const closures = chart.locator("svg text", { hasText: "Closures" })
    await tour.hover(closures, 900)
    const closuresBox = await closures.boundingBox()
    if (closuresBox) await tour.glide(closuresBox.x + closuresBox.width / 2, closuresBox.y + 250)
    await tour.pause(2200)

    await tour.caption(5)
    await tour.click(chart.getByRole("button", { name: "Real (2024/25)" }))
    const nominal = chart.getByRole("listitem").filter({ hasText: "Nominal dollars" }).first()
    await expect(nominal).toBeVisible()
    await tour.pause(700)
    await tour.hover(nominal, 800)
    await tour.pause(2000)
    await tour.click(chart.getByRole("button", { name: "Financial year", exact: true }))
    await expect(chart.getByRole("heading")).toHaveText("Net gambling revenue, by financial year")
    await tour.pause(2000)

    await tour.caption(6)
    const gapNote = page.getByText("FY 2014/15 is missing from the statewide series")
    await tour.scrollTo(gapNote, { offset: 200, ms: 1200 })
    await tour.hover(gapNote, 800)
    await tour.pause(2000)
    await tour.hover(page.getByText("COVID-19 closures in FY 2019/20"), 900)
    await tour.pause(2200)

    await tour.caption(7)
    await tour.scrollToY(0, 900)
    await tour.click(sections(page).getByRole("link", { name: "Analysis" }), { scroll: false })
    await expect(page).toHaveURL(/\/analysis$/)
    await settle(page)
    await tour.click(analysisNav(page).getByRole("link", { name: "Trends" }))
    await expect(page).toHaveURL(/\/analysis\/trends$/)
    await settle(page)
    const its = figure(page, "Interrupted time series of monthly NGR")
    await tour.scrollTo(its, { offset: 76, ms: 1300 })
    const level = its.getByText("+$9.3m (95% CI +$5.8m to +$12.8m)")
    await expect(level).toBeVisible()
    await tour.pause(1000)
    await tour.hover(its.getByText("Closures (left out)"), 800)
    await tour.pause(1200)
    await tour.hover(level, 900)
    await tour.pause(2600)

    await tour.caption(8)
    const paired = page.locator("#paired")
    await tour.scrollTo(paired, { offset: 90, ms: 1300 })
    const firstPair = page.getByText(/^FY 2018\/19 → FY 2020\/21, n = 12 months/)
    await expect(firstPair).toBeVisible()
    await tour.hover(firstPair, 800)
    await tour.pause(1600)
    await tour.hover(page.getByRole("columnheader", { name: "dz" }), 800)
    await tour.pause(2600)

    await finishRecording(context, page, tour)
  })

  test("2. where the machines are: the council map, then the funnel plot", async ({ browser }) => {
    const context = await recordingContext(browser)
    const page = await context.newPage()
    const tour = new Tour(page, walkthrough("where-the-machines-are"))

    await page.goto("/councils")
    await expect(h1(page)).toHaveText("Where gaming-machine revenue is spent, by council area")
    await councilMapReady(page)
    await settle(page)
    tour.markStart()

    await tour.caption(1)
    await tour.pause(1000)
    await tour.scrollTo(council.slider(page), { offset: 150, ms: 1200 })
    await tour.pause(800)
    await tour.hover(council.map(page), 900)
    await tour.pause(1200)
    await tour.hover(council.ranking(page).getByRole("button", { name: "Salisbury" }), 800)
    await tour.pause(1200)

    await tour.caption(2)
    await tour.click(
      page.getByRole("group", { name: "Measure" }).getByRole("button", { name: "Machines" })
    )
    await expect(page.getByRole("heading", { name: "Ranked by gaming machines" })).toBeVisible()
    await tour.pause(2200)

    await tour.caption(3)
    await tour.dragSlider(council.slider(page), council.track(page), [0, 0.55, 1])
    await expect(council.year(page)).toHaveText("FY 2024/25")
    await tour.pause(800)
    await tour.click(page.getByRole("button", { name: "Previous financial year" }))
    await expect(council.year(page)).toHaveText("FY 2023/24")
    await tour.pause(900)
    await tour.click(page.getByRole("button", { name: "Next financial year" }))
    await expect(council.year(page)).toHaveText("FY 2024/25")
    await tour.pause(1200)

    await tour.caption(4)
    await tour.hover(page.getByText("Combined group", { exact: true }), 900)
    await tour.pause(1200)
    const rankingBox = council.ranking(page).locator("xpath=..")
    const group = council
      .ranking(page)
      .getByRole("button", { name: /Combined group of/ })
      .first()
    await tour.scrollTo(council.map(page), { offset: 90, ms: 1000 })
    await tour.scrollInside(rankingBox, group, { offset: 220, ms: 1000 })
    await tour.click(group, { scroll: false })
    await expect(page.locator("#unit-history")).toBeAttached()
    await expect(
      page.locator("section").filter({ has: page.locator("#unit-history") })
    ).toContainText("CBS publishes councils with few venues as one combined row")
    await tour.hover(council.map(page), 900)
    await tour.pause(2400)

    await tour.caption(5)
    const salisbury = council.ranking(page).getByRole("button", { name: "Salisbury", exact: true })
    await tour.scrollInside(rankingBox, salisbury, { offset: 40, ms: 900 })
    await tour.click(salisbury, { scroll: false })
    const history = page.locator("section").filter({ has: page.locator("#unit-history") })
    await expect(page.locator("#unit-history")).toHaveText("Salisbury")
    await tour.hover(council.map(page), 800)
    await tour.pause(1400)
    await tour.scrollTo(history, { offset: 90, ms: 1200 })
    await tour.hover(history.locator("svg").last(), 900)
    await tour.pause(2200)

    await tour.caption(6)
    await tour.scrollToY(0, 900)
    await tour.click(sections(page).getByRole("link", { name: "Analysis" }), { scroll: false })
    await expect(page).toHaveURL(/\/analysis$/)
    await settle(page)
    await tour.click(analysisNav(page).getByRole("link", { name: "Councils" }))
    await expect(page).toHaveURL(/\/analysis\/councils$/)
    await settle(page)
    const funnel = figure(page, "NGR per machine by council area")
    await tour.scrollTo(funnel, { offset: 76, ms: 1300 })
    const stateLine = funnel.locator("svg text", { hasText: /^State \$/ })
    await expect(stateLine).toBeVisible()
    await tour.hover(stateLine, 900)
    await tour.pause(1600)
    await tour.hover(funnel.getByText(/^Above the 99\.8% limit/), 800)
    await tour.pause(1600)

    await tour.caption(7)
    const fySelect = funnel.getByRole("combobox")
    await tour.hover(fySelect, 800)
    await fySelect.selectOption("2018-19")
    await expect(fySelect).toHaveValue("2018-19")
    await tour.pause(1800)
    await tour.click(funnel.getByRole("button", { name: "Plus between-council spread" }))
    await expect(funnel.getByText(/^Limits also allow for the typical spread/)).toBeVisible()
    await tour.pause(800)
    await tour.hover(funnel.getByText(/^Limits also allow for the typical spread/), 800)
    await tour.pause(2400)

    await tour.caption(8)
    const persistent = page.locator("#persistent")
    await tour.scrollTo(persistent, { offset: 90, ms: 1300 })
    await tour.pause(1000)
    await tour.scrollTo(persistent, { offset: -260, ms: 1200 })
    await tour.pause(2800)

    await finishRecording(context, page, tour)
  })

  test("3. ask the data (mocked AI response), then data quality", async ({ browser }) => {
    test.setTimeout(10 * 60_000)
    const context = await recordingContext(browser)
    const ai = await mockAiProviders(context, { latencyMs: FAST ? 150 : 1400 })
    const page = await context.newPage()
    const tour = new Tour(page, walkthrough("ask-the-data"))
    const sql = page.getByLabel("SQL query")

    await page.goto("/ask")
    await expect(h1(page)).toHaveText("Query the tables yourself, with or without AI")
    await settle(page)
    tour.markStart()

    await tour.caption(1)
    await tour.pause(1000)
    await tour.hover(page.getByText("Read-only, three ways"), 800)
    await tour.pause(1400)
    await tour.hover(page.getByText("Your key stays with you"), 800)
    await tour.pause(1400)

    await tour.caption(2)
    await tour.scrollTo(page.locator("#sql-editor"), { offset: 90, ms: 1200 })
    await tour.hover(sql, 800)
    await tour.pause(900)
    await tour.click(page.getByRole("button", { name: "Run query" }), { scroll: false })
    await expect(resultRows(page)).toHaveText(/^16 rows · /)
    await tour.pause(600)
    await tour.scrollTo(resultRows(page), { offset: 260, ms: 1000 })
    await tour.hover(page.getByRole("table").first(), 800)
    await tour.pause(1800)

    await tour.caption(3)
    await tour.scrollTo(page.locator("#ask-ai"), { offset: 100, ms: 1200 })
    await tour.click(page.getByRole("button", { name: /^AI settings/ }))
    const dialog = page.getByRole("dialog", { name: "AI settings" })
    await expect(dialog).toBeVisible()
    await tour.pause(900)
    await tour.hover(dialog.getByRole("button", { name: "Anthropic", exact: true }), 700, {
      scroll: false,
    })
    await tour.pause(900)
    await tour.hover(dialog.getByText("Claude Haiku 4.5"), 700, { scroll: false })
    await tour.pause(1200)
    await tour.hover(dialog.getByText("Remember on this device"), 700, { scroll: false })
    await tour.pause(1600)

    await tour.caption(4)
    await addPlaceholderKey(page, (t, s) => tour.type(t, s))
    await tour.pause(600)
    await tour.click(dialog.getByRole("button", { name: "Save" }), { scroll: false })
    await expect(dialog.getByText("Saved. Anthropic will be used for AI features.")).toBeVisible()
    await tour.pause(1400)
    await page.keyboard.press("Escape")
    await expect(dialog).toBeHidden()
    await tour.pause(600)

    await tour.caption(5)
    await tour.click(page.getByRole("button", { name: MOCK_QUESTION }))
    await expect(page.getByLabel("Your question")).toHaveValue(MOCK_QUESTION)
    await tour.pause(600)
    await tour.click(page.getByRole("button", { name: "Draft SQL" }), { after: 0 })
    const card = await tour.idleWhile(() => expectMockedDraft(page))
    await tour.pause(500)
    await tour.hover(card.getByText("AI-generated"), 800)
    await tour.pause(1600)
    await tour.hover(card.getByText(/^Mocked response for illustration\./), 800)
    await tour.pause(2000)

    await tour.caption(6)
    await tour.scrollTo(page.locator("#sql-editor"), { offset: 90, ms: 1100 })
    await tour.hover(sql, 800)
    await tour.pause(1800)
    await tour.click(page.getByRole("button", { name: "Run query" }), { scroll: false })
    await expect(resultRows(page)).toHaveText(/^5 rows · /)
    await expect(page.getByText(/^AI-assisted· query drafted by/)).toBeVisible()
    await tour.pause(500)
    await tour.scrollTo(resultRows(page), { offset: 240, ms: 1000 })
    await tour.hover(page.getByText(/^AI-assisted· query drafted by/), 800)
    await tour.pause(1400)
    await tour.hover(page.getByRole("table").first(), 800)
    await tour.pause(1800)

    await tour.caption(7)
    await tour.scrollTo(card, { offset: 100, ms: 1000 })
    await expect(card.getByText("accepted", { exact: true })).toBeVisible()
    await tour.hover(card.getByText("accepted", { exact: true }), 700)
    await tour.pause(1000)
    await tour.click(card.getByRole("link", { name: "AI log" }))
    await expect(page).toHaveURL(/\/ai-log$/)
    await expect(page.getByText("Accepted", { exact: true }).first()).toBeVisible()
    await settle(page)
    await tour.hover(page.getByText("Accepted", { exact: true }).first(), 800)
    await tour.pause(1600)
    await tour.hover(page.getByRole("button", { name: "CSV" }), 700)
    await tour.pause(1600)

    await tour.caption(8)
    await tour.click(page.getByRole("button", { name: /^AI settings/ }))
    await expect(dialog).toBeVisible()
    await tour.pause(600)
    await tour.click(dialog.getByRole("button", { name: "Forget Anthropic key" }), {
      scroll: false,
    })
    await expect(dialog.getByText("The Anthropic key was removed from this browser.")).toBeVisible()
    await tour.pause(1800)
    await page.keyboard.press("Escape")
    await expect(dialog).toBeHidden()
    await tour.pause(500)

    await tour.caption(9)
    await tour.scrollToY(0, 600)
    await tour.click(sections(page).getByRole("link", { name: "Data quality" }), { scroll: false })
    await expect(page).toHaveURL(/\/data-quality$/)
    await settle(page)
    const crossCheck = page.locator("#cross-check")
    await tour.scrollTo(crossCheck, { offset: 90, ms: 1200 })
    await expect(page.getByText("1,011 of 1,013 values found")).toBeVisible()
    await tour.hover(page.getByText("900 of 900 values found"), 700)
    await tour.pause(900)
    await tour.hover(page.getByText("1,011 of 1,013 values found"), 700)
    await tour.pause(1200)
    await tour.hover(page.getByText("The exceptions", { exact: true }), 800)
    await tour.pause(2000)

    await tour.caption(10)
    const powerBi = page.locator("#power-bi")
    await tour.scrollTo(powerBi, { offset: 90, ms: 1300 })
    await tour.pause(1200)
    await tour.hover(powerBi, 800)
    await tour.pause(1200)
    await tour.scrollTo(powerBi, { offset: -200, ms: 1100 })
    await tour.pause(2600)

    expect(ai.calls).toBe(1)
    expect(ai.leaks, "the placeholder key must only go to the (mocked) provider").toEqual([])
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))
    expect(stored).not.toContain(PLACEHOLDER_KEY)

    await finishRecording(context, page, tour)
  })
})

async function desktop(browser: Browser, colorScheme: "light" | "dark" = "light") {
  return browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    colorScheme,
  })
}

async function mobile(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    colorScheme: "light",
  })
}

test.describe("screenshots", () => {
  test("landing, light and dark", async ({ browser }) => {
    for (const scheme of ["light", "dark"] as const) {
      const context = await desktop(browser, scheme)
      const page = await context.newPage()
      await page.goto("/")
      await expect(h1(page)).toHaveText("Sixteen years of gaming-machine statistics, in one place")
      await settle(page)
      await shot(page, `0${scheme === "light" ? 1 : 2}-landing-${scheme}`)
      await context.close()
    }
  })

  test("key features at 1440 × 900", async ({ browser }) => {
    test.setTimeout(10 * 60_000)
    const context = await desktop(browser)
    await mockAiProviders(context, { latencyMs: 0 })
    const page = await context.newPage()

    await page.goto("/statewide")
    await settle(page)
    const ngr = figure(page, "Net gambling revenue, by financial year")
    await shot(page, "03-statewide-ngr", { target: ngr, offset: 84 })

    await page.goto("/analysis/trends")
    await settle(page)
    await expect(page.getByText("+$9.3m (95% CI +$5.8m to +$12.8m)").first()).toBeVisible()
    await shot(page, "04-trends-its", {
      target: figure(page, "Interrupted time series of monthly NGR"),
      offset: 84,
    })

    await page.goto("/councils")
    await councilMapReady(page)
    await page
      .getByRole("group", { name: "Measure" })
      .getByRole("button", { name: "Machines" })
      .click()
    await expect(page.getByRole("heading", { name: "Ranked by gaming machines" })).toBeVisible()
    await settle(page)
    await page.waitForTimeout(1500)
    await shot(page, "05-councils-map", { target: council.slider(page), offset: 170 })

    await page.goto("/analysis/councils")
    await settle(page)
    await shot(page, "06-councils-funnel", {
      target: figure(page, "NGR per machine by council area"),
      offset: 84,
    })

    await page.goto("/analysis/concentration")
    await settle(page)
    await shot(page, "07-concentration-hhi", {
      target: figure(page, "Manufacturer concentration over time"),
      offset: 84,
    })

    await page.goto("/ask")
    await settle(page)
    await page.locator("#ask-ai").evaluate((el) => {
      window.scrollTo({
        top: el.getBoundingClientRect().top + window.scrollY - 84,
        behavior: "instant",
      })
    })
    await page.getByRole("button", { name: /^AI settings/ }).click()
    const dialog = page.getByRole("dialog", { name: "AI settings" })
    await expect(dialog).toBeVisible()
    await page.waitForTimeout(400)
    await shot(page, "08-ai-settings")
    await addPlaceholderKey(page, async (t, s) => t.fill(s))
    await dialog.getByRole("button", { name: "Save" }).click()
    await page.keyboard.press("Escape")
    await expect(dialog).toBeHidden()
    await page.getByRole("button", { name: MOCK_QUESTION }).click()
    await page.getByRole("button", { name: "Draft SQL" }).click()
    await expectMockedDraft(page)
    await page.getByRole("button", { name: "Run query" }).click()
    await expect(resultRows(page)).toHaveText(/^5 rows · /)
    await pinMockLabel(page)
    await shot(page, "09-ask-mocked-draft", { target: draftCard(page), offset: 140 })

    await page.goto("/ask/evaluation")
    await settle(page)
    await shot(page, "10-ask-evaluation")

    await page.goto("/data-quality")
    await settle(page)
    await shot(page, "11-data-quality", { target: page.locator("#cross-check"), offset: 84 })

    await page.goto("/methods")
    await settle(page)
    await shot(page, "12-methods")
    await context.close()
  })

  test("mobile at 390 × 844", async ({ browser }) => {
    test.setTimeout(5 * 60_000)
    const context = await mobile(browser)
    const page = await context.newPage()

    await page.goto("/")
    await settle(page)
    await shot(page, "13-mobile-landing")

    await page.goto("/statewide")
    await settle(page)
    await shot(page, "14-mobile-statewide", {
      target: figure(page, "Net gambling revenue, by financial year"),
      offset: 72,
    })

    await page.goto("/councils")
    await councilMapReady(page)
    await settle(page)
    await page.waitForTimeout(1500)
    await shot(page, "15-mobile-councils", { target: council.map(page), offset: 72 })
    await context.close()
  })
})
