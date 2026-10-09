# DR-006: Keep the question as the unit for evaluation intervals, and count every decline the prompt gives away

- **Status:** Accepted
- **Date:** 2026-10-10
- **Supersedes:** DR-004, in part: how the evaluation's intervals and its cleaner decline subset are computed (the Measurement point)
- **Decision:** Report text-to-SQL accuracy with a Wilson interval on the sum of per-question pass rates out of the number of questions, however many times the set is repeated, and show the repeat-to-repeat spread separately. Treat the three should-decline questions that lean on the prompt's first sentence (another state, online betting, a forecast) as prompted, so the cleaner decline rate is over the other five.

## Context

DR-004 set up the evaluation: 28 questions, of which 8 should be declined, asked once or three times. With repeats, each question scored its pass rate across the repeats and the intervals came from a percentile bootstrap over questions. One should-decline question (the forecast) was flagged because the prompt states the years covered, and the decline rate was also reported on the other seven.

A second review before merge found two problems with that design.

The bootstrap made repeats shrink the intervals. When every question in a group always passes, or always fails, every resample has the same mean and the interval has no width. With 25 of 28 questions passing on every call, asking the set once gave 73% to 96% overall and 68% to 100% for the eight look-ups (Wilson); asking it three times gave 75% to 100% and 100% to 100%. Asking the same questions again says nothing new about questions the set doesn't contain, so the interval should not narrow. A percentile bootstrap over the 5 to 8 questions in a category also under-covers.

The decline subset still had a leak. The prompt opens with "a public, read-only database of South Australian gaming-machine statistics", which states the scope that the Victoria and online-betting questions depend on, just as the year range states the forecast question's. Declining those two is partly following the prompt.

## Decision

- `accuracy()` in `web/src/lib/ai/sql-eval.ts` returns `wilsonInterval(Σ pass rates, n questions)` for every number of repeats. With one repeat the pass rates are 0 or 1 and this is the interval the harness already showed.
- The repeat-to-repeat spread (accuracy by repeat, and the number of questions that passed in some repeats and failed in others) stays a separate line under the headline figures.
- a06 (Victoria) and a07 (online sports betting) are flagged with the part of the prompt that states their scope, next to a03 (forecast). The cleaner decline rate is over a01, a02, a04, a05 and a08.
- The paired comparison of two runs keeps its bootstrap over questions, and the page now says when that interval has no width because the runs agreed on every question.

## Options considered

- **Keep the percentile bootstrap over questions.** Collapses to zero width for all-pass or all-fail groups and under-covers with 5 to 8 questions.
- **Wilson over attempts (28 × 3).** Treats three calls on one question as three questions, so repeats narrow the interval: the same mistake in another form.
- **The wider of Wilson and the bootstrap.** Works, but it is two methods to explain and an ad hoc rule for choosing between them.
- **A beta-binomial or mixed model with a random effect per question.** The principled way to split call-to-call from question-to-question variation, but with three repeats of 28 questions the variance components are poorly estimated, and it is hard to explain on a page.
- **Remove "South Australian" and "gaming-machine" from the prompt's first sentence.** Keeps seven clean decline questions, but changes the prompt every visitor's draft uses, and the scope sentence gives the model useful context for the answerable questions.

## Why

The benchmark stands in for the questions a visitor might ask, so the questions are the sample and repeats only measure noise within a question. A pass rate lies between 0 and 1, so with mean p its variance is at most p(1 − p): treating the sum of rates as binomial successes out of n questions is conservative, and Wilson behaves well at 0 and n and for small n. Single runs keep exactly the interval they had. Flagging the prompted questions is cheaper and more honest than editing a prompt that is already in use.

## What happened

No model had been run on the benchmark, so no published figure changes. A unit test now asks a run with fixed outcomes once and three times and checks that every interval is identical, and that an all-pass category keeps a real width (8 of 8 gives 68% to 100%). The cleaner decline subset falls from seven questions to five, so its interval is wider: five of five declines gives 57% to 100%, where seven of seven gave 65% to 100%. That width is the honest size of the evidence. The review also found the R² in the model card quoted as 0.78 when the fit gives 0.7745; it now reads 0.77 and is checked by the content test.

## What I'd change

I would grow the clean decline set to at least 15 questions: five can't tell 60% from 100%. Once there are real runs, I would fit a beta-binomial model across repeats to report call-to-call and question-to-question variation separately, and replace the paired bootstrap for comparing runs with a score interval for paired proportions (Tango's), which keeps its width when two runs agree on every question.
