/**
 * A mocked AI provider for the tour. No real key is ever used: the "key" is a placeholder typed into
 * the bring-your-own-key dialog, every request to a provider is intercepted in the browser context,
 * and the reply is written here.
 *
 * The mocked reply to the tour's example question is a query that passes the site's allow-list and
 * returns the right rows (src/lib/showcase.test.ts checks both), and its explanation starts with
 * MOCK_ANSWER_PREFIX, so nothing in the recording can be mistaken for a real model's output. It
 * reports zero tokens: the mock has no usage to report.
 */
import type { BrowserContext, Request } from "@playwright/test"

import { MOCK_ANSWER_PREFIX, MOCK_SQL } from "../src/lib/showcase"

/** Not a credential: an obviously fake placeholder typed into the BYOK dialog. */
export const PLACEHOLDER_KEY = "placeholder-not-a-real-key"

/** The example question the tour asks (one of the Ask page's suggestion chips). */
export const MOCK_QUESTION = "Which five council areas had the most gaming machines in FY 2024-25?"

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "POST, OPTIONS",
}

/** The structured reply (the shape of SqlAnswerSchema in src/lib/ai/sql-assistant.ts). */
export function mockAnswer(question: string) {
  if (/council areas had the most gaming machines/i.test(question)) {
    return {
      answerable: true,
      sql: MOCK_SQL,
      explanation: `${MOCK_ANSWER_PREFIX} The query lists the five areas CBS published for FY 2024-25 with the most gaming machines, keeping combined groups as one area.`,
      tables_used: ["lga_published_areas"],
      assumptions: [
        "Machines are the count CBS published for each area in its FY 2024-25 release.",
        "A combined council group counts as one area, as CBS published it.",
      ],
    }
  }
  return {
    answerable: false,
    sql: "",
    explanation: `${MOCK_ANSWER_PREFIX} The mock only answers the tour's example question.`,
    tables_used: [],
    assumptions: [],
  }
}

export interface MockAi {
  /** Requests that reached the mock (each one an AI call the app made). */
  calls: number
  /** Requests to anything else that carried the placeholder key (must stay empty). */
  leaks: string[]
}

export async function mockAiProviders(
  context: BrowserContext,
  { latencyMs = 900 }: { latencyMs?: number } = {}
): Promise<MockAi> {
  const state: MockAi = { calls: 0, leaks: [] }

  await context.route("https://api.anthropic.com/**", async (route) => {
    const req = route.request()
    if (req.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: CORS })
      return
    }
    state.calls += 1
    const body = JSON.parse(req.postData() ?? "{}") as {
      model?: string
      messages?: { role: string; content: string }[]
    }
    const user = body.messages?.find((m) => m.role === "user")?.content ?? ""
    if (latencyMs > 0) await new Promise((resolve) => setTimeout(resolve, latencyMs))
    await route.fulfill({
      status: 200,
      headers: { ...CORS, "content-type": "application/json" },
      body: JSON.stringify({
        id: `msg_mock_${state.calls}`,
        type: "message",
        role: "assistant",
        model: body.model ?? "unknown",
        content: [{ type: "text", text: JSON.stringify(mockAnswer(user)) }],
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: { input_tokens: 0, output_tokens: 0 },
      }),
    })
  })

  // The tour never uses OpenAI; block it so nothing can leave the browser.
  await context.route("https://api.openai.com/**", (route) => route.abort("blockedbyclient"))

  context.on("request", (req: Request) => {
    if (req.url().startsWith("https://api.anthropic.com/")) return
    const headers = JSON.stringify(req.headers())
    const data = req.postData() ?? ""
    if (
      headers.includes(PLACEHOLDER_KEY) ||
      data.includes(PLACEHOLDER_KEY) ||
      req.url().includes(PLACEHOLDER_KEY)
    ) {
      state.leaks.push(req.url())
    }
  })

  return state
}
