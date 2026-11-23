# Severity counters on review runs (HW1)

## Goal
On the PR page → **Agent runs** tab, each expanded review run shows a row of
severity counters above its finding cards — `3 CRITICAL · 5 WARNING · 2 SUGGESTION`
— so the user sees the distribution without scrolling. Clicking a level filters
that run's list to that level; clicking it again removes the filter.

## Context (how findings reach the UI today)
1. A review run persists a `reviews` row + its `findings` (each with `severity`,
   `confidence`, `accepted_at`, `dismissed_at`).
2. `GET /pulls/:id/reviews` (`server/src/modules/reviews/routes.ts:129`) returns
   every review of the PR with its `findings[]`. `severity` is the Zod enum
   `Severity` = `CRITICAL | WARNING | SUGGESTION`
   (`server/src/vendor/shared/contracts/findings.ts:11`).
3. Client: `usePrReviews(prId)` (`client/src/lib/hooks/reviews.ts:51`, query key
   `["reviews", prId]`) is called by the PR page (`.../pulls/[number]/page.tsx:40`),
   which passes the reviews to `FindingsTab` as `runs`.
4. `FindingsTab` renders one `ReviewRunAccordion` per review. The accordion header
   shows `N findings · M blockers` (blockers = CRITICAL not dismissed); its body
   (mounted only while open) holds `VerdictBanner` + `FindingsPanel`.
5. `FindingsPanel` gets that run's `findings` and renders a toolbar (Hide low
   confidence toggle) + the list from `visibleFindings(findings, hideLow)`
   (`FindingsPanel/helpers.ts`: drops confidence < 0.65 when on, sorts by severity).
6. Accept/dismiss (`useFindingAction`) invalidates `["reviews", prId]` → refetch →
   new `findings` prop → anything derived from it recomputes automatically.

Everything needed is already on the client: **no new route, table, query, or model call.**

## Scope
- In:
  - Counter row in `FindingsPanel`'s toolbar, above the cards, one counter per
    contract level in fixed order CRITICAL → WARNING → SUGGESTION.
  - Click a level → list shows only that level; click the active level → filter off;
    click another level → filter moves there (single active level).
  - Severity filter composes with Hide low confidence (both conditions apply).
  - Active counter highlighted with its `SEV` colour (background/border), the other
    two muted; state visible without hover (P3).
  - Empty result → the existing `EmptyState` ("No findings match").
  - Labels in `client/messages/en/prReview.json`; colours/icons from `SEV` /
    `SeverityBadge` (`@devdigest/ui`).
- Out:
  - `INFO` (exists in the UI `SEV` palette but not in the contract).
  - Header "blockers" count, Timeline icons, PR-list Findings column — untouched.
    Note: the task's mockups show severity icons + hover popovers in the PR-list
    Findings column and on Timeline rows; THIS starter has neither (the PR list
    has no Findings column, Timeline rows show "N finding(s) · M blockers" text).
    They are separate features and stay out of HW1.
  - `FindingCard` — untouched.
  - Persisting the filter across collapse/expand or reload (state lives in the panel).

## Design
- **Packages**: client only.
- **Logic** (`FindingsPanel/helpers.ts`, pure, unit-tested):
  - `countBySeverity(findings) → { CRITICAL, WARNING, SUGGESTION }`.
  - `visibleFindings(findings, hideLow, severity?)` — adds an optional severity filter
    to the existing function (hide-low → severity → sort).
- **State** (`FindingsPanel`): `severity: Severity | null` next to `hideLow`;
  focus index resets when the filter changes.
- **UI**: a small `SeverityCounters` component (colocated under `FindingsPanel/_components/`)
  rendering three `<button aria-pressed>` counters built from `SEV`.
- **Look** (from the task's reference screenshots):
  - Counters sit on the LEFT of the existing toolbar row, same line as
    "Hide low confidence" on the right, directly above the first card.
  - Each counter is a rounded pill: `"{count} CRITICAL"`, uppercase, bold, no icon;
    1px border + text in `SEV[level].c`, transparent background. Pills sit side by
    side (the "·" in the task's text format is the visual gap, not a literal dot).
  - Active pill: solid fill in `SEV[level].c` with dark/contrast text (screens:
    red pill for CRITICAL, amber for WARNING). While a filter is active the two
    other pills are dimmed (P3 text; the screenshots keep them outlined — dimming
    is the only deviation, easy to drop).
  - Zero-count pill: shown, dimmed, `disabled` (see Decisions; the General
    Reviewer screenshot hides it instead).
  - Card list, card order, first-card auto-expand: unchanged.
- **i18n** (`prReview.json`, `panel.counters.*`): pill text per level
  (`"{count} CRITICAL"` …), the group's aria-label ("Filter findings by severity").

## Acceptance criteria
P1 (blocking):
- [ ] Expanded run shows counters for the three levels: `3 CRITICAL · 5 WARNING · 2 SUGGESTION`.
- [ ] Each number equals the count of that level in the run's list.
- [ ] Click a level → only that level's findings remain.
- [ ] The filter can be removed to return to the full list.
- [ ] PR in the fork with implementation notes + demo video.

P2:
- [ ] Counts derive from already-loaded findings; clicking sends no request and runs no model.
- [ ] Severity filter AND Hide low confidence compose.
- [ ] Colours/labels from `SEV` / `SeverityBadge`.
- [ ] Tests for counting + filtering; `pnpm test` and `pnpm typecheck` green in `client/`.
- [ ] `client/INSIGHTS.md` entry; PR says whether the skill ran by itself.
- [ ] PR description walks through the five phases + reviewer-run report.

P3:
- [ ] Active level highlighted with its `SEV` colour, others muted, independent of hover;
      one active level at a time; second click clears filter + highlight.
- [ ] Zero-count levels don't break the row (see Open questions).
- [ ] Empty filter result shows the existing empty state.
- [ ] Labels in `prReview.json`.
- [ ] Counters stay correct after accept/dismiss without reload.

Tests: `FindingsPanel/helpers.test.ts` (count + filter + compose with hide-low);
`FindingsPanel.test.tsx` (counters render, click filters, second click clears,
active state via `aria-pressed`, empty state, no fetch on click).

## Scope extension (iteration 2, 2026-11-22)
Requested by the user after reviewing iteration 1, from the course's design
mockups. Lands in the SAME HW1 branch/PR. Supersedes the iteration-1 "Out" entries
for Timeline icons and the PR-list Findings column, and the counter Look/zero rules.

### 1. Counter pills — new look (supersedes "Design → Look")
- Neutral pill: 1px `var(--border)` outline, `var(--text-secondary)` text, SEV icon
  (`SEV[level].icon`) + `"{count} {Label}"` in regular case (`1 Critical`, `4 Warning`).
- Active pill: border, icon and text in `SEV[level].c`, background `SEV[level].bg`
  (the SeverityBadge pair). Other pills stay neutral (that IS the muted state).
- A vertical divider (`styles.divider`) after the pills, before the toggle.
- **Zero-count levels are hidden** (both mockups); exception: the ACTIVE level stays
  visible at 0 so the filter can be cleared. Supersedes "Zero-count level is shown as 0".

### 2. Timeline — severity icons per run
- Each settled run row in Timeline (`RunHistory`) shows icon+count per level with
  findings, e.g. `ⓘ 2  ⚠ 1  💡 1`, coloured by `SEV`; zero levels omitted.
- Data: the run's review from the already-loaded `usePrReviews` (`review.run_id ===
  run.run_id`) — no new request. Dismissed findings excluded.
- Hover/focus → popover "N FINDINGS IN THIS RUN" (see 4). Click does nothing else.

### 3. PR list — Findings column + aligned Score
- New **Findings** column between Score and Status: icon+count per level, zero levels
  omitted, `—` when none / never reviewed.
- Server `GET /repos/:id/pulls` adds `findings_summary: {CRITICAL, WARNING, SUGGESTION}`
  per PR, computed from the **latest review of each agent** (repeat runs don't
  double-count), **excluding dismissed** findings.
- **Score** is recomputed from that same finding set with the engine's formula
  (`scoreFromFindings`, CRITICAL −35 / WARNING −12 / SUGGESTION −3, clamped 0–100,
  imported from reviewer-core — not duplicated) so Score and Findings never disagree.
  Was: score of the single latest review. Consequence: PRs with many findings
  across agents sink toward 0; dismissing findings raises the score.
- Hover/focus on the Findings cell → popover "N FINDINGS" listing those findings,
  loaded lazily on hover via the existing `GET /pulls/:id/reviews` (same latest-per-
  agent, non-dismissed rule, applied client-side). Row click still opens the PR.
- Cost column: unchanged — already the sum of all runs (verified, L01).

### 4. Findings popover (shared by Timeline and PR list)
- Header with icon + `"N FINDINGS IN THIS RUN"` / `"N FINDINGS"`.
- Scrollable list (max height), each item: SEV icon, title (1 line, ellipsis),
  category chip, `file:line` (accent colour), `NN% conf`, rationale clamped to 2 lines.
- Opens on hover AND keyboard focus, closes on leave/blur/Escape; no hover-only info
  that keyboard users can't reach. No new request in Timeline; one cached query in
  the PR list.

### Acceptance (iteration 2)
- [ ] Pills: neutral style with icon + `1 Critical`; active = SEV border/text/bg; divider; zero hidden (active-at-0 kept).
- [ ] Timeline run rows show per-level icons matching that run's non-dismissed findings; popover lists them.
- [ ] PR list Findings column = latest review per agent, non-dismissed; `—` when none.
- [ ] PR list Score = `scoreFromFindings` of the same set.
- [ ] Popover reachable by hover and keyboard; Timeline popover makes no request.
- [ ] Tests: server aggregation (latest-per-agent, dismissed excluded, score), client
      icons/popover/pills; typecheck + tests green in client and server.

## Decisions (resolved open questions, 2026-11-22)
- ~~**Zero-count level is shown as `0`**~~ — superseded in iteration 2: zero levels are hidden. Original text: shown as `0`, muted and not clickable — the row always
  has three counters (task text P1/P3 wins over the screenshot caption that hides it).
  Exception: if the ACTIVE level drops to 0 (e.g. Hide low confidence turned on),
  it stays clickable so the filter can still be cleared; the list shows the empty state.
- **Counters follow Hide low confidence**: they count what passes the toggle, so a
  counter always equals the number of cards a click on it will show.
  Order: hide-low → count → severity filter → sort.
- **Dismissed findings are counted**, because they stay in the list (shown muted):
  counters always match the list. Note the accordion header's "blockers" excludes
  dismissed CRITICALs, so a run can read "0 blockers" next to "1 CRITICAL".
- **Labels**: pill text comes from `prReview.json` (i18n, P3), not `SEV[level].label`;
  only colours come from `SEV`.

## Phase log (for the PR description)
- **Initiation** (2026-11-22): traced the data flow above; spec written. Two
  conflicts in the task text resolved with the user (see Decisions). Look &
  placement taken from the task's 8 reference screenshots (see Design → Look).
- **Planning** (2026-11-22): Plan Mode → plan approved. Steps: `SEVERITY_LEVELS` +
  pure helpers (`passesConfidence`, `countBySeverity`, `visibleFindings(…, severity)`),
  `SeverityCounters` pill component, state in `FindingsPanel`, strings, tests.
  **Dropped** from what a generic agent plan would add: new route / table /
  migration / query hook / model call, any server or contract change, an `INFO`
  level, persisting the filter (URL / localStorage), touching `FindingCard`, the
  accordion "blockers" header, Timeline or the PR list.
- **Implementation** (2026-11-22): as planned, client only —
  `FindingsPanel/{constants,helpers}.ts`, `FindingsPanel/_components/SeverityCounters/*`,
  `FindingsPanel.tsx`, `messages/en/prReview.json`; tests in `helpers.test.ts` and
  `FindingsPanel.test.tsx`.
- **Validation — iteration 1** (2026-11-22):
  - `pnpm typecheck` clean; `pnpm test` 80/80 (20 new).
  - Browser, `burnjohn/quick-blog` PR #34, Performance Reviewer run: counters
    `3 CRITICAL · 1 WARNING · 0 SUGGESTION` match the API (3/1/0); CRITICAL → 3 cards,
    WARNING → 1, second click → all 4; one pill pressed at a time; zero pill disabled;
    **0 API requests during the clicks** (Performance resource entries).
  - Independent review by a fresh subagent (diff + spec only). Fixed from it:
    first card of a filtered list didn't auto-expand (filter added to the card key);
    active WARNING pill had ~3.2:1 contrast in the light theme (per-level active text
    colour) and muted pills were too faint (opacity 0.65, disabled 0.45); `j` on an
    empty list set focus to -1 (clamped); accept/dismiss test now models `dismissed_at`
    instead of removing the finding; added tests for card order, first-card expand,
    focus reset and the clamp. Each new test was mutation-checked (fails when its fix
    is reverted).
  - Found, not fixed (pre-existing, outside scope): React warns "Updating borderColor
    borderLeftColor" when a card's focus changes — `FindingCard/styles.ts` mixes the
    `borderColor` shorthand with `borderLeftColor`; reproducible with plain `j`
    navigation, and the task says not to touch `FindingCard`.
- **Initiation — iteration 2** (2026-11-22): user review of iteration 1 asked for
  Timeline severity icons + popover, a PR-list Findings column, Score aligned with
  it, and a neutral pill look (mockups). Decisions: same HW1 PR; latest review per
  agent; dismissed excluded from Timeline/PR-list counts and Score; zero levels
  hidden; click = popover only. See "Scope extension (iteration 2)".
- **Planning — iteration 2** (2026-11-22): Plan Mode → approved. Shared
  `client/src/components/findings/` (pure `summary.ts`, `SeverityIcons`, portal-based
  `FindingsPopover` — the PR list container has `overflow: hidden`), pill restyle,
  Timeline icons from already-loaded reviews, server `findings_summary` + Score via
  reviewer-core's `scoreFromFindings` (weights not duplicated), PR-list column with a
  lazy `usePrReviews` on hover. Dropped: a new endpoint for popover data (existing
  `GET /pulls/:id/reviews` reused), denormalising counts into a table, click actions.
- **Implementation — iteration 2** (2026-11-22): `client/src/components/findings/`
  (`summary.ts`, `SeverityIcons`, `FindingsPopover` + tests, `messages/en/findings.json`),
  pill restyle in `SeverityCounters`, Timeline icons in `RunHistory` (reviews passed from
  `FindingsTab`), PR-list Findings column in `PRRow`, server aggregation in
  `pulls/routes.ts`, `PrMeta.findings_summary` (both contract copies),
  `scoreFromFindings` exported from reviewer-core (input type widened, still pure).
- **Validation — iteration 2** (2026-11-22):
  - client typecheck + 103/103 tests; server typecheck + 209/209 (incl. Testcontainers
    integration: latest-per-agent, dismissed excluded, null agent, summary ignored,
    other workspace ignored, all-dismissed → score 100); reviewer-core 27/27.
  - Browser (quick-blog PR #34): PR list `13/13/3` + Score 0 (= 100 − 13·35 − 13·12 − 3·3,
    clamped), popover "29 findings" = column total, exactly one `/reviews` request on
    first hover; Timeline icons per run, popover with no request; pills `3 Critical ·
    1 Warning`, active = red border/bg; real mouse-wheel scroll through the whole popover.
  - Independent review #2 (fresh subagent). Fixed: wheel-scrolling the list closed the
    popover (capture-phase scroll listener) → ignore panel scroll + `overscroll-behavior:
    contain` + follow the trigger on page scroll, close only when it leaves the screen;
    all-dismissed run showed the stored "3 findings"; tie-break on equal `created_at`
    (`desc(id)` on server, larger id on client); new reviews query now workspace-scoped;
    PR list refetches after accept/dismiss/delete (`["pulls"]` invalidated); popover
    stays open while the trigger keeps focus, panel focusable for keyboard scrolling.
  - User review: pointer cursor on icon triggers; "· N blockers" text removed everywhere
    it duplicated the red CRITICAL count — Timeline rows, run accordion header (now the
    same severity icons, open findings only) and the verdict banner ("N findings"); it
    remains only in the Timeline fallback when a run's review isn't loaded. Popover
    `file:line` now links to the blob on GitHub at the PR head (`githubBlobUrl`, same as
    FindingCard), in both the Timeline and the PR list. Client 107/107.
  - User review: after a second review run, the PR list flashed the OLD Cost and Findings
    for ~1s on return. Cause: run completion refreshed only the PR page's queries, and the
    earlier `invalidateQueries(["pulls"])` only marks INACTIVE queries stale (TanStack
    refetches them on the next mount, after rendering the cached data). Fix:
    `refreshPullsLists(qc)` (`lib/hooks/core.ts`, `refetchType: "all"`) called on run
    completion (PR page `onRunDone`) and after accept/dismiss/delete-run, so the cached
    list is already fresh when you navigate back. Known limit: if a run finishes while
    you're on neither page, the list still revalidates on mount (60s polling also covers
    it). Client 110/110 (`refresh-pulls.test.ts` incl. a contrast test of the old bug).
- **Completion**: _tbd_
