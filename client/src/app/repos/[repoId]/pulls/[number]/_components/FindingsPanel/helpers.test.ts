import { describe, it, expect } from "vitest";
import type { FindingRecord, Severity } from "@devdigest/shared";
import { countBySeverity, passesConfidence, visibleFindings } from "./helpers";

function f(id: string, severity: Severity, confidence = 0.9): FindingRecord {
  return {
    id,
    severity,
    category: "bug",
    title: id,
    file: "src/a.ts",
    start_line: 1,
    end_line: 1,
    rationale: "r",
    suggestion: null,
    confidence,
    kind: "finding",
    trifecta_components: null,
    evidence: null,
    review_id: "r1",
    accepted_at: null,
    dismissed_at: null,
  };
}

// Deliberately unsorted; w2 is low-confidence (below 0.65).
const FINDINGS = [
  f("s1", "SUGGESTION"),
  f("w1", "WARNING"),
  f("c1", "CRITICAL"),
  f("w2", "WARNING", 0.4),
];

const ids = (list: FindingRecord[]) => list.map((x) => x.id);

describe("countBySeverity", () => {
  it("counts each contract level", () => {
    expect(countBySeverity(FINDINGS)).toEqual({ CRITICAL: 1, WARNING: 2, SUGGESTION: 1 });
  });

  it("includes zero levels, so the counter row never loses a level", () => {
    expect(countBySeverity([f("w", "WARNING")])).toEqual({ CRITICAL: 0, WARNING: 1, SUGGESTION: 0 });
    expect(countBySeverity([])).toEqual({ CRITICAL: 0, WARNING: 0, SUGGESTION: 0 });
  });

  it("follows Hide low confidence when fed the confidence-filtered list", () => {
    expect(countBySeverity(passesConfidence(FINDINGS, true))).toEqual({
      CRITICAL: 1,
      WARNING: 1,
      SUGGESTION: 1,
    });
  });
});

describe("visibleFindings", () => {
  it("without a severity keeps the old behaviour: everything, sorted by severity", () => {
    expect(ids(visibleFindings(FINDINGS, false))).toEqual(["c1", "w1", "w2", "s1"]);
    expect(ids(visibleFindings(FINDINGS, false, null))).toEqual(["c1", "w1", "w2", "s1"]);
  });

  it("keeps only the selected severity", () => {
    expect(ids(visibleFindings(FINDINGS, false, "WARNING"))).toEqual(["w1", "w2"]);
    expect(ids(visibleFindings(FINDINGS, false, "CRITICAL"))).toEqual(["c1"]);
  });

  it("composes with Hide low confidence: both conditions must pass", () => {
    expect(ids(visibleFindings(FINDINGS, true, "WARNING"))).toEqual(["w1"]);
    expect(ids(visibleFindings(FINDINGS, true))).toEqual(["c1", "w1", "s1"]);
  });

  it("each counter equals the number of findings its filter shows", () => {
    for (const hideLow of [false, true]) {
      const counts = countBySeverity(passesConfidence(FINDINGS, hideLow));
      for (const level of ["CRITICAL", "WARNING", "SUGGESTION"] as const) {
        expect(visibleFindings(FINDINGS, hideLow, level)).toHaveLength(counts[level]);
      }
    }
  });

  it("does not mutate the input array", () => {
    const input = [...FINDINGS];
    visibleFindings(input, true, "WARNING");
    expect(ids(input)).toEqual(ids(FINDINGS));
  });
});
