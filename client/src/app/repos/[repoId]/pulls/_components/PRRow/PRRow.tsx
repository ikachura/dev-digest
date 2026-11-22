/* PRRow — one clickable row in the PR list table. Ported from screen_dashboard.jsx. */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Icon, Avatar, Badge, CircularScore } from "@devdigest/ui";
import type { PrMeta } from "@/lib/types";
import { SIZE_COLOR, STATUS_META } from "../../constants";
import { relativeTime, sizeOf } from "../../helpers";
import { formatUsd } from "@/lib/format";
import { usePrReviews } from "@/lib/hooks/reviews";
import { FindingsPopover, SeverityIcons, prFindings, totalCount } from "@/components/findings";
import { s } from "../../styles";

export function PRRow({
  pr,
  repoId,
  repoFullName,
}: {
  pr: PrMeta;
  repoId: string;
  /** owner/repo — for GitHub deep-links in the findings popover. */
  repoFullName?: string | null;
}) {
  const t = useTranslations("prReview");
  const tf = useTranslations("findings");
  // Popover details are fetched lazily, only once the user opens it (cached per PR).
  const [findingsOpen, setFindingsOpen] = React.useState(false);
  const reviewsQuery = usePrReviews(findingsOpen && pr.id ? pr.id : null);
  const popoverFindings = React.useMemo(
    () => (reviewsQuery.data ? prFindings(reviewsQuery.data) : undefined),
    [reviewsQuery.data],
  );
  const summary = pr.findings_summary;
  const router = useRouter();
  const [h, setH] = React.useState(false);
  const st = STATUS_META[pr.status] ?? STATUS_META.needs_review!;
  const { size, lines } = sizeOf(pr);
  const reviewed = pr.score != null; // null score ⇒ PR has never been reviewed
  return (
    <div
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      onClick={() => router.push(`/repos/${repoId}/pulls/${pr.number}`)}
      style={s.row(h)}
    >
      <div style={s.rowTitleCell}>
        <Icon.GitPullRequest size={15} style={s.rowIcon(st.c)} />
        <div style={s.rowTitleWrap}>
          <div style={s.rowTitle(h)}>{pr.title}</div>
          <span className="mono" style={s.rowNumber}>
            #{pr.number}
          </span>
        </div>
      </div>
      <div style={s.authorCell}>
        <Avatar name={pr.author} size={18} />
        {pr.author}
      </div>
      <div>
        <Badge
          color={SIZE_COLOR[size]}
          bg="transparent"
          style={s.sizeBadgeBorder(SIZE_COLOR[size]!)}
        >
          {size} · {lines}
        </Badge>
      </div>
      <div style={s.scoreCell}>
        {reviewed ? (
          <CircularScore score={pr.score!} size={34} stroke={3} />
        ) : (
          <span style={s.muted}>—</span>
        )}
      </div>
      <div style={s.findingsCell}>
        {summary && totalCount(summary) > 0 ? (
          <FindingsPopover
            variant="pr"
            findings={popoverFindings}
            repoFullName={repoFullName}
            headSha={pr.head_sha}
            onOpenChange={setFindingsOpen}
            ariaLabel={tf("icons.aria", {
              critical: summary.CRITICAL,
              warning: summary.WARNING,
              suggestion: summary.SUGGESTION,
            })}
          >
            <SeverityIcons counts={summary} />
          </FindingsPopover>
        ) : (
          <span style={s.muted}>—</span>
        )}
      </div>
      <div>
        <Badge dot color={st.c} bg="transparent">
          {t(`list.status.${st.labelKey}`)}
        </Badge>
      </div>
      <div
        className="mono tnum"
        style={s.costCell}
        title={
          pr.cost_usd == null
            ? t("list.costUnknown")
            : pr.cost_estimated
              ? t("list.costEstimated")
              : undefined
        }
      >
        {formatUsd(pr.cost_usd, { estimated: pr.cost_estimated })}
      </div>
      <div style={s.updatedCell}>{relativeTime(pr.updated_at)}</div>
    </div>
  );
}
