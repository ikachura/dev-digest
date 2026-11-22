import type { FindingRecord, Severity } from "@devdigest/shared";
import { LOW_CONFIDENCE_THRESHOLD, SEVERITY_ORDER } from "./constants";

// Counting is shared with the PR list / Timeline; re-exported for this panel.
export { countBySeverity } from "@/components/findings/summary";

/** The "Hide low confidence" step: drop findings below the threshold when on. */
export function passesConfidence(findings: FindingRecord[], hideLow: boolean): FindingRecord[] {
  return hideLow ? findings.filter((f) => f.confidence >= LOW_CONFIDENCE_THRESHOLD) : findings;
}

/**
 * Findings to render: optionally drop low-confidence ones, optionally keep only
 * one severity, then sort by severity. `severity = null` keeps every level.
 */
export function visibleFindings(
  findings: FindingRecord[],
  hideLow: boolean,
  severity: Severity | null = null,
): FindingRecord[] {
  let shown = passesConfidence(findings, hideLow);
  if (severity) shown = shown.filter((f) => f.severity === severity);
  return [...shown].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9),
  );
}
