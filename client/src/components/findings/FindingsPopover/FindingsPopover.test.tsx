import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { FindingRecord, Severity } from "@devdigest/shared";
import messages from "../../../../messages/en/findings.json";
import { FindingsPopover } from "./FindingsPopover";

afterEach(cleanup);

function f(id: string, severity: Severity, title: string, confidence = 0.95): FindingRecord {
  return {
    id,
    severity,
    category: "security",
    title,
    file: "lib/analytics.router.ts",
    start_line: 19,
    end_line: 55,
    rationale: `${title} — long explanation`,
    suggestion: null,
    confidence,
    kind: "finding",
    trifecta_components: null,
    evidence: null,
    review_id: "r",
    accepted_at: null,
    dismissed_at: null,
  };
}

function renderPopover(findings: FindingRecord[] | undefined, variant: "run" | "pr" = "run") {
  return render(
    <NextIntlClientProvider locale="en" messages={{ findings: messages }}>
      <FindingsPopover variant={variant} findings={findings} ariaLabel="Show findings">
        <span>icons</span>
      </FindingsPopover>
    </NextIntlClientProvider>,
  );
}

const trigger = () => screen.getByRole("button", { name: "Show findings" });

describe("FindingsPopover", () => {
  const FINDINGS = [f("w", "WARNING", "Date range is inclusive", 0.85), f("c", "CRITICAL", "Endpoints are unauthenticated")];

  it("is closed until hovered; hover opens it with a header and items sorted by severity", () => {
    renderPopover(FINDINGS);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger()).toHaveAttribute("aria-expanded", "false");

    fireEvent.mouseEnter(trigger());
    const dialog = screen.getByRole("dialog");
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    expect(within(dialog).getByText("2 findings in this run")).toBeInTheDocument();
    const titles = within(dialog).getAllByText(/unauthenticated|inclusive/).map((el) => el.textContent);
    expect(titles[0]).toBe("Endpoints are unauthenticated"); // CRITICAL first
    expect(within(dialog).getAllByText("lib/analytics.router.ts:19-55")).toHaveLength(2);
    expect(within(dialog).getByText("85% conf")).toBeInTheDocument();
    expect(within(dialog).getAllByText("security")).toHaveLength(2); // category chip per item
  });

  it("opens on keyboard focus and closes on Escape", () => {
    renderPopover(FINDINGS);
    fireEvent.focus(trigger());
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows a loading state while findings are undefined, and the PR-variant title once loaded", () => {
    const { rerender } = renderPopover(undefined, "pr");
    fireEvent.mouseEnter(trigger());
    expect(screen.getByText("Loading findings…")).toBeInTheDocument();
    rerender(
      <NextIntlClientProvider locale="en" messages={{ findings: messages }}>
        <FindingsPopover variant="pr" findings={[FINDINGS[1]!]} ariaLabel="Show findings">
          <span>icons</span>
        </FindingsPopover>
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("1 finding")).toBeInTheDocument();
  });

  it("stays open while the pointer moves from the trigger into the panel", async () => {
    renderPopover(FINDINGS);
    fireEvent.mouseEnter(trigger());
    fireEvent.mouseLeave(trigger());
    fireEvent.mouseEnter(screen.getByRole("dialog"));
    await new Promise((r) => setTimeout(r, 200)); // longer than the close grace period
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.mouseLeave(screen.getByRole("dialog"));
    await new Promise((r) => setTimeout(r, 200));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("scrolling inside the panel or the page keeps it open; it closes once the trigger leaves the screen", () => {
    renderPopover(FINDINGS);
    fireEvent.mouseEnter(trigger());
    fireEvent.scroll(screen.getByRole("dialog"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.scroll(window); // trigger still on screen → panel follows it, stays open
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    // Trigger scrolled out of view → close.
    trigger().getBoundingClientRect = () => ({ top: -100, bottom: -80, left: 0, right: 10, width: 10, height: 20, x: 0, y: -100, toJSON: () => ({}) });
    fireEvent.scroll(window);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("the trigger shows a pointer cursor and the panel contains its own scroll", () => {
    renderPopover(FINDINGS);
    expect(trigger()).toHaveStyle({ cursor: "pointer" });
    fireEvent.mouseEnter(trigger());
    expect(screen.getByRole("dialog").style.overscrollBehavior).toBe("contain");
  });

  it("stays open after the pointer leaves while the trigger keeps keyboard focus", async () => {
    renderPopover(FINDINGS);
    trigger().focus();
    fireEvent.mouseEnter(trigger());
    fireEvent.mouseLeave(trigger());
    await new Promise((r) => setTimeout(r, 200));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("the panel is focusable so a long list can be scrolled from the keyboard", () => {
    renderPopover(FINDINGS);
    fireEvent.focus(trigger());
    expect(screen.getByRole("dialog")).toHaveAttribute("tabindex", "0");
  });

  it("file:line links to the blob on GitHub when repo + head sha are known", () => {
    render(
      <NextIntlClientProvider locale="en" messages={{ findings: messages }}>
        <FindingsPopover variant="pr" findings={[FINDINGS[1]!]} ariaLabel="Show findings" repoFullName="acme/app" headSha="abc123">
          <span>icons</span>
        </FindingsPopover>
      </NextIntlClientProvider>,
    );
    fireEvent.mouseEnter(trigger());
    const link = screen.getByRole("link", { name: "lib/analytics.router.ts:19-55" });
    expect(link).toHaveAttribute("href", "https://github.com/acme/app/blob/abc123/lib/analytics.router.ts#L19-L55");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("without repo/sha the location is plain text (no broken link)", () => {
    renderPopover(FINDINGS);
    fireEvent.mouseEnter(trigger());
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
