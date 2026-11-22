# client — Insights

Append-only: add entries, never rewrite; correct with a new dated entry.
Entry format: `- YYYY-MM-DD — <insight> (<file:line>)`. Written via /engineering-insights.

## What Works

## What Doesn't Work
- 2026-11-22 — `qc.invalidateQueries(["pulls"])` after a run / accept / dismiss does NOT refetch an INACTIVE (off-screen) query — it only marks it stale, so returning to the PR list renders the old Cost/Findings and swaps them ~1s later (visible flicker). Use `refreshPullsLists(qc)` (`refetchType: "all"`) for derived list data (src/lib/hooks/core.ts:111)

## Codebase Patterns
- 2026-11-22 — `FindingCard` reads `defaultExpanded` only on mount (`useState(defaultExpanded)`), and cards are keyed by `f.id`; after filtering, the new first card stays collapsed unless the filter is part of the key — `key={`${severity ?? "all"}:${f.id}`}` (src/app/repos/[repoId]/pulls/[number]/_components/FindingsPanel/FindingsPanel.tsx:90)
- 2026-11-22 — Floating UI over the PR list must render through a portal with `position: fixed`: the list container has `overflow: hidden` (src/app/repos/[repoId]/pulls/styles.ts:29). A capture-phase `scroll` listener on window also fires for the popover's OWN list — ignore events whose target is inside the panel, add `overscroll-behavior: contain`, and reposition on page scroll instead of closing (src/components/findings/FindingsPopover/FindingsPopover.tsx:99)
- 2026-11-22 — PR-list Findings/Score and the popover must use the SAME selection rule as the server: latest `review` per agent, ties on equal `created_at` broken by the larger id, dismissed excluded — `summary.ts` mirrors `pulls/routes.ts`; change both together (src/components/findings/summary.ts:41)

## Tool & Library Notes
- 2026-11-22 — In the Claude Code browser pane `document.hasFocus()` is false, so `el.focus()` fires no focus events; verify focus-driven UI by dispatching `focusin`/`focus` (React's `onFocus` listens to `focusin`) or rely on the RTL test (src/components/findings/FindingsPopover/FindingsPopover.test.tsx)

## Recurring Errors & Fixes
- 2026-11-22 — Pre-existing React warning "Updating borderColor borderLeftColor" whenever a card's focus changes (j/k or filter): `FindingCard/styles.ts` mixes the `borderColor` shorthand with `borderLeftColor`; not fixed in HW1 (task forbids touching FindingCard) — fix by using per-side longhands (src/app/repos/[repoId]/pulls/[number]/_components/FindingCard/styles.ts:10)

## Session Notes
- 2026-11-22 — HW1 severity counters + iteration 2 (Timeline/PR-list severity icons with popover, Score aligned with Findings). `/engineering-insights` did NOT trigger on its own during the session; invoked manually at Completion (specs/hw1-severity-counters.md)

## Open Questions
