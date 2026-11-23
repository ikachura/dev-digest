/* refreshPullsLists — the PR list cache must be refetched even while the list is not
   on screen, otherwise returning to it flashes the old Cost / Findings / Score (HW1). */
import { describe, it, expect, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { refreshPullsLists } from "./core";

function clientWithCachedList() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let version = 0;
  const queryFn = vi.fn(async () => [{ number: 1, cost_usd: ++version }]);
  return { qc, queryFn };
}

describe("refreshPullsLists", () => {
  it("refetches an INACTIVE cached PR list immediately (no stale flash on the next visit)", async () => {
    const { qc, queryFn } = clientWithCachedList();
    await qc.prefetchQuery({ queryKey: ["pulls", "repo-1"], queryFn }); // cached, no observer = inactive
    expect(queryFn).toHaveBeenCalledTimes(1);

    await refreshPullsLists(qc);

    expect(queryFn).toHaveBeenCalledTimes(2);
    expect(qc.getQueryData<{ cost_usd: number }[]>(["pulls", "repo-1"])?.[0]?.cost_usd).toBe(2);
  });

  it("(contrast) a plain invalidate does NOT refetch an inactive list — the old bug", async () => {
    const { qc, queryFn } = clientWithCachedList();
    await qc.prefetchQuery({ queryKey: ["pulls", "repo-1"], queryFn });
    await qc.invalidateQueries({ queryKey: ["pulls"] });
    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it("refreshes every repo's list (prefix match), and nothing else", async () => {
    const { qc, queryFn } = clientWithCachedList();
    const other = vi.fn(async () => "x");
    await qc.prefetchQuery({ queryKey: ["pulls", "repo-1"], queryFn });
    await qc.prefetchQuery({ queryKey: ["pulls", "repo-2"], queryFn });
    await qc.prefetchQuery({ queryKey: ["agents"], queryFn: other });

    await refreshPullsLists(qc);

    expect(queryFn).toHaveBeenCalledTimes(4);
    expect(other).toHaveBeenCalledTimes(1);
  });
});
