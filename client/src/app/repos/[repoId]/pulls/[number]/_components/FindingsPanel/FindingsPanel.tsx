/* FindingsPanel — severity counters/filter (HW1) + hide-low-confidence + j/k
   navigation + FindingCard list, wiring the accept/dismiss action hook (A2). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Toggle, EmptyState } from "@devdigest/ui";
import type { FindingRecord, Severity } from "@devdigest/shared";
import { FindingCard } from "../FindingCard";
import { useFindingAction } from "../../../../../../../lib/hooks/reviews";
import { SeverityCounters } from "./_components/SeverityCounters";
import { KEY_TO_ACTION } from "./constants";
import { countBySeverity, passesConfidence, visibleFindings } from "./helpers";
import { s } from "./styles";

export function FindingsPanel({
  findings,
  prId,
  repoFullName,
  headSha,
}: {
  findings: FindingRecord[];
  prId: string;
  repoFullName?: string | null;
  headSha?: string | null;
}) {
  const t = useTranslations("prReview");
  const action = useFindingAction();
  const [hideLow, setHideLow] = React.useState(false);
  const [severity, setSeverity] = React.useState<Severity | null>(null);
  const [focusIdx, setFocusIdx] = React.useState(0);

  // Counters follow Hide low confidence, so each number equals what clicking it shows.
  // Everything is derived from the `findings` prop: accept/dismiss refetches it and
  // the counts recompute; toggling a level never hits the network.
  const counts = React.useMemo(
    () => countBySeverity(passesConfidence(findings, hideLow)),
    [findings, hideLow],
  );
  const shown = React.useMemo(
    () => visibleFindings(findings, hideLow, severity),
    [findings, hideLow, severity],
  );

  const toggleSeverity = React.useCallback((level: Severity) => {
    setSeverity((cur) => (cur === level ? null : level));
    setFocusIdx(0);
  }, []);
  const toggleHideLow = React.useCallback((on: boolean) => {
    setHideLow(on);
    setFocusIdx(0);
  }, []);

  // j/k navigation + a/d shortcuts on the focused finding (keyboard).
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      // Clamp at 0: a severity filter can leave the list empty (length - 1 = -1).
      if (e.key === "j") setFocusIdx((i) => Math.max(0, Math.min(i + 1, shown.length - 1)));
      else if (e.key === "k") setFocusIdx((i) => Math.max(i - 1, 0));
      else if (KEY_TO_ACTION[e.key] && shown[focusIdx]) {
        action.mutate({ findingId: shown[focusIdx]!.id, action: KEY_TO_ACTION[e.key]!, prId });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shown, focusIdx, action, prId]);

  return (
    <div>
      <div style={s.toolbar}>
        <SeverityCounters counts={counts} active={severity} onToggle={toggleSeverity} />
        {(severity !== null || Object.values(counts).some((n) => n > 0)) && <div style={s.divider} aria-hidden />}
        <div style={s.toggleGroup}>
          {t("panel.hideLowConfidence")}
          <Toggle on={hideLow} onChange={toggleHideLow} size={16} />
        </div>
      </div>

      <div style={s.list}>
        {shown.length === 0 ? (
          <EmptyState icon="Filter" title={t("panel.noMatchTitle")} body={t("panel.noMatchBody")} />
        ) : (
          shown.map((f, i) => (
            <FindingCard
              // The filter is part of the key: FindingCard reads `defaultExpanded`
              // only on mount, so the first card of a newly filtered list must remount
              // to auto-expand (otherwise a card that was collapsed stays collapsed).
              key={`${severity ?? "all"}:${f.id}`}
              f={f}
              focused={i === focusIdx}
              defaultExpanded={i === 0}
              pending={action.isPending}
              repoFullName={repoFullName}
              headSha={headSha}
              onAction={(act) => action.mutate({ findingId: f.id, action: act, prId })}
            />
          ))
        )}
      </div>
    </div>
  );
}
