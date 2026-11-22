# reviewer-core — Insights

Append-only: add entries, never rewrite; correct with a new dated entry.
Entry format: `- YYYY-MM-DD — <insight> (<file:line>)`. Written via /engineering-insights.

## What Works

## What Doesn't Work
- 2026-11-22 — Relying on the model to keep the output language: `deepseek/deepseek-v4-flash` on a ~77k-token review switched ALL findings to Chinese (same agent/PR was English an hour earlier; PR had no CJK). Fixed engine-wide: `outputLanguageRule` in every system prompt + `isOffLanguage` check with one prose-only translation call (src/review/language.ts:25)

## Codebase Patterns
- 2026-11-22 — Derived scores (e.g. the server's PR-list Score) must reuse `scoreFromFindings` (now exported, accepts `Pick<Finding,'severity'>[]`) instead of re-declaring the 35/12/3 weights (src/review/reduce.ts:27)

## Tool & Library Notes

## Recurring Errors & Fixes

## Session Notes
- 2026-11-22 — HW1 follow-up: output-language policy (specs/hw1-output-language.md)

## Open Questions
