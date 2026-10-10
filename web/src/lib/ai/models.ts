import type { AiSettings, Provider } from "./types"

export interface AnthropicModelInfo {
  id: string
  label: string
  note: string
  /** Accepts a temperature parameter (Claude Sonnet 5.5 rejects non-default sampling values). */
  temperature: boolean
  /** output_config.effort to send, or null where the model has no effort control. */
  effort: "low" | "medium" | "high" | null
  /** Opt in to server-side refusal fallbacks (fallbacks: "default"). */
  fallbacks: boolean
}

/** Anthropic models offered in AI settings; the first is the default (the cheapest). */
export const ANTHROPIC_MODELS: readonly AnthropicModelInfo[] = [
  {
    id: "claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    note: "Default. Cheapest and fastest: US$1 / US$5 per million input / output tokens.",
    temperature: true,
    effort: null,
    fallbacks: false,
  },
  {
    id: "claude-sonnet-5-5",
    label: "Claude Sonnet 5.5",
    note: "Stronger on harder questions: US$2 / US$10 per million tokens. Runs at low effort, with Anthropic's server-side fallback if it declines.",
    temperature: false,
    effort: "low",
    fallbacks: true,
  },
]

export const DEFAULT_OPENAI_MODEL = "gpt-5-mini"

export const DEFAULT_SETTINGS: AiSettings = {
  provider: "anthropic",
  anthropicModel: ANTHROPIC_MODELS[0].id,
  openaiModel: DEFAULT_OPENAI_MODEL,
  remember: false,
}

export function anthropicModel(id: string): AnthropicModelInfo {
  return ANTHROPIC_MODELS.find((m) => m.id === id) ?? ANTHROPIC_MODELS[0]
}

export function activeModel(s: AiSettings): string {
  return s.provider === "anthropic"
    ? anthropicModel(s.anthropicModel).id
    : s.openaiModel.trim() || DEFAULT_OPENAI_MODEL
}

export const PROVIDER_LABEL: Record<Provider, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
}

/** Where each provider's keys are created, for the settings dialog. */
export const KEY_HELP: Record<Provider, { url: string; prefix: string }> = {
  anthropic: { url: "https://platform.claude.com/settings/keys", prefix: "sk-ant-" },
  openai: { url: "https://platform.openai.com/api-keys", prefix: "sk-" },
}

/** Approximate list prices, US$ per million tokens (for the evaluation's cost estimate). */
export const PRICE_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
}

/**
 * Approximate cost at list prices. inputTokens counts every input token; of those, cache reads are
 * billed at a tenth of the input price and cache writes (5-minute) at 1.25 times it.
 */
export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cachedInputTokens = 0,
  cacheWriteInputTokens = 0
): number | null {
  const p = PRICE_PER_MTOK[model]
  if (!p) return null
  return (
    ((inputTokens - cachedInputTokens - cacheWriteInputTokens) * p.input +
      cachedInputTokens * p.input * 0.1 +
      cacheWriteInputTokens * p.input * 1.25 +
      outputTokens * p.output) /
    1e6
  )
}
