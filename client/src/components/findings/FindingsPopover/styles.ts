import type { CSSProperties } from "react";

export const POPOVER_WIDTH = 420;
export const POPOVER_MAX_HEIGHT = 360;

/** Co-located styles for FindingsPopover (HW1). */
export const s = {
  trigger: {
    display: "inline-flex",
    alignItems: "center",
    // Pointer: the icons are interactive (they open the findings popover).
    cursor: "pointer",
    borderRadius: 4,
    outlineOffset: 2,
  } satisfies CSSProperties,
  panel: (pos: { top?: number; bottom?: number; left: number }): CSSProperties => ({
    position: "fixed",
    ...pos,
    width: POPOVER_WIDTH,
    maxHeight: POPOVER_MAX_HEIGHT,
    overflowY: "auto",
    // Wheel scrolling stays inside the list (no chaining to the page at its ends).
    overscrollBehavior: "contain",
    zIndex: 60,
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    boxShadow: "0 12px 32px rgba(0,0,0,.35)",
    padding: "6px 0",
    cursor: "default",
  }),
  header: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 14px",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--text-muted)",
  } satisfies CSSProperties,
  item: {
    padding: "10px 14px",
    borderTop: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  } satisfies CSSProperties,
  titleRow: { display: "flex", alignItems: "center", gap: 8, minWidth: 0 } satisfies CSSProperties,
  title: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text-primary)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  } satisfies CSSProperties,
  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
    padding: "1px 6px",
    borderRadius: 4,
    fontSize: 11,
    color: "var(--text-muted)",
    background: "var(--bg-hover)",
  } satisfies CSSProperties,
  meta: { display: "flex", alignItems: "center", gap: 8, fontSize: 11, minWidth: 0 } satisfies CSSProperties,
  location: {
    color: "var(--accent)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    minWidth: 0,
  } satisfies CSSProperties,
  conf: { color: "var(--text-muted)", flexShrink: 0 } satisfies CSSProperties,
  rationale: {
    fontSize: 12,
    lineHeight: 1.45,
    color: "var(--text-secondary)",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  } satisfies CSSProperties,
  state: { padding: "10px 14px", fontSize: 12, color: "var(--text-muted)" } satisfies CSSProperties,
} as const;
