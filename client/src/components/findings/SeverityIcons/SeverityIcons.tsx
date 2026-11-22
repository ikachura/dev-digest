/* SeverityIcons — compact "ⓘ 2  ⚠ 1  💡 1" summary (HW1). Non-zero levels only,
   coloured by SEV; renders nothing when every level is 0. Used as a popover trigger. */
"use client";

import React from "react";
import { Icon, SEV } from "@devdigest/ui";
import { SEVERITY_LEVELS, type SeverityCounts } from "../summary";

export function SeverityIcons({
  counts,
  underline = true,
}: {
  counts: Partial<SeverityCounts>;
  /** Dotted underline hints "hover for details" — off where there is no popover. */
  underline?: boolean;
}) {
  const levels = SEVERITY_LEVELS.filter((l) => (counts[l] ?? 0) > 0);
  if (levels.length === 0) return null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      {levels.map((level) => {
        const I = Icon[SEV[level].icon];
        return (
          <span
            key={level}
            data-severity={level}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              color: SEV[level].c,
              fontSize: 12,
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
              // Dotted underline (mockup) hints that hovering reveals details.
              borderBottom: underline ? `1px dotted ${SEV[level].c}` : "none",
              paddingBottom: underline ? 1 : 0,
            }}
          >
            <I size={12} aria-hidden />
            {counts[level]}
          </span>
        );
      })}
    </span>
  );
}
