/**
 * The guided tour: recorded walkthroughs and key-feature screenshots.
 *
 * One source of truth for the step captions. The Playwright tour (e2e/showcase.spec.ts) shows them
 * as on-screen captions and writes them to WebVTT files, the /tour page lists them under each
 * video, and the README's "Workflow walkthrough" repeats them (a unit test keeps the three in
 * step). The media are produced by `pnpm showcase` (tools/showcase.mjs).
 */

export type WalkthroughId = "decade-of-revenue" | "where-the-machines-are" | "ask-the-data"

export interface Walkthrough {
  id: WalkthroughId
  title: string
  /** Route the walkthrough starts on. */
  route: string
  summary: string
  /** What is fixed, so the recording can be reproduced by hand. */
  setup: string
  /** On-screen captions, in order (step k is shown as "k/N"). */
  steps: readonly string[]
  /** Step numbers (1-based) whose caption carries the "mocked AI response" badge. */
  mockedSteps?: readonly number[]
}

export const MOCK_LABEL = "Mocked AI response for illustration"

/** Opens every mocked model explanation, so the text itself says what it is. */
export const MOCK_ANSWER_PREFIX = "Mocked response for illustration."

export const WALKTHROUGHS: readonly Walkthrough[] = [
  {
    id: "decade-of-revenue",
    title: "A decade of pokies revenue",
    route: "/statewide",
    summary:
      "Statewide net gambling revenue from FY 2009/10 to FY 2024/25: the missing FY 2014/15 release and the 2020 COVID-19 closures marked and explained, nominal against real dollars, then the interrupted time series that estimates the break at reopening with its interval.",
    setup:
      "No input: the published CBS figures. Real dollars use the ABS Adelaide CPI (FY 2024/25 dollars); the interrupted time series is the primary specification (116 months, Newey–West intervals).",
    steps: [
      "Statewide: net gambling revenue for every financial year, FY 2009/10 to FY 2024/25",
      "FY 2014/15 has no statewide release: the hollow marker is the total from the LGA release",
      "FY 2019/20 is shaded: gaming rooms closed for COVID-19 from late March 2020",
      "By month: NGR falls to almost nothing from April to June 2020, then the series resumes",
      "Real dollars: deflated by the Adelaide CPI to FY 2024/25 dollars, nominal dashed alongside",
      "Both breaks are explained beside the chart rather than smoothed over",
      "Analysis: the interrupted time series puts the jump at reopening at +$9.3m a month, 95% CI +$5.8m to +$12.8m",
      "Paired months compare like-for-like years, with t and bootstrap intervals and effect sizes",
    ],
  },
  {
    id: "where-the-machines-are",
    title: "Where the machines are",
    route: "/councils",
    summary:
      "The council map and ranking by financial year, combined council groups kept whole, one area's history, then the funnel plot that asks which areas really differ from the state rate once their size is allowed for.",
    setup:
      "No input: the published CBS LGA releases, FY 2013/14 to FY 2024/25, on ABS 2024 council boundaries. Funnel limits use the pooled year-to-year scale; intervals are 95%.",
    steps: [
      "Councils: every area CBS published, on a map and in a ranked table",
      "Switch the measure to gaming machines in each council area",
      "Drag the year slider: the map and the ranking follow each year from FY 2013/14",
      "Small councils stay in their combined groups, outlined as one area and never split",
      "Select an area: it is highlighted on the map, with its history across the years",
      "Analysis: a funnel plot of NGR per machine against the state rate, by number of machines",
      "Change the year, then use limits that also allow for the spread between councils",
      "Each area's typical ratio to the state rate, with a 95% interval across its years",
    ],
  },
  {
    id: "ask-the-data",
    title: "Ask the data",
    route: "/ask",
    summary:
      "Read-only SQL over the eight tidy tables in the browser, then the optional bring-your-own-key text-to-SQL with the generated query shown before it runs (a mocked reply; no real key is used), the AI audit log, and the data-quality checks behind every figure.",
    setup:
      "SQL runs on sql.js in the browser. The AI steps use a placeholder key, and every request to the provider is intercepted and answered by a labelled mock.",
    steps: [
      "Ask the data: the eight tidy tables load into a read-only SQLite database in your browser",
      "No key is needed for SQL: run the starter query over the annual figures",
      "AI settings: bring your own Anthropic or OpenAI key; it stays in this browser",
      "For this demo: a placeholder key, never a real one; calls to the provider are intercepted",
      "Pick an example question and draft SQL: the reply is labelled AI-generated",
      "Check the drafted SQL, then run it yourself: the result is labelled AI-assisted",
      "The AI log records the call, the model and your decision, with JSON and CSV export",
      "Forget key: the placeholder is removed from this browser",
      "Data quality: 4,406 of 4,409 figures found in the CBS PDFs, with the exceptions listed",
      "The Power BI totals summed monthly snapshots; the site uses means and June values instead",
    ],
    mockedSteps: [4, 5, 6, 7],
  },
]

export interface Screenshot {
  /** File name without extension, e.g. "01-landing-light". */
  id: string
  title: string
  caption: string
  viewport: "desktop" | "mobile"
}

export const SCREENSHOTS: readonly Screenshot[] = [
  {
    id: "01-landing-light",
    title: "Landing page",
    caption: "Sixteen years of CBS releases in one place, with the headline figures.",
    viewport: "desktop",
  },
  {
    id: "02-landing-dark",
    title: "Landing page, dark mode",
    caption: "The same page in dark mode.",
    viewport: "desktop",
  },
  {
    id: "03-statewide-ngr",
    title: "Statewide trends",
    caption: "Annual NGR with the missing FY 2014/15 release and the 2020 closures marked.",
    viewport: "desktop",
  },
  {
    id: "04-trends-its",
    title: "The 2020 break, with intervals",
    caption: "Interrupted time series of monthly NGR with Newey–West intervals.",
    viewport: "desktop",
  },
  {
    id: "05-councils-map",
    title: "Council map",
    caption: "Machines by council area, combined groups kept whole, with the ranked table.",
    viewport: "desktop",
  },
  {
    id: "06-councils-funnel",
    title: "Funnel plot",
    caption: "NGR per machine against the state rate, with limits scaled by area size.",
    viewport: "desktop",
  },
  {
    id: "07-concentration-hhi",
    title: "Manufacturer concentration",
    caption: "Annual HHI with bootstrap intervals and the broken-stick change point.",
    viewport: "desktop",
  },
  {
    id: "08-ai-settings",
    title: "Bring your own key",
    caption: "AI settings: Anthropic by default, OpenAI optional; the key stays in this browser.",
    viewport: "desktop",
  },
  {
    id: "09-ask-mocked-draft",
    title: "Ask the data (mocked reply)",
    caption: "A mocked draft for illustration: the SQL is shown, labelled and run by you.",
    viewport: "desktop",
  },
  {
    id: "10-ask-evaluation",
    title: "Text-to-SQL evaluation",
    caption: "28 fixed questions, execution accuracy with intervals, paired comparisons.",
    viewport: "desktop",
  },
  {
    id: "11-data-quality",
    title: "Data quality",
    caption: "Every figure checked against its PDF; the exceptions and gaps listed.",
    viewport: "desktop",
  },
  {
    id: "12-methods",
    title: "Methods",
    caption: "Provenance, assumptions, limitations, decision records and the AI use statement.",
    viewport: "desktop",
  },
  {
    id: "13-mobile-landing",
    title: "Mobile: landing",
    caption: "The landing page at 390 px.",
    viewport: "mobile",
  },
  {
    id: "14-mobile-statewide",
    title: "Mobile: statewide",
    caption: "The NGR chart and its controls on a phone.",
    viewport: "mobile",
  },
  {
    id: "15-mobile-councils",
    title: "Mobile: councils",
    caption: "The council map on a phone.",
    viewport: "mobile",
  },
]

/** Public paths of a walkthrough's media (the files live in web/public/showcase/). */
export function walkthroughMedia(id: WalkthroughId) {
  return {
    mp4: `/showcase/${id}.mp4`,
    poster: `/showcase/${id}-poster.webp`,
    captions: `/showcase/${id}.vtt`,
  }
}

/** Public path of a screenshot's WebP copy, used by /tour. */
export const screenshotSrc = (id: string) => `/showcase/screens/${id}.webp`

/** Pixel size of the WebP copies (desktop 1440 × 900; mobile 390 × 844 at 1.5×). */
export const SCREENSHOT_SIZE = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 585, height: 1266 },
} as const

/** The mocked AI reply's query (tested against the allow-list and the data in showcase.test.ts). */
export const MOCK_SQL = `SELECT area, kind, machines, venues
FROM lga_published_areas
WHERE financial_year = '2024-25' AND machines IS NOT NULL
ORDER BY machines DESC
LIMIT 5`
