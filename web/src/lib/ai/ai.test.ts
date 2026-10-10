import "fake-indexeddb/auto"

import { IDBFactory } from "fake-indexeddb"
import { describe, expect, it } from "vitest"

import { wilsonInterval } from "../stats/intervals"
import { anthropicStructured } from "./anthropic"
import { auditToCsv, auditToJson } from "./audit-export"
import { indexedDbAuditStore, redactSecrets, withDecision } from "./audit-log"
import { generateStructured, runAudited } from "./client"
import { AiError, kindFromStatus, scrubKey } from "./errors"
import {
  activeModel,
  ANTHROPIC_MODELS,
  anthropicModel,
  DEFAULT_SETTINGS,
  estimateCostUsd,
} from "./models"
import { OPENAI_URL, openaiStructured } from "./openai"
import { promptSha256 } from "./prompt-fingerprint"
import { createAiStore, KEY_PREFIX, memoryStorage, SETTINGS_KEY } from "./settings"
import { buildSqlRequest, SqlAnswerSchema, SQL_FEATURE } from "./sql-assistant"
import {
  cellKey,
  compareResults,
  compareRuns,
  GOLD_QUESTIONS,
  runToRows,
  summariseRun,
  unpromptedAbstain,
  type EvalItemResult,
} from "./sql-eval"
import type { AiSettings, StructuredRequest } from "./types"

const KEY = "fake-anthropic-key-for-tests-0123456789"
const REQ: StructuredRequest = {
  system: "system prompt",
  user: "Question: how much?",
  jsonSchema: { type: "object", properties: {}, additionalProperties: false },
  schemaName: "answer",
}

interface Captured {
  url: string
  headers: Headers
  body: Record<string, unknown>
}

function mockFetch(status: number, body: unknown, captured: Captured[] = []): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
    captured.push({
      url,
      headers: new Headers(init?.headers),
      body: JSON.parse(String(init?.body ?? "{}")),
    })
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json", "request-id": "req_test" },
    })
  }) as typeof fetch
}

function message(text: string, extra: Record<string, unknown> = {}) {
  return {
    id: "msg_1",
    type: "message",
    role: "assistant",
    model: "claude-haiku-4-5",
    content: [{ type: "text", text }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: {
      input_tokens: 100,
      output_tokens: 20,
      cache_read_input_tokens: 400,
      cache_creation_input_tokens: 0,
    },
    ...extra,
  }
}

describe("Anthropic adapter (fetch mocked)", () => {
  it("calls the Messages API from the browser with structured output", async () => {
    const calls: Captured[] = []
    const r = await anthropicStructured(KEY, "claude-haiku-4-5", REQ, {
      fetch: mockFetch(200, message('{"ok":true}'), calls),
      maxRetries: 0,
    })
    expect(r.text).toBe('{"ok":true}')
    expect(r.usage).toEqual({
      inputTokens: 500,
      outputTokens: 20,
      cachedInputTokens: 400,
      cacheWriteInputTokens: 0,
    })
    const c = calls[0]
    expect(c.url).toMatch(/\/v1\/messages/)
    expect(c.headers.get("anthropic-dangerous-direct-browser-access")).toBe("true")
    expect(c.headers.get("x-api-key")).toBe(KEY)
    expect(c.body.model).toBe("claude-haiku-4-5")
    expect(c.body.temperature).toBe(0)
    expect(c.body.output_config).toEqual({
      format: { type: "json_schema", schema: REQ.jsonSchema },
    })
    // the breakpoint sits on the shared system prompt, not after the question
    expect(c.body.system).toEqual([
      { type: "text", text: "system prompt", cache_control: { type: "ephemeral" } },
    ])
    expect(c.body.cache_control).toBeUndefined()
  })

  it("opts Claude Sonnet 5.5 into server-side fallbacks at low effort", async () => {
    const calls: Captured[] = []
    await anthropicStructured(KEY, "claude-sonnet-5-5", REQ, {
      fetch: mockFetch(200, message("{}", { model: "claude-sonnet-5-5" }), calls),
      maxRetries: 0,
    })
    const c = calls[0]
    expect(c.headers.get("anthropic-beta")).toContain("server-side-fallback-2026-07-01")
    expect(c.body.fallbacks).toBe("default")
    expect(c.body.temperature).toBeUndefined()
    expect((c.body.output_config as { effort?: string }).effort).toBe("low")
  })

  it("maps refusals, truncation and HTTP errors without echoing the key", async () => {
    const run = (status: number, body: unknown) =>
      anthropicStructured(KEY, "claude-haiku-4-5", REQ, {
        fetch: mockFetch(status, body),
        maxRetries: 0,
      }).catch((e: AiError) => e)
    const refused = (await run(200, message("", { stop_reason: "refusal" }))) as AiError
    expect(refused.kind).toBe("refusal")
    // an unusable answer is still billed: the tokens travel with the error
    expect(refused.usage).toMatchObject({
      inputTokens: 500,
      outputTokens: 20,
      cachedInputTokens: 400,
    })
    expect(refused.model).toBe("claude-haiku-4-5")
    const cut = (await run(200, message("{", { stop_reason: "max_tokens" }))) as AiError
    expect(cut.kind).toBe("truncated")
    expect(cut.usage?.outputTokens).toBe(20)
    const bad = (await run(401, {
      type: "error",
      error: { type: "authentication_error", message: `invalid x-api-key ${KEY}` },
    })) as AiError
    expect(bad.kind).toBe("invalid_key")
    expect(bad.detail).not.toContain(KEY)
    // the provider's sentence, not the SDK's "401 {json}" wrapper
    expect(bad.detail).toBe("invalid x-api-key [redacted]")
    expect(
      (
        (await run(429, {
          type: "error",
          error: { type: "rate_limit_error", message: "slow" },
        })) as AiError
      ).kind
    ).toBe("rate_limit")
    expect(
      (
        (await run(529, {
          type: "error",
          error: { type: "overloaded_error", message: "busy" },
        })) as AiError
      ).kind
    ).toBe("overloaded")
  })

  it("reports a blocked request (CORS or offline) as a network error", async () => {
    const failing = (async () => {
      throw new TypeError("Failed to fetch")
    }) as typeof fetch
    const e = (await anthropicStructured(KEY, "claude-haiku-4-5", REQ, {
      fetch: failing,
      maxRetries: 0,
    }).catch((x) => x)) as AiError
    expect(e).toBeInstanceOf(AiError)
    expect(e.kind).toBe("network")
  })
})

describe("OpenAI adapter (fetch mocked)", () => {
  const completion = (content: string, extra: Record<string, unknown> = {}) => ({
    model: "gpt-5-mini-2026",
    choices: [{ message: { content }, finish_reason: "stop", ...extra }],
    usage: {
      prompt_tokens: 50,
      completion_tokens: 10,
      prompt_tokens_details: { cached_tokens: 0 },
    },
  })

  it("posts a json_schema response format with the bearer key", async () => {
    const calls: Captured[] = []
    const r = await openaiStructured("fake-openai-key-for-tests-123456", "gpt-5-mini", REQ, {
      fetch: mockFetch(200, completion('{"a":1}'), calls),
    })
    expect(calls[0].url).toBe(OPENAI_URL)
    expect(calls[0].headers.get("authorization")).toBe("Bearer fake-openai-key-for-tests-123456")
    expect(calls[0].body.response_format).toMatchObject({
      type: "json_schema",
      json_schema: { name: "answer", strict: true },
    })
    expect(r.model).toBe("gpt-5-mini-2026")
    expect(r.usage?.inputTokens).toBe(50)
  })

  it("maps quota, refusal and length errors", async () => {
    const run = (status: number, body: unknown) =>
      openaiStructured("fake-openai-key-for-tests-123456", "gpt-5-mini", REQ, {
        fetch: mockFetch(status, body),
      }).catch((e: AiError) => e)
    expect(
      ((await run(429, { error: { code: "insufficient_quota", message: "quota" } })) as AiError)
        .kind
    ).toBe("rate_limit")
    expect(((await run(404, { error: { message: "no model" } })) as AiError).kind).toBe(
      "bad_request"
    )
    const refused = completion("", {})
    refused.choices[0] = { message: { content: "", refusal: "no" }, finish_reason: "stop" } as never
    const r = (await run(200, refused)) as AiError
    expect(r.kind).toBe("refusal")
    expect(r.usage).toEqual({ inputTokens: 50, outputTokens: 10, cachedInputTokens: 0 })
    expect(r.model).toBe("gpt-5-mini-2026")
    const filtered = (await run(
      200,
      completion("", { finish_reason: "content_filter" })
    )) as AiError
    expect(filtered.kind).toBe("refusal")
    expect(filtered.usage?.inputTokens).toBe(50)
    const cut = (await run(200, completion("{", { finish_reason: "length" }))) as AiError
    expect(cut.kind).toBe("truncated")
    expect(cut.usage?.outputTokens).toBe(10)
  })
})

describe("errors and models", () => {
  it("classifies HTTP statuses and scrubs keys", () => {
    expect(kindFromStatus(403)).toBe("permission")
    expect(kindFromStatus(500)).toBe("server")
    expect(kindFromStatus(418)).toBe("unknown")
    expect(scrubKey(`bad ${KEY}`, KEY)).toBe("bad [redacted]")
    expect(scrubKey("short", "abc")).toBe("short")
  })

  it("defaults to the cheapest Claude model and prices tokens", () => {
    expect(DEFAULT_SETTINGS.provider).toBe("anthropic")
    expect(ANTHROPIC_MODELS[0].id).toBe("claude-haiku-4-5")
    expect(anthropicModel("unknown").id).toBe("claude-haiku-4-5")
    expect(activeModel({ ...DEFAULT_SETTINGS, provider: "openai", openaiModel: " " })).toBe(
      "gpt-5-mini"
    )
    expect(estimateCostUsd("claude-haiku-4-5", 1_000_000, 0)).toBe(1)
    expect(estimateCostUsd("claude-haiku-4-5", 1_000_000, 0, 1_000_000)).toBeCloseTo(0.1, 10)
    // cache writes cost 1.25 times the input price
    expect(estimateCostUsd("claude-sonnet-5-5", 1_000_000, 0, 0, 1_000_000)).toBeCloseTo(2.5, 10)
    expect(estimateCostUsd("claude-sonnet-5-5", 3_000_000, 0, 1_000_000, 1_000_000)).toBeCloseTo(
      2 + 0.2 + 2.5,
      10
    )
    expect(estimateCostUsd("gpt-x", 1, 1)).toBeNull()
  })
})

describe("settings and key storage", () => {
  it("keeps the key in session storage unless the visitor opts in, and forgets it", () => {
    const session = memoryStorage()
    const local = memoryStorage()
    let changes = 0
    const store = createAiStore(session, local, () => changes++)
    store.setKey("anthropic", `  ${KEY}  `, false)
    expect(session.getItem(KEY_PREFIX + "anthropic")).toBe(KEY)
    expect(local.getItem(KEY_PREFIX + "anthropic")).toBeNull()
    store.setKey("anthropic", KEY, true)
    expect(local.getItem(KEY_PREFIX + "anthropic")).toBe(KEY)
    expect(session.getItem(KEY_PREFIX + "anthropic")).toBeNull()
    expect(store.getKey("anthropic")).toBe(KEY)
    store.forgetKey()
    expect(store.getKey("anthropic")).toBeNull()
    expect(changes).toBe(3)
    store.setKey("openai", "", false)
    expect(store.getKey("openai")).toBeNull()
  })

  it("reports where each provider's key is kept, whatever the global setting says", () => {
    const store = createAiStore(memoryStorage(), memoryStorage())
    // Anthropic key remembered on this device, then an OpenAI key for this tab only
    store.saveSettings({ ...DEFAULT_SETTINGS, provider: "anthropic", remember: true })
    store.setKey("anthropic", KEY, true)
    store.saveSettings({ ...DEFAULT_SETTINGS, provider: "openai", remember: false })
    store.setKey("openai", "sk-test-openai-key", false)
    expect(store.getSettings().remember).toBe(false)
    expect(store.keyRemembered("anthropic")).toBe(true)
    expect(store.keyRemembered("openai")).toBe(false)
    store.forgetKey("openai")
    expect(store.keyRemembered("openai")).toBeNull()
  })

  it("stores settings without the key and survives bad JSON", () => {
    const local = memoryStorage()
    const store = createAiStore(memoryStorage(), local)
    const s: AiSettings = { ...DEFAULT_SETTINGS, provider: "openai", remember: true }
    store.saveSettings(s)
    expect(store.getSettings()).toEqual(s)
    expect(local.getItem(SETTINGS_KEY)).not.toContain("sk-")
    local.setItem(SETTINGS_KEY, "{oops")
    expect(store.getSettings()).toEqual(DEFAULT_SETTINGS)
  })
})

describe("audit log (IndexedDB)", () => {
  it("adds entries with redacted keys, appends decisions and clears", async () => {
    const audit = indexedDbAuditStore(new IDBFactory())
    const e = await audit.add(
      {
        feature: SQL_FEATURE,
        provider: "anthropic",
        model: "claude-haiku-4-5",
        requestedModel: "claude-haiku-4-5",
        input: { question: `my key is ${KEY}` },
        output: { sql: "SELECT 1" },
        error: null,
        latency_ms: 120,
        usage: { inputTokens: 10, outputTokens: 5 },
        human_decision: "pending",
      },
      [KEY]
    )
    expect(JSON.stringify(e)).not.toContain(KEY)
    await audit.setDecision(e.id, "edited", { sql: "SELECT 2" })
    const updated = await audit.setDecision(e.id, "accepted")
    expect(updated?.human_decision).toBe("accepted")
    expect(updated?.decisions.map((d) => d.decision)).toEqual(["edited", "accepted"])
    expect(await audit.setDecision("missing", "rejected")).toBeNull()
    const list = await audit.list()
    expect(list).toHaveLength(1)
    const csv = auditToCsv(list)
    expect(csv.split("\r\n")[0]).toContain("human_decision")
    expect(csv).not.toContain(KEY)
    expect(JSON.parse(auditToJson(list)).entries).toHaveLength(1)
    await audit.clear()
    expect(await audit.list()).toHaveLength(0)
  })

  it("redacts secrets deeply and keeps decision history append-only", () => {
    expect(redactSecrets({ a: [`x ${KEY}`], b: 1 }, [KEY])).toEqual({ a: ["x [redacted]"], b: 1 })
    expect(redactSecrets("abc", ["short"])).toBe("abc")
    const base = {
      id: "1",
      timestamp: "t",
      feature: "f",
      provider: "anthropic" as const,
      model: "m",
      requestedModel: "m",
      input: null,
      output: null,
      error: null,
      latency_ms: 1,
      usage: null,
      human_decision: "pending" as const,
      decided_at: null,
      edited_output: null,
      decisions: [],
    }
    const once = withDecision(base, "rejected")
    expect(withDecision(once, "accepted").decisions).toHaveLength(2)
    expect(once.edited_output).toBeNull()
  })
})

describe("structured calls with validation and auditing", () => {
  const settings: AiSettings = { ...DEFAULT_SETTINGS }
  const answer = {
    answerable: true,
    sql: "SELECT 1",
    explanation: "e",
    tables_used: [],
    assumptions: [],
  }

  it("validates the answer with zod and logs the call without the key", async () => {
    const audit = indexedDbAuditStore(new IDBFactory())
    const { result, entry } = await runAudited(
      audit,
      SQL_FEATURE,
      { question: "q" },
      settings,
      KEY,
      REQ,
      SqlAnswerSchema,
      { fetch: mockFetch(200, message(JSON.stringify(answer))), maxRetries: 0 }
    )
    expect(result.output.sql).toBe("SELECT 1")
    expect(entry.human_decision).toBe("pending")
    expect(entry.usage?.outputTokens).toBe(20)
    expect(JSON.stringify(await audit.list())).not.toContain(KEY)
  })

  it("logs failed calls as no_output and rejects malformed answers", async () => {
    const audit = indexedDbAuditStore(new IDBFactory())
    const bad = await runAudited(
      audit,
      SQL_FEATURE,
      { question: "q" },
      settings,
      KEY,
      REQ,
      SqlAnswerSchema,
      {
        fetch: mockFetch(200, message(JSON.stringify({ ...answer, sql: "" }))),
        maxRetries: 0,
      }
    ).catch((e: AiError) => e)
    expect((bad as AiError).kind).toBe("invalid_output")
    const notJson = await generateStructured(settings, KEY, REQ, SqlAnswerSchema, {
      fetch: mockFetch(200, message("not json")),
      maxRetries: 0,
    }).catch((e: AiError) => e)
    expect((notJson as AiError).kind).toBe("invalid_output")
    const entries = await audit.list()
    expect(entries[0].human_decision).toBe("no_output")
    expect(entries[0].error).toMatch(/invalid_output/)
    const noKey = await runAudited(
      audit,
      SQL_FEATURE,
      {},
      settings,
      null,
      REQ,
      SqlAnswerSchema
    ).catch((e: AiError) => e)
    expect((noKey as AiError).kind).toBe("no_key")
    expect(await audit.list()).toHaveLength(1)
  })

  it("keeps the billed tokens in the log when the model refuses or runs out of tokens", async () => {
    const audit = indexedDbAuditStore(new IDBFactory())
    for (const stop_reason of ["refusal", "max_tokens"]) {
      await runAudited(audit, SQL_FEATURE, { question: "q" }, settings, KEY, REQ, SqlAnswerSchema, {
        fetch: mockFetch(200, message("{", { stop_reason })),
        maxRetries: 0,
      }).catch((e: AiError) => e)
    }
    const entries = await audit.list()
    expect(entries).toHaveLength(2)
    for (const e of entries) {
      expect(e.human_decision).toBe("no_output")
      expect(e.usage).toMatchObject({ inputTokens: 500, outputTokens: 20, cachedInputTokens: 400 })
      expect(e.model).toBe("claude-haiku-4-5")
    }
    expect(entries.map((e) => e.error?.split(":")[0]).sort()).toEqual(["refusal", "truncated"])
  })
})

describe("the SQL prompt", () => {
  it("includes the domain notes only in the described variant", () => {
    const tables = [
      {
        name: "statewide_monthly",
        file: "statewide-monthly.csv",
        title: "Statewide, monthly",
        description: "d",
        rows: 180,
        columns: [{ name: "month", type: "TEXT" as const }],
      },
    ]
    const described = buildSqlRequest("  How much?  ", tables, "described")
    expect(described.system).toContain("Domain notes")
    expect(described.user).toBe("Question: How much?")
    expect(buildSqlRequest("x", tables, "bare").system).not.toContain("Domain notes")
    expect(buildSqlRequest("x".repeat(900), tables, "bare").user.length).toBeLessThan(520)
  })

  it("does not name the benchmark's should-decline cases in the prompt", () => {
    // the decline rule is generic, so the abstain questions test recognition, not instruction-following
    const system = buildSqlRequest("x", [], "described").system.toLowerCase()
    const rules = system.split("domain notes")[0]
    const cases = ["venue-level", "individual", "casino", "forecast", "suburb", "victoria"]
    for (const word of [...cases, "online", "problem gambl", "age of"]) {
      expect(rules).not.toContain(word)
    }
    // the domain notes list the licence categories (one is 'Casino') but say nothing about revenue
    // by venue type, suburbs, other states or forecasts
    for (const word of cases.filter((w) => w !== "casino")) expect(system).not.toContain(word)
    expect(system).toContain("cannot answer the question")
    const abstain = GOLD_QUESTIONS.filter((q) => q.category === "abstain")
    expect(abstain.length).toBeGreaterThanOrEqual(8)
    // the prompt's opening sentence states the scope: South Australian gaming-machine statistics
    // for FY 2009-10 to FY 2024-25. The three questions that lean on it are flagged.
    expect(system).toMatch(/^[^\n]*south australian gaming-machine statistics[^\n]*fy 2024-25/)
    expect(abstain.filter((q) => q.scopeInPrompt).map((q) => q.id)).toEqual(["a03", "a06", "a07"])
    expect(abstain.filter(unpromptedAbstain).map((q) => q.id)).toEqual([
      "a01",
      "a02",
      "a04",
      "a05",
      "a08",
    ])
  })
})

describe("evaluation scoring", () => {
  it("compares results by value, ignoring aliases and extra columns", () => {
    const ref = { columns: ["x"], rows: [[1008.46]] }
    expect(compareResults(ref, { columns: ["total"], rows: [[1008.4600001]] }, false).strict).toBe(
      true
    )
    expect(
      compareResults(ref, { columns: ["fy", "total"], rows: [["2024-25", 1008.46]] }, false)
    ).toMatchObject({ lenient: true, strict: false })
    expect(compareResults(ref, { columns: ["x"], rows: [[12101.52]] }, false).lenient).toBe(false)
    expect(compareResults(ref, { columns: ["x"], rows: [] }, false).reason).toMatch(/row/)
    const ordered = { columns: ["a"], rows: [["x"], ["y"]] }
    expect(compareResults(ordered, { columns: ["a"], rows: [["y"], ["x"]] }, true).lenient).toBe(
      false
    )
    expect(compareResults(ordered, { columns: ["a"], rows: [["y"], ["x"]] }, false).lenient).toBe(
      true
    )
    expect(cellKey(0.38755)).toBe(cellKey(0.3876))
    expect(cellKey(11735)).not.toBe(cellKey(11736))
    expect(cellKey(null)).toBe("null")
    expect(cellKey(" Adelaide ")).toBe("s:Adelaide")
  })

  const item = (id: string, lenient: boolean, category = "lookup"): EvalItemResult => ({
    id,
    category: category as EvalItemResult["category"],
    outcome: lenient ? "pass" : "wrong_result",
    lenient,
    strict: lenient,
    detail: "",
    sql: "SELECT 1",
    latencyMs: 100,
    inputTokens: 10,
    outputTokens: 2,
    cachedInputTokens: 0,
    auditId: null,
    answeredBy: "claude-haiku-4-5",
  })

  it("summarises a run with Wilson intervals by category", () => {
    const items = [
      item("q1", true),
      item("q2", false),
      item("q3", true, "aggregate"),
      item("a1", true, "abstain"),
    ]
    const s = summariseRun(items)
    expect(s.lenient.passes).toBe(3)
    expect(s.lenient.lower).toBeLessThan(0.75)
    expect(s.answerable.n).toBe(3)
    expect(s.abstention.passes).toBe(1)
    expect(s.byCategory.find((c) => c.category === "lookup")!.n).toBe(2)
    expect(s.outcomes.pass).toBe(3)
    expect(s.medianLatencyMs).toBe(100)
    expect(s.answeredBy).toEqual(["claude-haiku-4-5"])
    expect(s.lenient).toMatchObject(wilsonInterval(3, 4))
    expect(s.repeats).toBe(1)
    expect(s.spread).toBeNull()
    expect(s.abstentionUnprompted).toMatchObject({ n: 1, passes: 1 })
  })

  it("summarises repeated runs by per-question pass rates", () => {
    const rep = (r: number, passes: boolean[]) =>
      ["q1", "q2", "q3", "q4"].map((id, i) => ({ ...item(id, passes[i]), repeat: r }))
    const items = [
      ...rep(0, [true, true, false, false]),
      ...rep(1, [true, false, false, false]),
      ...rep(2, [true, true, false, true]),
    ]
    const s = summariseRun(items)
    expect(s.n).toBe(4)
    expect(s.attempts).toBe(12)
    expect(s.repeats).toBe(3)
    // pass rates 1, 2/3, 0, 1/3: mean 0.5, with Wilson on 2 of 4 questions (questions are the unit)
    expect(s.lenient.estimate).toBeCloseTo(0.5, 12)
    expect(s.lenient.passes).toBeCloseTo(2, 12)
    expect(s.lenient.lower).toBeCloseTo(wilsonInterval(2, 4).lower, 12)
    expect(s.lenient.upper).toBeCloseTo(wilsonInterval(2, 4).upper, 12)
    expect(s.spread).toMatchObject({ perRepeat: [0.5, 0.25, 0.75], min: 0.25, max: 0.75, mixed: 2 })
    expect(s.outcomes.pass).toBe(6)
    expect(summariseRun(items)).toEqual(s)
  })

  it("never narrows the interval by repeating the same questions", () => {
    // every look-up question always passes and every decline question always fails
    const once = [
      ...["q1", "q2", "q3", "q4", "q5"].map((id) => item(id, true)),
      ...["a1", "a2", "a3"].map((id) => item(id, false, "abstain")),
    ]
    const thrice = [0, 1, 2].flatMap((r) => once.map((i) => ({ ...i, repeat: r })))
    const s1 = summariseRun(once)
    const s3 = summariseRun(thrice)
    for (const key of ["lenient", "answerable", "abstention"] as const) {
      expect(s3[key].lower).toBeCloseTo(s1[key].lower, 12)
      expect(s3[key].upper).toBeCloseTo(s1[key].upper, 12)
    }
    for (const c of s3.byCategory.filter((c) => c.n > 0)) {
      // an all-pass or all-fail category keeps a Wilson interval of real width
      expect(c.ci.upper - c.ci.lower).toBeGreaterThan(0.2)
    }
    const lookup = s3.byCategory.find((c) => c.category === "lookup")!
    expect(lookup.ci).toMatchObject(wilsonInterval(5, 5))
  })

  it("compares two runs question by question", () => {
    const a = ["q1", "q2", "q3", "q4", "q5"].map((id, i) => item(id, i < 4))
    const b = ["q1", "q2", "q3", "q4", "q5"].map((id, i) => item(id, i < 2))
    const c = compareRuns(a, b, 1)
    expect(c).toMatchObject({ n: 5, bothPass: 2, onlyA: 2, onlyB: 0, neither: 1 })
    expect(c.difference.estimate).toBeCloseTo(0.4, 10)
    expect(c.mcnemarP).toBeCloseTo(0.5, 10)
    expect(compareRuns(a, b, 1)).toEqual(c)
    expect(c.repeats).toEqual([1, 1])
    // with repeats, questions are compared on their averaged pass rates and McNemar is not used
    const a3 = [0, 1, 2].flatMap((r) => a.map((i) => ({ ...i, repeat: r })))
    const cr = compareRuns(a3, b, 1)
    expect(cr.repeats).toEqual([3, 1])
    expect(cr.mcnemarP).toBeNull()
    expect(cr.onlyA).toBeNull()
    expect(cr.difference.estimate).toBeCloseTo(0.4, 10)
    const rows = runToRows({
      id: "r",
      startedAt: "t",
      finishedAt: null,
      provider: "anthropic",
      model: "m",
      variant: "described",
      items: a,
      seed: 1,
    })
    expect(rows).toHaveLength(5)
    expect(rows[0]).toMatchObject({ question_id: "q1", pass_lenient: true, repeat: 1 })
  })
})

describe("prompt fingerprint", () => {
  it("hashes the system prompt and output schema with SHA-256 (matches Python's hashlib)", async () => {
    expect(await promptSha256({ system: "abc", jsonSchema: { type: "object" } })).toBe(
      "438b4604ca9aa56dd5894d8abb94e6e36e90f98fec4da75b4dca9d53b5babec7"
    )
    expect(await promptSha256({ system: "Grüße", jsonSchema: {} })).toBe(
      "4aff63e368f6dc2a2127acd74485dc42addbbf2eb7bcfcd465efad6450d78df2"
    )
    // the question is not part of the fingerprint: every question in a run shares one hash
    const a = buildSqlRequest("first question", [], "described")
    const b = buildSqlRequest("second question", [], "described")
    expect(await promptSha256(a)).toBe(await promptSha256(b))
    expect(await promptSha256(a)).not.toBe(
      await promptSha256(buildSqlRequest("first question", [], "bare"))
    )
  })
})
