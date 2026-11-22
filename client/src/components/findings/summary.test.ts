import { describe, it, expect } from "vitest";
import type { FindingRecord, ReviewRecord, Severity } from "@devdigest/shared";
import { activeFindings, countBySeverity, latestReviewPerAgent, prFindings, totalCount } from "./summary";

function f(id: string, severity: Severity, dismissed = false): FindingRecord {
  return {
    id,
    severity,
    category: "bug",
    title: id,
    file: "a.ts",
    start_line: 1,
    end_line: 1,
    rationale: "r",
    suggestion: null,
    confidence: 0.9,
    kind: "finding",
    trifecta_components: null,
    evidence: null,
    review_id: "r",
    accepted_at: null,
    dismissed_at: dismissed ? "2026-11-22T00:00:00Z" : null,
  };
}

function rv(id: string, agent: string | null, created: string, findings: FindingRecord[], kind: "review" | "summary" = "review"): ReviewRecord {
  return {
    id,
    pr_id: "p",
    agent_id: agent,
    run_id: null,
    agent_name: null,
    kind,
    verdict: null,
    summary: null,
    score: null,
    model: null,
    grounding: null,
    created_at: created,
    findings,
  };
}

describe("findings summary", () => {
  it("activeFindings drops dismissed findings", () => {
    expect(activeFindings([f("a", "CRITICAL"), f("b", "WARNING", true)]).map((x) => x.id)).toEqual(["a"]);
  });

  it("latestReviewPerAgent keeps the newest review per agent; agent-less reviews count alone; summaries ignored", () => {
    const reviews = [
      rv("sec-old", "sec", "2026-11-20T00:00:00Z", []),
      rv("sec-new", "sec", "2026-11-21T00:00:00Z", []),
      rv("perf", "perf", "2026-11-19T00:00:00Z", []),
      rv("anon-1", null, "2026-11-18T00:00:00Z", []),
      rv("anon-2", null, "2026-11-18T00:00:00Z", []),
      rv("sum", "sec", "2026-11-22T00:00:00Z", [], "summary"),
    ];
    expect(latestReviewPerAgent(reviews).map((r) => r.id).sort()).toEqual(["anon-1", "anon-2", "perf", "sec-new"]);
  });

  it("prFindings = latest review per agent, dismissed excluded (matches the server rule)", () => {
    const reviews = [
      rv("old", "sec", "2026-11-20T00:00:00Z", [f("stale", "CRITICAL")]),
      rv("new", "sec", "2026-11-21T00:00:00Z", [f("c", "CRITICAL"), f("w", "WARNING", true)]),
      rv("p", "perf", "2026-11-21T00:00:00Z", [f("s", "SUGGESTION")]),
    ];
    const list = prFindings(reviews);
    expect(list.map((x) => x.id).sort()).toEqual(["c", "s"]);
    expect(countBySeverity(list)).toEqual({ CRITICAL: 1, WARNING: 0, SUGGESTION: 1 });
  });

  it("totalCount sums levels and tolerates null", () => {
    expect(totalCount({ CRITICAL: 1, WARNING: 2, SUGGESTION: 3 })).toBe(6);
    expect(totalCount(null)).toBe(0);
  });

  it("equal created_at: the larger id wins (same tie-break as the server)", () => {
    const same = "2026-11-21T00:00:00Z";
    const reviews = [rv("a-111", "sec", same, [f("x", "CRITICAL")]), rv("b-222", "sec", same, [f("y", "WARNING")])];
    expect(latestReviewPerAgent(reviews).map((r) => r.id)).toEqual(["b-222"]);
    expect(latestReviewPerAgent([...reviews].reverse()).map((r) => r.id)).toEqual(["b-222"]); // order-independent
  });
});
