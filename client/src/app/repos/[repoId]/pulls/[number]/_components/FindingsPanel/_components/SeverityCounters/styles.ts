import type { CSSProperties } from "react";

/** Co-located styles for SeverityCounters (HW1). Level colours come from SEV at call sites. */
export const s = {
  group: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" } satisfies CSSProperties,
  /**
   * Idle = neutral outline (that is the "muted" state of non-active levels).
   * Active = the level's SEV colour on border/icon/text + its soft SEV background —
   * the same pair SeverityBadge uses, readable in both themes. State-driven, never hover.
   */
  pill: ({ active, color, bg }: { active: boolean; color: string; bg: string }): CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 12px",
    borderRadius: 999,
    border: `1px solid ${active ? color : "var(--border)"}`,
    background: active ? bg : "transparent",
    color: active ? color : "var(--text-secondary)",
    fontSize: 13,
    fontWeight: active ? 600 : 500,
    fontVariantNumeric: "tabular-nums",
    cursor: "pointer",
    transition: "background .1s, border-color .1s, color .1s",
  }),
} as const;
