# server — Insights

Append-only: add entries, never rewrite; correct with a new dated entry.
Entry format: `- YYYY-MM-DD — <insight> (<file:line>)`. Written via /engineering-insights.

## What Works

## What Doesn't Work
- 2026-11-22 — Treating `tokens × OpenRouter list price` as the real run cost: on `deepseek/deepseek-v4-flash` (2,867→277 tok) OpenRouter billed $0.0000498 vs a list-price estimate of $0.00031 (~6× high; the static `pricing.ts` table is ~10× high). Use the billed `usage.cost` when present and mark anything else `cost_estimated` / show it as an upper bound (src/platform/price-book.ts:34)

## Codebase Patterns
- 2026-11-22 — Any field added to `RunStats` must be `.nullish()`, not required: `run_traces.trace` is one jsonb document per run, so traces written before the field existed lack it and the drawer would fail to parse them (src/vendor/shared/contracts/trace.ts:61)

## Tool & Library Notes

## Recurring Errors & Fixes
- 2026-11-22 — On Colima, `*.it.test.ts` ran (not skipped) with `DOCKER_HOST=unix://$HOME/.colima/default/docker.sock TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE=/var/run/docker.sock TESTCONTAINERS_RYUK_DISABLED=true`; confirm with `--reporter=verbose` that the tests show ✓ rather than skipped (test/helpers/pg.ts)

## Session Notes
- 2026-11-22 — M1 run cost badge: cost persisted per run + PR sum, estimated-cost flag, `db:backfill-costs` for pre-M1 runs (specs/m1-run-cost-badge.md)

## Open Questions
