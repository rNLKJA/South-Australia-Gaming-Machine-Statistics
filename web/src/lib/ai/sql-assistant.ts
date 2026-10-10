import { z } from "zod"

import { describeSchema, DOMAIN_NOTES, type PromptVariant, type SchemaTable } from "../sql/schema"
import type { StructuredRequest } from "./types"

/**
 * "Ask the data": a language model, called from the visitor's browser with their own key, turns a
 * question into one read-only SQLite query over the tidy tables. The query is shown to the visitor,
 * checked against the allow-list (src/lib/sql/guard.ts) and only runs when they choose to run it.
 *
 * The rule for declining is deliberately generic: the evaluation's "should decline" questions test
 * whether a model recognises what the tables can't answer, so the prompt names no examples.
 */

export const SQL_FEATURE = "ask-the-data"
export const SQL_EVAL_FEATURE = "ask-the-data-evaluation"

export const SqlAnswerSchema = z
  .object({
    answerable: z.boolean(),
    sql: z.string().max(4000),
    explanation: z.string().max(2000),
    tables_used: z.array(z.string().max(64)).max(20),
    assumptions: z.array(z.string().max(500)).max(10),
  })
  .refine((a) => !a.answerable || a.sql.trim().length > 0, {
    message: "an answerable question needs SQL",
    path: ["sql"],
  })

export type SqlAnswer = z.infer<typeof SqlAnswerSchema>

/** The same contract as JSON Schema, for the providers' structured-output modes. */
export const SQL_ANSWER_JSON_SCHEMA = {
  type: "object",
  properties: {
    answerable: {
      type: "boolean",
      description: "false when the question cannot be answered from these tables",
    },
    sql: {
      type: "string",
      description: "one SQLite SELECT statement (an empty string when not answerable)",
    },
    explanation: {
      type: "string",
      description: "one or two plain-English sentences on how the query answers the question",
    },
    tables_used: { type: "array", items: { type: "string" } },
    assumptions: {
      type: "array",
      items: { type: "string" },
      description: "interpretations you had to make, such as which table or which year",
    },
  },
  required: ["answerable", "sql", "explanation", "tables_used", "assumptions"],
  additionalProperties: false,
} as const

export const MAX_QUESTION_LENGTH = 500

export function buildSqlRequest(
  question: string,
  tables: readonly SchemaTable[],
  variant: PromptVariant
): StructuredRequest {
  const system = `You write SQLite queries for a public, read-only database of South Australian gaming-machine statistics (Consumer and Business Services releases, FY 2009-10 to FY 2024-25). The data are published aggregates.

Rules:
- Answer with exactly one SQLite SELECT statement (a WITH clause is fine). Never write to the database.
- Use only the tables and columns listed below. Do not use PRAGMA, ATTACH, recursive CTEs, printf() or table-valued functions.
- Return only the columns needed to answer the question, with readable aliases.
- Do not round numbers unless the question asks for rounding.
- Add ORDER BY when the question asks for a ranking or a list in order, and LIMIT 200 or less unless the result is a single row.
- If the tables below cannot answer the question, set answerable to false and sql to an empty string instead of guessing.
- Put any interpretation you had to choose in assumptions. Do not give advice about gambling.

${variant === "described" ? `${DOMAIN_NOTES}\n\n` : ""}Schema:
${describeSchema(tables, variant)}`
  return {
    system,
    user: `Question: ${question.trim().slice(0, MAX_QUESTION_LENGTH)}`,
    jsonSchema: SQL_ANSWER_JSON_SCHEMA as unknown as Record<string, unknown>,
    schemaName: "sql_answer",
    // reasoning tokens count against this cap on models that think; billing is per token used
    maxTokens: 8000,
  }
}
