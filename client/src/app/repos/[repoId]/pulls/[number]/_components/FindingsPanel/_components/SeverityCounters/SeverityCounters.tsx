/* SeverityCounters — "ⓘ 1 Critical  ⚠ 4 Warning" pills above a run's findings (HW1).
   Pure presentation: counts come from findings already loaded by FindingsPanel; a click
   only toggles local filter state — no request, no model. Zero levels are hidden. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon, SEV } from "@devdigest/ui";
import type { Severity } from "@devdigest/shared";
import { SEVERITY_LEVELS } from "../../constants";
import { s } from "./styles";

export function SeverityCounters({
  counts,
  active,
  onToggle,
}: {
  counts: Record<Severity, number>;
  active: Severity | null;
  onToggle: (level: Severity) => void;
}) {
  const t = useTranslations("prReview");
  // Hide empty levels — except the ACTIVE one, which must stay visible (even at 0,
  // e.g. after Hide low confidence emptied it) so the filter can still be cleared.
  const levels = SEVERITY_LEVELS.filter((l) => counts[l] > 0 || l === active);
  if (levels.length === 0) return null;
  return (
    <div role="group" aria-label={t("panel.counters.label")} style={s.group}>
      {levels.map((level) => {
        const isActive = active === level;
        const I = Icon[SEV[level].icon];
        return (
          <button
            key={level}
            type="button"
            aria-pressed={isActive}
            onClick={() => onToggle(level)}
            style={s.pill({ active: isActive, color: SEV[level].c, bg: SEV[level].bg })}
          >
            <I size={13} aria-hidden />
            {t(`panel.counters.${level}`, { count: counts[level] })}
          </button>
        );
      })}
    </div>
  );
}
