import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { FindingRecord, Severity } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/prReview.json";

const mutate = vi.fn();
vi.mock("../../../../../../../lib/hooks/reviews", () => ({
  useFindingAction: () => ({ mutate, isPending: false }),
}));

import { FindingsPanel } from "./FindingsPanel";

afterEach(() => {
  cleanup();
  mutate.mockClear();
  vi.restoreAllMocks();
});

function finding(id: string, severity: Severity, title: string, confidence = 0.9): FindingRecord {
  return {
    id,
    severity,
    category: "security",
    title,
    file: "src/config.ts",
    start_line: 11,
    end_line: 11,
    rationale: `${title} - why`,
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

const FINDINGS: FindingRecord[] = [
  finding("f1", "CRITICAL", "Hardcoded secret", 0.95),
  finding("f2", "WARNING", "Missing rate limit", 0.9),
  finding("f3", "WARNING", "Maybe a race", 0.4), // low confidence
  finding("f4", "SUGGESTION", "Extract magic number", 0.8),
];
const ALL_TITLES = ["Hardcoded secret", "Missing rate limit", "Maybe a race", "Extract magic number"];

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const counters = () => within(screen.getByRole("group", { name: "Filter findings by severity" }));
const pill = (name: string | RegExp) => counters().getByRole("button", { name });
const visibleTitles = () => ALL_TITLES.filter((t) => screen.queryByText(t));
/** Card titles in the order they are rendered (cards sort by severity). */
const renderedOrder = () =>
  screen.getAllByText((_, el) => !!el && el.tagName === "SPAN" && ALL_TITLES.includes(el.textContent ?? ""))
    .map((el) => el.textContent);

describe("FindingsPanel (smoke)", () => {
  it("renders the toolbar + a finding card", () => {
    renderWithIntl(<FindingsPanel findings={FINDINGS.slice(0, 1)} prId="pr1" />);
    expect(screen.getByText("Hide low confidence")).toBeInTheDocument();
    expect(screen.getByText("Hardcoded secret")).toBeInTheDocument();
  });

  it("shows the empty state when nothing matches", () => {
    renderWithIntl(<FindingsPanel findings={[]} prId="pr1" />);
    expect(screen.getByText("No findings match")).toBeInTheDocument();
  });
});

describe("FindingsPanel — severity counters (HW1)", () => {
  it("shows one counter per level with the run's counts", () => {
    renderWithIntl(<FindingsPanel findings={FINDINGS} prId="pr1" />);
    expect(pill("1 Critical")).toBeInTheDocument();
    expect(pill("2 Warning")).toBeInTheDocument();
    expect(pill("1 Suggestion")).toBeInTheDocument();
    expect(visibleTitles()).toEqual(ALL_TITLES);
  });

  it("clicking a level keeps only its findings; another level moves the filter", () => {
    renderWithIntl(<FindingsPanel findings={FINDINGS} prId="pr1" />);

    fireEvent.click(pill("1 Critical"));
    expect(visibleTitles()).toEqual(["Hardcoded secret"]);
    expect(pill("1 Critical")).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(pill("2 Warning"));
    expect(visibleTitles()).toEqual(["Missing rate limit", "Maybe a race"]);
    expect(pill("2 Warning")).toHaveAttribute("aria-pressed", "true");
    expect(pill("1 Critical")).toHaveAttribute("aria-pressed", "false"); // single active level
  });

  it("clicking the active level again clears the filter", () => {
    renderWithIntl(<FindingsPanel findings={FINDINGS} prId="pr1" />);
    fireEvent.click(pill("1 Suggestion"));
    expect(visibleTitles()).toEqual(["Extract magic number"]);

    fireEvent.click(pill("1 Suggestion"));
    expect(visibleTitles()).toEqual(ALL_TITLES);
    for (const name of [/Critical/, /Warning/, /Suggestion/]) {
      expect(pill(name)).toHaveAttribute("aria-pressed", "false");
    }
  });

  it("composes with Hide low confidence: counts and list pass both conditions", () => {
    renderWithIntl(<FindingsPanel findings={FINDINGS} prId="pr1" />);
    fireEvent.click(pill("2 Warning"));
    fireEvent.click(screen.getByRole("switch"));

    expect(pill("1 Warning")).toHaveAttribute("aria-pressed", "true");
    expect(visibleTitles()).toEqual(["Missing rate limit"]);
  });

  it("levels with no findings are hidden (iteration 2, per the mockups)", () => {
    renderWithIntl(<FindingsPanel findings={FINDINGS.slice(1)} prId="pr1" />);
    expect(counters().getAllByRole("button").map((b) => b.textContent)).toEqual(["2 Warning", "1 Suggestion"]);
    expect(counters().queryByRole("button", { name: /Critical/ })).not.toBeInTheDocument();
  });

  it("pills carry the level's icon + label; only the active one is pressed", () => {
    renderWithIntl(<FindingsPanel findings={FINDINGS} prId="pr1" />);
    expect(pill("1 Critical").querySelector("svg")).not.toBeNull();
    fireEvent.click(pill("1 Critical"));
    expect(counters().getAllByRole("button").filter((b) => b.getAttribute("aria-pressed") === "true")).toHaveLength(1);
  });

  it("an active level that drops to 0 stays visible to clear the filter, then disappears", () => {
    const onlyLowWarning = [finding("w", "WARNING", "Maybe a race", 0.4)];
    renderWithIntl(<FindingsPanel findings={onlyLowWarning} prId="pr1" />);
    fireEvent.click(pill("1 Warning"));
    fireEvent.click(screen.getByRole("switch")); // hide low → WARNING becomes 0

    expect(screen.getByText("No findings match")).toBeInTheDocument();
    expect(pill("0 Warning")).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(pill("0 Warning"));
    // Filter cleared; the zero level is no longer active, so it is hidden like any other.
    expect(screen.queryByRole("button", { name: /Warning/ })).not.toBeInTheDocument();
  });

  it("after accept/dismiss refetch, counters still match the list (dismissed stay listed)", () => {
    const { rerender } = renderWithIntl(<FindingsPanel findings={FINDINGS} prId="pr1" />);
    fireEvent.click(pill("2 Warning"));
    // A real dismiss keeps the finding and only sets dismissed_at (card shown muted).
    const afterDismiss = FINDINGS.map((x) =>
      x.id === "f2" ? { ...x, dismissed_at: "2026-11-22T12:00:00Z" } : x,
    );
    rerender(
      <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
        <FindingsPanel findings={afterDismiss} prId="pr1" />
      </NextIntlClientProvider>,
    );
    expect(pill("2 Warning")).toHaveAttribute("aria-pressed", "true"); // filter survives refetch
    expect(visibleTitles()).toEqual(["Missing rate limit", "Maybe a race"]);
  });

  it("cards stay sorted by severity on screen, with and without a filter", () => {
    const shuffled = [FINDINGS[3]!, FINDINGS[1]!, FINDINGS[0]!, FINDINGS[2]!];
    renderWithIntl(<FindingsPanel findings={shuffled} prId="pr1" />);
    expect(renderedOrder()).toEqual(["Hardcoded secret", "Missing rate limit", "Maybe a race", "Extract magic number"]);
    fireEvent.click(pill("2 Warning"));
    expect(renderedOrder()).toEqual(["Missing rate limit", "Maybe a race"]);
  });

  it("the first card of a filtered list is expanded", () => {
    renderWithIntl(<FindingsPanel findings={FINDINGS} prId="pr1" />);
    expect(screen.getByText("Hardcoded secret - why")).toBeInTheDocument();
    expect(screen.queryByText("Missing rate limit - why")).not.toBeInTheDocument();
    fireEvent.click(pill("2 Warning"));
    expect(screen.getByText("Missing rate limit - why")).toBeInTheDocument();
  });

  it("changing the filter resets keyboard focus to the first visible card", () => {
    renderWithIntl(<FindingsPanel findings={FINDINGS} prId="pr1" />);
    fireEvent.keyDown(window, { key: "j" }); // focus moves to card #2
    fireEvent.click(pill("1 Critical")); // list has 1 card → focus must be back at 0
    fireEvent.keyDown(window, { key: "a" });
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ findingId: "f1", action: "accept" }));
  });

  it("j on an empty list doesn't push focus to -1", () => {
    // Filters make an empty list easy to reach; j must not go negative there, otherwise
    // when a refetch brings a card back, no card is focused and `a`/`d` are lost.
    const noCritical = [finding("w", "WARNING", "Missing rate limit")];
    const { rerender } = renderWithIntl(<FindingsPanel findings={noCritical} prId="pr1" />);
    fireEvent.click(pill("1 Warning"));
    fireEvent.click(pill("1 Warning")); // back to all
    rerender(
      <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
        <FindingsPanel findings={[]} prId="pr1" />
      </NextIntlClientProvider>,
    );
    fireEvent.keyDown(window, { key: "j" }); // empty list
    rerender(
      <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
        <FindingsPanel findings={noCritical} prId="pr1" />
      </NextIntlClientProvider>,
    );
    fireEvent.keyDown(window, { key: "d" });
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ findingId: "w", action: "dismiss" }));
  });

  it("clicking counters triggers no finding action and no fetch", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    renderWithIntl(<FindingsPanel findings={FINDINGS} prId="pr1" />);
    fireEvent.click(pill("1 Critical"));
    fireEvent.click(pill("2 Warning"));
    fireEvent.click(pill("2 Warning"));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mutate).not.toHaveBeenCalled();
  });
});
