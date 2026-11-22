/**
 * RunHistory — the badge must reflect the review OUTCOME, not the run lifecycle.
 * Regression guard for the "green ✓ done on a run that found 5 blockers" bug:
 * a settled run is colored/labelled by its denormalized blocker/finding counts,
 * and shows the review score ring.
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { FindingRecord, ReviewRecord, RunSummary, Severity } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/prReview.json";
import findingsMessages from "../../../../../../../../messages/en/findings.json";
import { RunHistory } from "./RunHistory";

afterEach(cleanup);

function run(o: Partial<RunSummary>): RunSummary {
  return {
    run_id: "run-1",
    agent_id: "a1",
    agent_name: "Security Reviewer",
    provider: "openrouter",
    model: "deepseek/deepseek-v4-flash",
    status: "done",
    error: null,
    duration_ms: 1000,
    tokens_in: 100,
    tokens_out: 50,
    cost_usd: null,
    cost_estimated: false,
    findings_count: 0,
    grounding: "0/0 passed",
    ran_at: "2026-06-11T18:44:34.000Z",
    score: null,
    blockers: null,
    ...o,
  };
}

function renderRuns(runs: RunSummary[], reviews: ReviewRecord[] = []) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages, findings: findingsMessages }}>
      <RunHistory runs={runs} reviews={reviews} onOpenTrace={() => {}} />
    </NextIntlClientProvider>,
  );
}

function finding(id: string, severity: Severity, title: string, dismissed = false): FindingRecord {
  return {
    id,
    severity,
    category: "security",
    title,
    file: "src/config.ts",
    start_line: 12,
    end_line: 12,
    rationale: "why",
    suggestion: null,
    confidence: 0.9,
    kind: "finding",
    trifecta_components: null,
    evidence: null,
    review_id: "rv1",
    accepted_at: null,
    dismissed_at: dismissed ? "2026-11-22T00:00:00Z" : null,
  };
}

function reviewFor(runId: string, findings: FindingRecord[]): ReviewRecord {
  return {
    id: `rv-${runId}`,
    pr_id: "pr1",
    agent_id: "a1",
    run_id: runId,
    agent_name: "Security Reviewer",
    kind: "review",
    verdict: "request_changes",
    summary: null,
    score: 30,
    model: null,
    grounding: null,
    created_at: "2026-06-11T18:44:34.000Z",
    findings,
  };
}

describe("RunHistory — outcome badge", () => {
  it("a done run WITH blockers reads 'rejected' (never green 'done') + shows the score ring", () => {
    renderRuns([run({ status: "done", findings_count: 5, blockers: 5, score: 0 })]);
    expect(screen.getByText("rejected")).toBeInTheDocument();
    expect(screen.queryByText("done")).not.toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument(); // CircularScore renders the number
    expect(screen.getByText(/5 blockers/)).toBeInTheDocument();
  });

  it("a clean done run reads 'approved'", () => {
    renderRuns([run({ status: "done", findings_count: 0, blockers: 0, score: 95 })]);
    expect(screen.getByText("approved")).toBeInTheDocument();
    expect(screen.getByText("95")).toBeInTheDocument();
  });

  it("a done run with non-blocking findings reads 'reviewed'", () => {
    renderRuns([run({ status: "done", findings_count: 3, blockers: 0, score: 72 })]);
    expect(screen.getByText("reviewed")).toBeInTheDocument();
    expect(screen.queryByText(/blockers/)).not.toBeInTheDocument();
  });

  it("a failed run reads 'error'", () => {
    renderRuns([run({ status: "failed", error: "boom", score: null, blockers: null })]);
    expect(screen.getByText("error")).toBeInTheDocument();
  });

  it("a running run reads 'running'", () => {
    renderRuns([run({ status: "running", score: null, blockers: null })]);
    expect(screen.getByText("running")).toBeInTheDocument();
  });
});

describe("RunHistory — cost badge (M1)", () => {
  it("a done run shows total tokens and its USD cost", () => {
    renderRuns([run({ tokens_in: 9000, tokens_out: 119, cost_usd: 0.0013 })]);
    expect(screen.getByText(/9,119 tok · \$0\.0013/)).toBeInTheDocument();
  });

  it("a done run with unknown cost shows a dash", () => {
    renderRuns([run({ cost_usd: null })]);
    expect(screen.getByText(/150 tok · —/)).toBeInTheDocument();
  });

  it("an estimated cost reads ~ and explains itself in a tooltip", () => {
    renderRuns([run({ tokens_in: 2867, tokens_out: 277, cost_usd: 0.00031, cost_estimated: true })]);
    const line = screen.getByText(/3,144 tok · ~\$0\.0003/);
    expect(line).toHaveAttribute("title", "Estimated from tokens × list price (not the billed amount)");
  });

  it("a failed run shows no cost line", () => {
    renderRuns([run({ status: "failed", error: "429 quota", cost_usd: null })]);
    expect(screen.queryByText(/tok ·/)).not.toBeInTheDocument();
  });
});

describe("RunHistory — severity icons + popover (HW1)", () => {
  const FINDINGS = [
    finding("c1", "CRITICAL", "Hardcoded secret"),
    finding("c2", "CRITICAL", "SSRF forwarder"),
    finding("w1", "WARNING", "Missing rate limit"),
    finding("w2", "WARNING", "Dismissed warning", true),
  ];

  it("a settled run shows icon+count per level from its review's open findings", () => {
    renderRuns([run({ run_id: "run-1", findings_count: 4, blockers: 2 })], [reviewFor("run-1", FINDINGS)]);
    const icons = screen.getByRole("button", { name: /2 critical, 1 warning, 0 suggestion/ });
    expect(icons.querySelector('[data-severity="CRITICAL"]')).toHaveTextContent("2");
    expect(icons.querySelector('[data-severity="WARNING"]')).toHaveTextContent("1"); // dismissed excluded
    expect(icons.querySelector('[data-severity="SUGGESTION"]')).toBeNull();
    // No "· N blockers" text next to the icons: the red CRITICAL icon already says it.
    expect(screen.queryByText(/blocker/)).not.toBeInTheDocument();
  });

  it("hovering the icons lists that run's open findings (no fetch: data comes from props)", () => {
    renderRuns([run({ run_id: "run-1", findings_count: 4, blockers: 2 })], [reviewFor("run-1", FINDINGS)]);
    fireEvent.mouseEnter(screen.getByRole("button", { name: /critical/ }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("3 findings in this run")).toBeInTheDocument();
    expect(within(dialog).getByText("Hardcoded secret")).toBeInTheDocument();
    expect(within(dialog).queryByText("Dismissed warning")).not.toBeInTheDocument();
  });

  it("a run without a matching review keeps the plain 'N finding(s)' text", () => {
    renderRuns([run({ run_id: "run-2", findings_count: 3 })], [reviewFor("run-1", FINDINGS)]);
    expect(screen.queryByRole("button", { name: /critical/ })).not.toBeInTheDocument();
    expect(screen.getByText(/3 finding/)).toBeInTheDocument();
  });

  it("all findings dismissed → '0 findings' and no stale blockers from the stored run", () => {
    const allDismissed = [finding("c1", "CRITICAL", "A", true), finding("w1", "WARNING", "B", true)];
    renderRuns([run({ run_id: "run-1", findings_count: 2, blockers: 1 })], [reviewFor("run-1", allDismissed)]);
    expect(screen.getByText("0 finding(s)")).toBeInTheDocument();
    expect(screen.queryByText(/blocker/)).not.toBeInTheDocument();
  });

  it("the CRITICAL icon shows the live open count, not the blockers snapshot stored at completion", () => {
    const oneOpenCritical = [finding("c1", "CRITICAL", "A"), finding("c2", "CRITICAL", "B", true)];
    renderRuns([run({ run_id: "run-1", findings_count: 2, blockers: 2 })], [reviewFor("run-1", oneOpenCritical)]);
    const icons = screen.getByRole("button", { name: /critical/ });
    expect(icons.querySelector('[data-severity="CRITICAL"]')).toHaveTextContent("1");
    expect(screen.queryByText(/blocker/)).not.toBeInTheDocument();
  });
});
