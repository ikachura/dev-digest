/** PRRow — Cost column (M1) + Findings column with lazy popover (HW1). */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { FindingRecord, PrMeta, ReviewRecord, Severity } from "@devdigest/shared";
import messages from "../../../../../../../messages/en/prReview.json";
import findingsMessages from "../../../../../../../messages/en/findings.json";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
}));

// Reviews returned for the lazily-opened popover; `calls` records the prId the row asked for.
const calls: (string | null | undefined)[] = [];
let reviewsData: ReviewRecord[] | undefined;
vi.mock("@/lib/hooks/reviews", () => ({
  usePrReviews: (prId: string | null | undefined) => {
    calls.push(prId);
    return { data: prId ? reviewsData : undefined };
  },
}));

import { PRRow } from "./PRRow";

afterEach(() => {
  cleanup();
  calls.length = 0;
  reviewsData = undefined;
  push.mockClear();
});

function pr(o: Partial<PrMeta>): PrMeta {
  return {
    id: "pr-1",
    number: 482,
    title: "Add rate limiting to public API endpoints",
    author: "marisa.koch",
    branch: "feat/rate-limit-public",
    base: "main",
    head_sha: "abc123",
    additions: 247,
    deletions: 38,
    files_count: 9,
    status: "needs_review",
    opened_at: null,
    updated_at: null,
    score: 61,
    ...o,
  };
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
    rationale: `${title} - why`,
    suggestion: null,
    confidence: 0.9,
    kind: "finding",
    trifecta_components: null,
    evidence: null,
    review_id: "r",
    accepted_at: null,
    dismissed_at: dismissed ? "2026-11-22T10:00:00Z" : null,
  };
}

function review(id: string, agent: string, created: string, findings: FindingRecord[]): ReviewRecord {
  return {
    id,
    pr_id: "pr-1",
    agent_id: agent,
    run_id: `run-${id}`,
    agent_name: agent,
    kind: "review",
    verdict: "comment",
    summary: null,
    score: null,
    model: null,
    grounding: null,
    created_at: created,
    findings,
  };
}

function renderRow(p: PrMeta) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages, findings: findingsMessages }}>
      <PRRow pr={p} repoId="repo-1" />
    </NextIntlClientProvider>,
  );
}

describe("PRRow — cost column", () => {
  it("shows the PR's total run cost", () => {
    renderRow(pr({ cost_usd: 0.014 }));
    expect(screen.getByText("$0.0140")).toBeInTheDocument();
  });

  it("shows a dash with a tooltip when no run has a known cost", () => {
    renderRow(pr({ cost_usd: null, score: null }));
    const cell = screen.getByTitle("No run with a known cost yet");
    expect(cell).toHaveTextContent("—");
  });

  it("marks a total that includes estimated runs with ~ and a tooltip", () => {
    renderRow(pr({ cost_usd: 0.0021, cost_estimated: true }));
    const cell = screen.getByTitle("Approximate: includes runs estimated from tokens × list price");
    expect(cell).toHaveTextContent("~$0.0021");
  });
});

describe("PRRow — findings column (HW1)", () => {
  const trigger = () => screen.getByRole("button", { name: /critical, .* warning, .* suggestion/ });

  it("shows icon + count per non-zero level", () => {
    renderRow(pr({ findings_summary: { CRITICAL: 2, WARNING: 0, SUGGESTION: 1 } }));
    const t = trigger();
    expect(t.querySelector('[data-severity="CRITICAL"]')).toHaveTextContent("2");
    expect(t.querySelector('[data-severity="SUGGESTION"]')).toHaveTextContent("1");
    expect(t.querySelector('[data-severity="WARNING"]')).toBeNull();
  });

  it("shows — when there are no open findings or no review", () => {
    renderRow(pr({ findings_summary: { CRITICAL: 0, WARNING: 0, SUGGESTION: 0 } }));
    expect(screen.queryByRole("button", { name: /critical/ })).not.toBeInTheDocument();
    cleanup();
    renderRow(pr({ findings_summary: null, score: null }));
    expect(screen.queryByRole("button", { name: /critical/ })).not.toBeInTheDocument();
  });

  it("loads reviews only when the popover opens, then lists latest-per-agent open findings", () => {
    reviewsData = [
      review("old", "sec", "2026-11-20T10:00:00Z", [finding("x", "CRITICAL", "Stale finding from an old run")]),
      review("new", "sec", "2026-11-21T10:00:00Z", [
        finding("a", "CRITICAL", "Hardcoded Stripe secret key"),
        finding("b", "WARNING", "Dismissed one", true),
      ]),
      review("perf", "perf", "2026-11-21T09:00:00Z", [finding("c", "SUGGESTION", "Extract magic number")]),
    ];
    renderRow(pr({ findings_summary: { CRITICAL: 1, WARNING: 0, SUGGESTION: 1 } }));
    expect(calls.every((c) => c === null)).toBe(true); // nothing fetched before hover

    fireEvent.mouseEnter(trigger());
    expect(calls.at(-1)).toBe("pr-1");
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("2 findings")).toBeInTheDocument();
    expect(within(dialog).getByText("Hardcoded Stripe secret key")).toBeInTheDocument();
    expect(within(dialog).getByText("Extract magic number")).toBeInTheDocument();
    expect(within(dialog).queryByText("Dismissed one")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Stale finding from an old run")).not.toBeInTheDocument();
  });

  it("clicking the findings cell does not open the PR; the row still does", () => {
    renderRow(pr({ findings_summary: { CRITICAL: 1, WARNING: 0, SUGGESTION: 0 } }));
    fireEvent.click(trigger());
    expect(push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Add rate limiting to public API endpoints"));
    expect(push).toHaveBeenCalledWith("/repos/repo-1/pulls/482");
  });
});
