# DR-004: Run text-to-SQL in the visitor's browser, read-only, with their own key

- **Status:** Accepted
- **Date:** 2026-10-09
- **Decision:** Load the eight tidy tables into SQLite (sql.js) inside a Web Worker in the visitor's browser, let a model chosen by the visitor draft one query per question using the visitor's own API key, and run only queries that pass a token-level allow-list, on a database that refuses writes, with a row cap and a time limit.

## Context

The site is static: every page is prerendered and there is no database or server-side AI. I wanted a "ask the data in plain English" feature that shows what a language model can and can't do with a small, well-documented dataset, without paying for model calls (there is no budget) and without handling anyone's key on a server.

Text-to-SQL has two risks worth designing for. The model can write a query that does something other than read (or tries to), and it can write a query that runs but answers a different question. The first is a safety problem; the second is a quality problem that only measurement can show.

## Decision

- **Data.** `/ask/tidy-tables.sql` is generated at build time from the same code as the CSV downloads, so the SQL tables and the downloads can't disagree. The script ends with `PRAGMA query_only = ON`.
- **Engine.** sql.js (SQLite compiled to WebAssembly) runs in a Web Worker served from `/vendor/sqljs/`. A query that runs longer than five seconds is stopped by terminating the worker, and results are capped at 500 rows.
- **Guard.** `web/src/lib/sql/guard.ts` tokenises the query (so strings and comments can't hide keywords) and accepts only one SELECT or WITH statement over the eight tables and CTEs defined in the query, with allow-listed functions, no recursion, no parameters, no `sqlite_*` names and no schema-qualified or table-valued sources.
- **Model.** The visitor picks Anthropic (Claude Haiku 4.5 by default, Claude Sonnet 5.5 as an option) or OpenAI (any model id). The request goes from the browser to the provider with structured output, and the answer is validated with zod. The key lives in sessionStorage unless the visitor opts in to localStorage.
- **Human in the loop.** The SQL is always shown and editable, and nothing runs until the visitor clicks Run. A result from a model's query, or from an edit of one, is labelled AI-assisted. Every run of a drafted query appends the visitor's decision to the audit log in IndexedDB: accepted, or edited with the exact SQL that ran (each different edit is a new entry). Discarding a draft records "rejected" and puts back the SQL the editor held before the draft.
- **Measurement.** A fixed 28-question benchmark with reference SQL measures execution accuracy: 20 answerable questions and 8 that should be declined. The prompt's rule for declining is generic and names no examples, so the declines test whether a model recognises what the tables can't answer. The one should-decline question whose scope the prompt does state (the years covered) is reported apart from the other seven. A run can ask the whole set once or three times; with repeats each question scores its pass rate, and intervals come from a bootstrap over questions. Single runs get Wilson intervals, and two runs are compared question by question.

## Options considered

- **A server route that calls the model with a site key.** Simplest for visitors, but it needs a budget and rate limiting, and it puts a secret on the server.
- **Send the visitor's key to a server route.** Avoids CORS issues, but the site would then handle keys, which is exactly what bring-your-own-key should avoid.
- **DuckDB-Wasm instead of sql.js.** Faster for analytics and closer to modern SQL, but the download is several megabytes against sql.js's 0.7 MB, for tables of at most a few thousand rows.
- **Trust the model's SQL as long as the database is read-only.** The query_only pragma alone does stop writes, but an allow-list gives the visitor a clear reason when a query is refused and limits what a prompt-injected or careless query can try.

## Why

Running everything in the browser means the only place a key goes is the provider, the only database a query can touch is a throwaway copy in one tab, and the site stays static. Three independent layers (allow-list, read-only engine, worker time limit) mean no single bug opens anything up. Showing the SQL before running it keeps a person in charge of what is computed.

## What happened

The reference queries all pass through the guard and return the site's own figures in the unit tests (for example, FY 2024/25 NGR of $1,008.46m and 11,735 machines in June 2025). The guard rejects all 33 adversarial queries in the tests, including `sqlite_master`, `pragma_table_info`, quoted function names and a self-referencing CTE without the RECURSIVE keyword. Loading the database takes about 40 ms in Node for a 244 KB script.

A review before merge found three faults, fixed before release. The prompt's rule for declining listed venue-level data, the casino's revenue and forecasts, which were exactly the three should-decline questions at the time, so a perfect decline rate would only have shown that the model followed an instruction. The rule is now generic, and five new should-decline questions (suburbs, problem-gambling prevalence, Victoria, online betting and players' ages) were added; no model had been run on the benchmark before or after the change. Second, after "Discard draft" the model's SQL stayed in the editor and could be run without a label while the log said "rejected". Third, only the first edited version of a query was logged, so a second edit ran without a trace. Both are covered by unit tests now.

Model output varies from call to call: Claude Sonnet 5.5 does not accept a temperature, and OpenAI reasoning models ignore it. Two single runs can therefore differ by chance alone, which is why the harness can repeat the question set and compares configurations on per-question pass rates averaged over repeats.

What isn't known yet is how accurate the models are: the site has no budget to run the benchmark, so no accuracy figure is published. The harness reports results only for runs a visitor makes with their own key. Browser-to-API calls can also be blocked by some corporate networks and extensions; the error message says so, but the feature can't work around it.

## What I'd change

I would publish a benchmark run once there is a small budget for it, with the raw per-question results, and grow the question set (28 questions give intervals about ±18 percentage points wide, and the 8 should-decline questions far wider). I would also add a "show me the rows behind this number" step that re-runs the model's query without aggregation, so a visitor can check a surprising answer.
