/* Pure helpers for summarising review findings by severity (HW1).
   Shared by the PR page (run counters, Timeline icons) and the PR list. */
import type { FindingRecord, ReviewRecord, Severity } from "@devdigest/shared";

/** Severity levels of the findings contract, in display order. */
export const SEVERITY_LEVELS = ["CRITICAL", "WARNING", "SUGGESTION"] as const satisfies readonly Severity[];

export type SeverityCounts = Record<Severity, number>;

/** Count findings per contract severity; every level is present (0 when none). */
export function countBySeverity(findings: FindingRecord[]): SeverityCounts {
  const counts = Object.fromEntries(SEVERITY_LEVELS.map((s) => [s, 0])) as SeverityCounts;
  for (const f of findings) {
    if (f.severity in counts) counts[f.severity] += 1;
  }
  return counts;
}

/** Findings that still matter: dismissed ones are "not a problem" and drop out. */
export function activeFindings(findings: FindingRecord[]): FindingRecord[] {
  return findings.filter((f) => !f.dismissed_at);
}

/**
 * The current picture of a PR: the newest `review` of each agent, so re-running an
 * agent replaces its old findings instead of adding to them. Reviews without an
 * agent each count on their own. Mirrors the server's PR-list aggregation.
 */
export function latestReviewPerAgent(reviews: ReviewRecord[]): ReviewRecord[] {
  const byAgent = new Map<string, ReviewRecord>();
  for (const r of reviews) {
    if (r.kind !== "review") continue;
    const key = r.agent_id ?? `review:${r.id}`;
    const cur = byAgent.get(key);
    if (!cur || isNewer(r, cur)) byAgent.set(key, r);
  }
  return [...byAgent.values()];
}

/** Newest by created_at; equal timestamps broken by the larger id (same rule as the server). */
function isNewer(a: ReviewRecord, b: ReviewRecord): boolean {
  const d = Date.parse(a.created_at) - Date.parse(b.created_at);
  return d !== 0 ? d > 0 : a.id > b.id;
}

/** Findings the PR list summarises: latest review per agent, dismissed excluded. */
export function prFindings(reviews: ReviewRecord[]): FindingRecord[] {
  return activeFindings(latestReviewPerAgent(reviews).flatMap((r) => r.findings));
}

/** Total of all levels. */
export function totalCount(counts: Partial<SeverityCounts> | null | undefined): number {
  if (!counts) return 0;
  return SEVERITY_LEVELS.reduce((sum, l) => sum + (counts[l] ?? 0), 0);
}
