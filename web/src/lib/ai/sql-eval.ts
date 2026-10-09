import { bootstrap } from "../stats/bootstrap"
import { wilsonInterval, type Interval } from "../stats/intervals"
import { mcnemarExact } from "../stats/paired"
import { quantile } from "../stats/quantile"
import { DEFAULT_SEED } from "../stats/rng"

/**
 * Evaluation harness for "Ask the data". A fixed set of questions, each with a hand-written
 * reference query whose answer is checked against the site's own TypeScript figures in
 * sql.test.ts. A model's query passes when its result matches the reference result (execution
 * accuracy), so the score measures answers rather than SQL style. Eight questions can't be
 * answered from the tables; for those, a pass means the model said so instead of guessing. The
 * prompt's rule for declining is generic (it names no examples). Its opening sentence does state
 * the scope (South Australian gaming-machine statistics, FY 2009-10 to FY 2024-25), so the three
 * questions that lean on that sentence (another state, online betting, a forecast) are flagged and
 * the other five are reported separately as the cleaner test.
 *
 * Model output varies between calls (temperature can't be fixed on every model), so a run can
 * repeat the question set; each question then scores its pass rate across repeats. Questions stay
 * the unit for the intervals however many repeats there are (see `accuracy`).
 */

export type Category = "lookup" | "aggregate" | "domain-rule" | "abstain"

export interface GoldQuestion {
  id: string
  question: string
  /** Reference SQL (empty for abstain questions). */
  sql: string
  /** The order of the rows matters (rankings and ordered lists). */
  ordered: boolean
  category: Category
  /** What the question tests, shown on the evaluation page. */
  tests: string
  /**
   * For a question that should be declined: the part of the prompt that states the relevant scope.
   * Declining it is partly following that statement, so it is reported apart from the others.
   */
  scopeInPrompt?: string
}

export const CATEGORY_LABEL: Record<Category, string> = {
  lookup: "Look-up",
  aggregate: "Aggregate or join",
  "domain-rule": "Needs a domain rule",
  abstain: "Should decline",
}

export const GOLD_QUESTIONS: readonly GoldQuestion[] = [
  {
    id: "q01",
    category: "lookup",
    ordered: false,
    question: "What was total net gambling revenue in FY 2024-25, in $ million?",
    sql: "SELECT ngr_aud_million FROM statewide_annual WHERE financial_year = '2024-25'",
    tests: "Reading one value from the annual table.",
  },
  {
    id: "q02",
    category: "lookup",
    ordered: false,
    question: "In which month was net gambling revenue highest, and what was it in $ million?",
    sql: "SELECT month, ngr_aud_million FROM statewide_monthly ORDER BY ngr_aud_million DESC LIMIT 1",
    tests: "A maximum over months.",
  },
  {
    id: "q03",
    category: "lookup",
    ordered: false,
    question: "How many gaming machines were operating in hotels and clubs in June 2025?",
    sql: "SELECT machines FROM statewide_monthly WHERE month = '2025-06'",
    tests: "Month keys ('YYYY-MM').",
  },
  {
    id: "q04",
    category: "domain-rule",
    ordered: false,
    question:
      "What was the average number of gaming machines in hotels and clubs during FY 2018-19?",
    sql: "SELECT AVG(machines) FROM statewide_monthly WHERE financial_year = '2018-19'",
    tests: "Machines are a stock: a year's figure is a mean of months, not a sum.",
  },
  {
    id: "q05",
    category: "aggregate",
    ordered: false,
    question: "What fraction of net gambling revenue was gaming tax in FY 2009-10?",
    sql: "SELECT gaming_tax_aud_million / ngr_aud_million FROM statewide_annual WHERE financial_year = '2009-10'",
    tests: "A ratio of two annual flows.",
  },
  {
    id: "q06",
    category: "lookup",
    ordered: false,
    question: "Which council area had the highest net gambling revenue in FY 2024-25?",
    sql: "SELECT area FROM lga_published_areas WHERE financial_year = '2024-25' ORDER BY ngr_aud DESC LIMIT 1",
    tests: "A ranking in the council table.",
  },
  {
    id: "q07",
    category: "domain-rule",
    ordered: false,
    question: "How many combined council groups did CBS publish for FY 2024-25?",
    sql: "SELECT COUNT(*) FROM lga_published_areas WHERE financial_year = '2024-25' AND kind = 'group'",
    tests: "Combined groups are rows with kind = 'group'.",
  },
  {
    id: "q08",
    category: "aggregate",
    ordered: false,
    question:
      "What was net gambling revenue per gaming machine in the City of Adelaide council area in FY 2024-25, in dollars?",
    sql: "SELECT ngr_aud * 1.0 / machines FROM lga_published_areas WHERE financial_year = '2024-25' AND area = 'Adelaide'",
    tests: "A derived rate for one area.",
  },
  {
    id: "q09",
    category: "lookup",
    ordered: false,
    question: "How many manufacturers were listed in the June 2025 market report?",
    sql: "SELECT manufacturers_listed FROM manufacturer_concentration WHERE month = '2025-06'",
    tests: "A count that exists in two tables.",
  },
  {
    id: "q10",
    category: "lookup",
    ordered: false,
    question: "What fraction of gaming machines did Aristocrat supply in June 2025?",
    sql: "SELECT share_recomputed FROM manufacturers_monthly WHERE month = '2025-06' AND manufacturer = 'Aristocrat'",
    tests: "A share stored as a fraction.",
  },
  {
    id: "q11",
    category: "aggregate",
    ordered: false,
    question:
      "What was the mean monthly Herfindahl-Hirschman index (HHI) of manufacturer concentration in FY 2024-25?",
    sql: "SELECT AVG(hhi) FROM manufacturer_concentration WHERE financial_year = '2024-25'",
    tests: "A mean over the months of one year.",
  },
  {
    id: "q12",
    category: "lookup",
    ordered: false,
    question: "In which month was manufacturer concentration (HHI) lowest?",
    sql: "SELECT month FROM manufacturer_concentration ORDER BY hhi ASC LIMIT 1",
    tests: "A minimum over months.",
  },
  {
    id: "q13",
    category: "domain-rule",
    ordered: false,
    question: "How many gaming machine entitlements did hotels hold at the end of FY 2024-25?",
    sql: "SELECT entitlements_held_end_of_year FROM licences_annual WHERE financial_year = '2024-25' AND category = 'Hotels'",
    tests: "An end-of-year snapshot, not a sum of months.",
  },
  {
    id: "q14",
    category: "aggregate",
    ordered: false,
    question:
      "How many live gaming machines were there across all licence categories in June 2025?",
    sql: "SELECT SUM(live_machines) FROM licences_monthly WHERE month = '2025-06'",
    tests: "Adding categories within one month (which is allowed).",
  },
  {
    id: "q15",
    category: "domain-rule",
    ordered: false,
    question:
      "Which financial year had the largest increase in net gambling revenue over the previous financial year?",
    sql: "SELECT financial_year FROM (SELECT financial_year, ngr_aud_million - LAG(ngr_aud_million) OVER (ORDER BY financial_year) AS change FROM statewide_annual) WHERE change IS NOT NULL ORDER BY change DESC LIMIT 1",
    tests: "A year-on-year change with a missing year in the series.",
  },
  {
    id: "q16",
    category: "lookup",
    ordered: false,
    question: "What was FY 2009-10 net gambling revenue in FY 2024-25 dollars, in $ million?",
    sql: "SELECT ngr_aud_million_real_fy2024_25 FROM statewide_annual WHERE financial_year = '2009-10'",
    tests: "Finding the real-terms column.",
  },
  {
    id: "q17",
    category: "aggregate",
    ordered: false,
    question:
      "How many council names in the crosswalk were matched because the council was renamed?",
    sql: "SELECT COUNT(*) FROM lga_crosswalk WHERE relation = 'renamed'",
    tests: "A filter on a coded column.",
  },
  {
    id: "q18",
    category: "domain-rule",
    ordered: false,
    question: "In how many months of FY 2019-20 did CBS report zero gaming machines?",
    sql: "SELECT COUNT(*) FROM statewide_monthly WHERE financial_year = '2019-20' AND machines = 0",
    tests: "The COVID-19 closure months.",
  },
  {
    id: "q19",
    category: "aggregate",
    ordered: false,
    question:
      "Which council area had the highest net gambling revenue per gaming machine in FY 2024-25?",
    sql: "SELECT area FROM lga_published_areas WHERE financial_year = '2024-25' AND machines > 0 ORDER BY ngr_aud * 1.0 / machines DESC LIMIT 1",
    tests: "Ranking by a derived rate.",
  },
  {
    id: "q20",
    category: "aggregate",
    ordered: true,
    question:
      "List total net gambling revenue in $ million for each financial year from FY 2020-21 to FY 2024-25, earliest first.",
    sql: "SELECT financial_year, ngr_aud_million FROM statewide_annual WHERE financial_year BETWEEN '2020-21' AND '2024-25' ORDER BY financial_year",
    tests: "An ordered list.",
  },
  {
    id: "a01",
    category: "abstain",
    ordered: false,
    question: "Which individual hotel or club had the highest net gambling revenue in FY 2024-25?",
    sql: "",
    tests: "There is no venue-level data: the model should decline.",
  },
  {
    id: "a02",
    category: "abstain",
    ordered: false,
    question:
      "How much net gambling revenue did the Adelaide Casino's gaming machines make in FY 2024-25?",
    sql: "",
    tests: "The revenue series exclude the casino: the model should decline.",
  },
  {
    id: "a03",
    category: "abstain",
    ordered: false,
    question: "What will net gambling revenue be in FY 2026-27?",
    sql: "",
    tests: "A forecast is outside the data: the model should decline.",
    scopeInPrompt: "The prompt states the years the data cover (FY 2009-10 to FY 2024-25).",
  },
  {
    id: "a04",
    category: "abstain",
    ordered: false,
    question: "Which suburb had the highest net gambling revenue in FY 2024-25?",
    sql: "",
    tests: "The finest geography is the council area: the model should decline.",
  },
  {
    id: "a05",
    category: "abstain",
    ordered: false,
    question: "What share of South Australian adults were problem gamblers in FY 2024-25?",
    sql: "",
    tests: "Gambling harm is not measured in these data: the model should decline.",
  },
  {
    id: "a06",
    category: "abstain",
    ordered: false,
    question: "What was net gambling revenue from gaming machines in Victoria in FY 2024-25?",
    sql: "",
    tests: "Only South Australia is covered: the model should decline.",
    scopeInPrompt: "The prompt says the data are South Australian.",
  },
  {
    id: "a07",
    category: "abstain",
    ordered: false,
    question: "How much did South Australians lose on online sports betting in FY 2024-25?",
    sql: "",
    tests: "Only gaming machines are covered: the model should decline.",
    scopeInPrompt: "The prompt says the data are gaming-machine statistics.",
  },
  {
    id: "a08",
    category: "abstain",
    ordered: false,
    question: "What was the average age of people who played gaming machines in FY 2024-25?",
    sql: "",
    tests: "There is nothing about players: the model should decline.",
  },
]

/** Questions to decline whose scope the prompt does not state: the cleaner test of abstention. */
export function unpromptedAbstain(q: Pick<GoldQuestion, "category" | "scopeInPrompt">): boolean {
  return q.category === "abstain" && !q.scopeInPrompt
}

export type Cell = string | number | null

export interface ResultTable {
  columns: string[]
  rows: Cell[][]
}

/**
 * Cell comparison key. Whole numbers compare exactly; other numbers to four significant figures
 * (enough to absorb rounding in the stored tables, e.g. 0.3876 against 0.387551); text is trimmed.
 */
export function cellKey(v: Cell | undefined): string {
  if (v === null || v === undefined) return "null"
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return `n:${v}`
    if (Number.isInteger(v)) return `n:${v}`
    return `n:${Number(v.toPrecision(4))}`
  }
  return `s:${String(v).trim()}`
}

export interface Comparison {
  /** Every reference column is present with the same rows (extra columns allowed). */
  lenient: boolean
  /** As lenient, and no extra columns. */
  strict: boolean
  reason: string
}

/**
 * Execution-accuracy comparison. Columns are matched by their values, not their names, so aliases
 * don't matter. Unordered questions compare the multiset of row tuples.
 */
export function compareResults(
  expected: ResultTable,
  actual: ResultTable,
  ordered: boolean
): Comparison {
  const n = expected.rows.length
  if (actual.rows.length !== n) {
    return {
      lenient: false,
      strict: false,
      reason: `returned ${actual.rows.length} row(s), expected ${n}`,
    }
  }
  const ek = expected.rows.map((r) => r.map(cellKey))
  const ak = actual.rows.map((r) => r.map(cellKey))
  const colSig = (rows: string[][], j: number) => {
    const col = rows.map((r) => r[j])
    return (ordered ? col : [...col].sort()).join("\u0001")
  }
  const eCols = expected.columns.length
  const aCols = actual.columns.length
  const candidates = Array.from({ length: eCols }, (_, j) => {
    const sig = colSig(ek, j)
    return Array.from({ length: aCols }, (_, k) => k).filter((k) => colSig(ak, k) === sig)
  })
  const missing = candidates.findIndex((c) => c.length === 0)
  if (missing >= 0) {
    return {
      lenient: false,
      strict: false,
      reason: `no column matches reference column ${missing + 1} (${expected.columns[missing]})`,
    }
  }
  const joinRows = (rows: string[][]) => {
    const r = rows.map((x) => x.join("\u0002"))
    return (ordered ? r : r.sort()).join("\u0003")
  }
  const expectedRows = joinRows(ek)
  const used = new Set<number>()
  const pick: number[] = []
  const search = (j: number): boolean => {
    if (j === eCols) return joinRows(ak.map((r) => pick.map((k) => r[k]))) === expectedRows
    for (const k of candidates[j]) {
      if (used.has(k)) continue
      used.add(k)
      pick.push(k)
      if (search(j + 1)) return true
      pick.pop()
      used.delete(k)
    }
    return false
  }
  if (!search(0)) {
    return { lenient: false, strict: false, reason: "the rows do not match the reference" }
  }
  const strict = aCols === eCols
  return {
    lenient: true,
    strict,
    reason: strict ? "exact match" : `match with ${aCols - eCols} extra column(s)`,
  }
}

export type Outcome =
  | "pass"
  | "wrong_result"
  | "declined"
  | "answered_unanswerable"
  | "rejected_by_guard"
  | "sql_error"
  | "invalid_output"
  | "provider_error"

export const OUTCOME_LABEL: Record<Outcome, string> = {
  pass: "Pass",
  wrong_result: "Wrong result",
  declined: "Declined an answerable question",
  answered_unanswerable: "Answered an unanswerable question",
  rejected_by_guard: "Rejected by the allow-list",
  sql_error: "SQL error",
  invalid_output: "Invalid output",
  provider_error: "Provider error",
}

export interface EvalItemResult {
  id: string
  category: Category
  outcome: Outcome
  lenient: boolean
  strict: boolean
  detail: string
  sql: string | null
  latencyMs: number | null
  inputTokens: number | null
  outputTokens: number | null
  cachedInputTokens: number | null
  /** Input tokens written to the prompt cache (absent in older runs). */
  cacheWriteTokens?: number | null
  auditId: string | null
  /** The model the provider reports it used (a refusal fallback can differ from the run's model). */
  answeredBy: string | null
  /** Which pass over the question set this attempt belongs to (0-based; absent in older runs). */
  repeat?: number
}

export interface EvalRun {
  id: string
  startedAt: string
  finishedAt: string | null
  provider: string
  model: string
  variant: string
  items: EvalItemResult[]
  seed: number
  /** How many times the question set was asked (1 when absent). */
  repeats?: number
  /** SHA-256 of the system prompt and output schema every question in the run was given. */
  promptSha256?: string | null
  /** The site build (short commit) that ran it. */
  appVersion?: string
}

/**
 * passes is the sum of the questions' pass rates (a whole number with one repeat), and the interval
 * is Wilson's on passes out of n questions whatever the number of repeats. Questions, not attempts,
 * are the independent units: asking the same questions again says nothing new about questions the
 * set doesn't contain, so it must not narrow the interval. A pass rate lies in [0, 1], so its
 * variance is at most p(1 − p) and the binomial interval is conservative for the mean pass rate.
 * (A bootstrap over questions would collapse to zero width when every question in a category
 * always passes or always fails.)
 */
export type Accuracy = Interval & { n: number; passes: number }

export interface RepeatSpread {
  /** Lenient accuracy of each repeat over the questions it answered. */
  perRepeat: number[]
  min: number
  max: number
  /** Questions whose pass/fail result differed between repeats. */
  mixed: number
}

export interface RunSummary {
  /** Questions (attempts are n × repeats). */
  n: number
  attempts: number
  repeats: number
  lenient: Accuracy
  strict: Accuracy
  /** Lenient accuracy on the answerable questions, and the abstention rate on the others. */
  answerable: Accuracy
  abstention: Accuracy
  /** Abstention on the questions whose scope the prompt does not state. */
  abstentionUnprompted: Accuracy
  /** Leaving out provider errors (overloaded, truncated, ...), which say nothing about the SQL. */
  excludingProviderErrors: Accuracy
  byCategory: { category: Category; n: number; passes: number; ci: Interval }[]
  /** Counts over attempts. */
  outcomes: Record<Outcome, number>
  answeredBy: string[]
  medianLatencyMs: number | null
  inputTokens: number
  outputTokens: number
  cachedInputTokens: number
  cacheWriteTokens: number
  /** Run-to-run variation; null with a single repeat. */
  spread: RepeatSpread | null
}

const GOLD_BY_ID = new Map(GOLD_QUESTIONS.map((q) => [q.id, q]))

interface QuestionScore {
  id: string
  category: Category
  attempts: number
  lenient: number
  strict: number
}

/** Per-question pass rates across repeats, in first-seen order. */
export function questionScores(
  items: readonly EvalItemResult[],
  keep: (i: EvalItemResult) => boolean = () => true
): QuestionScore[] {
  const by = new Map<string, QuestionScore>()
  for (const i of items) {
    if (!keep(i)) continue
    const s = by.get(i.id) ?? { id: i.id, category: i.category, attempts: 0, lenient: 0, strict: 0 }
    s.attempts++
    if (i.lenient) s.lenient++
    if (i.strict) s.strict++
    by.set(i.id, s)
  }
  return [...by.values()].map((s) => ({
    ...s,
    lenient: s.lenient / s.attempts,
    strict: s.strict / s.attempts,
  }))
}

function accuracy(scores: readonly QuestionScore[], rate: (s: QuestionScore) => number): Accuracy {
  const n = scores.length
  // a sum of rates in [0, 1] can't exceed n, but guard against floating-point drift
  const passes = Math.min(
    n,
    scores.reduce((s, q) => s + rate(q), 0)
  )
  return { ...wilsonInterval(passes, n), n, passes }
}

export function summariseRun(items: readonly EvalItemResult[]): RunSummary {
  const outcomes = Object.fromEntries(
    (Object.keys(OUTCOME_LABEL) as Outcome[]).map((o) => [o, 0])
  ) as Record<Outcome, number>
  for (const i of items) outcomes[i.outcome]++
  const lat = items.map((i) => i.latencyMs).filter((v): v is number => v !== null)
  const categories: Category[] = ["lookup", "aggregate", "domain-rule", "abstain"]
  const scores = questionScores(items)
  const repeats = Math.max(1, ...scores.map((s) => s.attempts))
  const isUnprompted = (s: QuestionScore) =>
    s.category === "abstain" && !GOLD_BY_ID.get(s.id)?.scopeInPrompt
  const repeatIds = [...new Set(items.map((i) => i.repeat ?? 0))].sort((a, b) => a - b)
  const perRepeat = repeatIds.map((r) => {
    const its = items.filter((i) => (i.repeat ?? 0) === r)
    return its.filter((i) => i.lenient).length / its.length
  })
  return {
    n: scores.length,
    attempts: items.length,
    repeats,
    lenient: accuracy(scores, (s) => s.lenient),
    strict: accuracy(scores, (s) => s.strict),
    answerable: accuracy(
      scores.filter((s) => s.category !== "abstain"),
      (s) => s.lenient
    ),
    abstention: accuracy(
      scores.filter((s) => s.category === "abstain"),
      (s) => s.lenient
    ),
    abstentionUnprompted: accuracy(scores.filter(isUnprompted), (s) => s.lenient),
    excludingProviderErrors: accuracy(
      questionScores(items, (i) => i.outcome !== "provider_error"),
      (s) => s.lenient
    ),
    byCategory: categories.map((category) => {
      const a = accuracy(
        scores.filter((s) => s.category === category),
        (s) => s.lenient
      )
      return {
        category,
        n: a.n,
        passes: a.passes,
        ci: { estimate: a.estimate, lower: a.lower, upper: a.upper },
      }
    }),
    outcomes,
    answeredBy: [...new Set(items.map((i) => i.answeredBy).filter((m): m is string => !!m))].sort(),
    medianLatencyMs: lat.length ? quantile(lat, 0.5) : null,
    inputTokens: items.reduce((s, i) => s + (i.inputTokens ?? 0), 0),
    outputTokens: items.reduce((s, i) => s + (i.outputTokens ?? 0), 0),
    cachedInputTokens: items.reduce((s, i) => s + (i.cachedInputTokens ?? 0), 0),
    cacheWriteTokens: items.reduce((s, i) => s + (i.cacheWriteTokens ?? 0), 0),
    spread:
      repeatIds.length > 1
        ? {
            perRepeat,
            min: Math.min(...perRepeat),
            max: Math.max(...perRepeat),
            mixed: scores.filter((s) => s.lenient > 0 && s.lenient < 1).length,
          }
        : null,
  }
}

export interface PairedRunComparison {
  /** Questions both runs answered. */
  n: number
  /** Discordance counts and McNemar's exact test: only when both runs asked each question once. */
  bothPass: number | null
  onlyA: number | null
  onlyB: number | null
  neither: number | null
  /**
   * Mean over questions of (pass rate in A − pass rate in B), with a paired bootstrap interval over
   * questions. With one repeat each, the rates are 0 or 1 and this is the accuracy difference.
   */
  difference: Interval & { B: number; seed: number }
  mcnemarP: number | null
  repeats: [number, number]
}

/** Paired comparison of two runs on the same questions (lenient execution accuracy). */
export function compareRuns(
  a: readonly EvalItemResult[],
  b: readonly EvalItemResult[],
  seed = DEFAULT_SEED
): PairedRunComparison {
  const sa = questionScores(a)
  const sb = new Map(questionScores(b).map((s) => [s.id, s]))
  const both = sa.filter((s) => sb.has(s.id))
  const pairs = both.map((s) => [s.lenient, sb.get(s.id)!.lenient] as const)
  const n = pairs.length
  const repeats: [number, number] = [
    Math.max(1, ...sa.map((s) => s.attempts)),
    Math.max(1, ...[...sb.values()].map((s) => s.attempts)),
  ]
  const binary = repeats[0] === 1 && repeats[1] === 1
  const count = (f: (x: number, y: number) => boolean) =>
    binary ? pairs.filter(([x, y]) => f(x, y)).length : null
  const onlyA = count((x, y) => x === 1 && y === 0)
  const onlyB = count((x, y) => x === 0 && y === 1)
  const bothPass = count((x, y) => x === 1 && y === 1)
  const B = 4000
  const diff = bootstrap(
    n,
    (w) => {
      let s = 0
      let m = 0
      pairs.forEach(([x, y], i) => {
        s += w[i] * (x - y)
        m += w[i]
      })
      return s / m
    },
    { B, seed }
  )
  return {
    n,
    bothPass,
    onlyA,
    onlyB,
    neither: binary ? n - bothPass! - onlyA! - onlyB! : null,
    difference: { estimate: diff.estimate, lower: diff.lower, upper: diff.upper, B, seed },
    mcnemarP: binary ? mcnemarExact(onlyA!, onlyB!) : null,
    repeats,
  }
}

/** One row per question for the CSV export of a run. */
export function runToRows(run: EvalRun) {
  return run.items.map((i) => ({
    run_id: run.id,
    started_at: run.startedAt,
    provider: run.provider,
    model: run.model,
    answered_by: i.answeredBy ?? "",
    prompt_variant: run.variant,
    prompt_sha256: run.promptSha256 ?? "",
    app_version: run.appVersion ?? "",
    repeat: (i.repeat ?? 0) + 1,
    question_id: i.id,
    category: i.category,
    outcome: i.outcome,
    pass_lenient: i.lenient,
    pass_strict: i.strict,
    detail: i.detail,
    sql: i.sql ?? "",
    latency_ms: i.latencyMs,
    input_tokens: i.inputTokens,
    output_tokens: i.outputTokens,
    audit_id: i.auditId ?? "",
  }))
}

export interface Attempt {
  /** The model's validated answer, or null when the call failed. */
  answer: { answerable: boolean; sql: string } | null
  /** The failure kind when the call failed ("invalid_output" or a provider error kind). */
  errorKind?: string | null
  errorDetail?: string | null
}

/**
 * Score one attempt. `run` executes SQL through the same guard and engine as the Ask page and
 * throws an error with kind "rejected" when the allow-list refuses the query.
 */
export async function scoreAttempt(
  q: GoldQuestion,
  attempt: Attempt,
  run: (sql: string) => Promise<ResultTable>,
  reference: ResultTable | null
): Promise<Pick<EvalItemResult, "outcome" | "lenient" | "strict" | "detail">> {
  const fail = (outcome: Outcome, detail: string) => ({
    outcome,
    lenient: false,
    strict: false,
    detail,
  })
  if (!attempt.answer) {
    return attempt.errorKind === "invalid_output"
      ? fail("invalid_output", attempt.errorDetail ?? "The answer did not match the schema.")
      : fail("provider_error", attempt.errorDetail ?? attempt.errorKind ?? "The call failed.")
  }
  if (q.category === "abstain") {
    return attempt.answer.answerable
      ? fail("answered_unanswerable", "Wrote a query for a question the tables can't answer.")
      : { outcome: "pass", lenient: true, strict: true, detail: "Declined, as expected." }
  }
  if (!attempt.answer.answerable) return fail("declined", "Said the question can't be answered.")
  let actual: ResultTable
  try {
    actual = await run(attempt.answer.sql)
  } catch (e) {
    const kind = (e as { kind?: string }).kind
    const msg = e instanceof Error ? e.message : String(e)
    return kind === "rejected" ? fail("rejected_by_guard", msg) : fail("sql_error", msg)
  }
  if (!reference) return fail("sql_error", "The reference query did not run.")
  const c = compareResults(reference, actual, q.ordered)
  return c.lenient
    ? { outcome: "pass", lenient: true, strict: c.strict, detail: c.reason }
    : fail("wrong_result", c.reason)
}
