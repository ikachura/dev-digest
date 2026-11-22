# Output language policy for reviewer agents (HW1 follow-up)

## Goal
Every reviewer agent — built-in, custom, studio or CI runner — writes its findings
and summary in English. Today a model can silently switch language, and nothing in
the system notices.

## Context (observed during HW1's reviewer runs, 2026-11-22)
- quick-blog PR #44: the Security Reviewer run at 19:40 (`deepseek/deepseek-v4-flash`,
  ~77k input tokens) wrote all 7 findings in Chinese. The same agent on the same PR an
  hour earlier wrote English; the PR contains no CJK text (0 of 85 files).
- None of the three agent system prompts mentions an output language, and the engine
  (`reviewer-core/src/prompt.ts`) adds none. Cause: model non-determinism on long
  context + no explicit rule.
- Every agent's prompt passes through ONE function, `assemblePrompt`, which already
  appends the shared `INJECTION_GUARD` — the natural home for cross-agent rules.

## Scope
- In:
  1. **Policy** — `assemblePrompt` appends an output-language rule to every system
     prompt (after the agent's text, before `INJECTION_GUARD`, which stays last and
     unchanged). Language is a parameter (`outputLanguage`, default `"English"`).
  2. **Check + one repair** — after each structured review call, the engine checks the
     prose fields (summary, finding title / rationale / suggestion). If they are not in
     the target language, it makes ONE extra, small call that translates only those
     fields, then merges them back by finding `id`; structural fields (file, lines,
     severity, category, confidence, ids, verdict) always come from the original.
     If the repair fails or still isn't English, the original is kept and a warning is
     logged — a review is never lost over language.
- Out: a Settings UI for the language (the parameter makes it possible later);
  per-agent prompt edits; changing models; touching `INJECTION_GUARD`.

## Design (reviewer-core only; server unchanged — default applies)
- `src/review/language.ts` (pure):
  - `outputLanguageRule(lang)` → the system-prompt rule text.
  - `isOffLanguage(review, lang)` → for `English`: share of non-Latin letters among all
    letters in prose fields > 30% (min 40 letters, so short/code-heavy text doesn't
    trigger). Other target languages → `false` (policy only, no heuristic).
  - `translateReviewProse(review, lang, llm, model)` → the repair call (prose fields as
    `wrapUntrusted` JSON — model output derived from repo content is untrusted) +
    merge by id.
- `prompt.ts`: `PromptParts.outputLanguage?`; system =
  `agent prompt \n\n language rule \n\n INJECTION_GUARD`.
- `review/run.ts`: `ReviewInput.outputLanguage?`; per chunk, after `completeStructured`
  → if off-language: emit `info`, translate, add its tokens/cost (cost estimated flag
  propagates as for any call).

## Acceptance
- [ ] Every assembled system prompt contains the English rule; `INJECTION_GUARD` is still last and byte-identical.
- [ ] A Chinese review from the model is repaired to English; file/lines/severity/ids unchanged; tokens + cost include the repair call.
- [ ] English output → no extra call. Code-heavy English text with identifiers isn't flagged.
- [ ] Repair failure (throws / still non-English) → original kept, warning event, run succeeds.
- [ ] reviewer-core typecheck + tests green; server tests still green.

## Phase log
- **Initiation** (2026-11-22): observed drift on PR #44 (data above); user chose the
  engine-level policy + check, as a separate commit in the HW1 PR.
- **Planning** (2026-11-22): design above. Dropped: per-agent prompt edits (duplicated,
  custom agents miss it), re-running the whole review on drift (77k-token call) in
  favour of a small prose-only translation call, a language setting UI.
- **Implementation** (2026-11-22): `prompt.ts` (`outputLanguageRule`,
  `DEFAULT_OUTPUT_LANGUAGE`, `PromptParts.outputLanguage`), new
  `review/language.ts` (`isOffLanguage`, `translateReviewProse`), run loop in
  `review/run.ts`, exports in `index.ts`; docs `docs/agent-prompts/README.md`.
  `INJECTION_GUARD` untouched and still last.
- **Validation** (2026-11-22): reviewer-core typecheck + 39/39 (12 new: rule placement,
  parameter, guard tail unchanged; detector on Chinese / English-with-identifiers /
  tiny samples / non-English target; repair keeps structure; run loop: no extra call on
  English, one repair on Chinese with tokens+cost added, repair throws → original kept,
  repair still Chinese → original kept). Mutation check: disabling the check fails 3
  run-loop tests. Server typecheck + 209/209 unchanged. Not yet observed on a live
  drift (non-deterministic); the HW1 reviewer-run report can note re-runs.
