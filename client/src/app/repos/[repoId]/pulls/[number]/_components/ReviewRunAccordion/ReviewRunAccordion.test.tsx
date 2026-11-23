/** ReviewRunAccordion header — open findings as severity icons, no "blockers" text (HW1). */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { FindingRecord, ReviewRecord, Severity } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/prReview.json";

vi.mock("../../../../../../../lib/hooks/reviews", () => ({
  useDeleteReview: () => ({ mutate: vi.fn(), isPending: false }),
  useFindingAction: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { ReviewRunAccordion } from "./ReviewRunAccordion";

afterEach(cleanup);

function finding(id: string, severity: Severity, dismissed = false): FindingRecord {
  return {
    id, severity, category: "bug", title: `t-${id}`, file: "a.ts", start_line: 1, end_line: 1,
    rationale: "r", suggestion: null, confidence: 0.9, kind: "finding", trifecta_components: null,
    evidence: null, review_id: "rv", accepted_at: null, dismissed_at: dismissed ? "2026-11-22T00:00:00Z" : null,
  };
}

function review(findings: FindingRecord[]): ReviewRecord {
  return {
    id: "rv", pr_id: "pr1", agent_id: "a", run_id: "run", agent_name: "Security Reviewer", kind: "review",
    verdict: "request_changes", summary: "s", score: 20, model: null, grounding: null,
    created_at: "2026-11-22T00:00:00Z", findings,
  };
}

const renderAcc = (r: ReviewRecord) =>
  render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      <ReviewRunAccordion review={r} prId="pr1" defaultOpen={false} />
    </NextIntlClientProvider>,
  );

describe("ReviewRunAccordion header", () => {
  it("shows open findings per severity as icons, without a 'blockers' text", () => {
    const { container } = renderAcc(
      review([finding("1", "CRITICAL"), finding("2", "CRITICAL"), finding("3", "WARNING"), finding("4", "CRITICAL", true)]),
    );
    expect(container.querySelector('[data-severity="CRITICAL"]')).toHaveTextContent("2"); // dismissed excluded
    expect(container.querySelector('[data-severity="WARNING"]')).toHaveTextContent("1");
    expect(screen.queryByText(/blocker/)).not.toBeInTheDocument();
  });

  it("falls back to 'N findings' when nothing is open", () => {
    renderAcc(review([finding("1", "WARNING", true)]));
    expect(screen.getByText("1 finding")).toBeInTheDocument();
  });
});
