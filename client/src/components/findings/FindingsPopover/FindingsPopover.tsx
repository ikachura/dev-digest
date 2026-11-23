/* FindingsPopover — hover/focus popover listing findings (HW1), shared by the PR-page
   Timeline and the PR list. Rendered through a portal with `position: fixed`, because
   the PR list table clips overflow. Opens on mouseenter AND keyboard focus; closes on
   leave (with a short grace period so the pointer can move into it), blur, Escape or
   scroll. Purely presentational: callers pass findings (or `undefined` while loading). */
"use client";

import React from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Icon, SEV, CAT } from "@devdigest/ui";
import type { FindingRecord } from "@devdigest/shared";
import { githubBlobUrl } from "@/lib/github-urls";
import { s, POPOVER_MAX_HEIGHT, POPOVER_WIDTH } from "./styles";

const SEVERITY_ORDER: Record<string, number> = { CRITICAL: 0, WARNING: 1, SUGGESTION: 2 };
const CLOSE_DELAY_MS = 120;
const GAP = 6;

type Pos = { top?: number; bottom?: number; left: number };

export function FindingsPopover({
  variant,
  findings,
  ariaLabel,
  onOpenChange,
  repoFullName,
  headSha,
  children,
}: {
  /** "run" → "N findings in this run"; "pr" → "N findings". */
  variant: "run" | "pr";
  /** `undefined` = still loading (PR list fetches lazily on open). */
  findings: FindingRecord[] | undefined;
  ariaLabel: string;
  onOpenChange?: (open: boolean) => void;
  /** owner/repo + head sha → `file:line` opens the blob on GitHub (like FindingCard). */
  repoFullName?: string | null;
  headSha?: string | null;
  children: React.ReactNode;
}) {
  const t = useTranslations("findings");
  const triggerRef = React.useRef<HTMLSpanElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const panelId = React.useId();
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pos, setPos] = React.useState<Pos | null>(null);
  const open = pos !== null;

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  /** Place the panel next to the trigger; returns false when the trigger is off-screen. */
  const place = React.useCallback((): boolean => {
    const el = triggerRef.current;
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) return false;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - POPOVER_WIDTH - 8));
    // Flip above the trigger when there's no room below.
    const below = window.innerHeight - r.bottom;
    const next: Pos =
      below < POPOVER_MAX_HEIGHT + GAP && r.top > below
        ? { bottom: window.innerHeight - r.top + GAP, left }
        : { top: r.bottom + GAP, left };
    setPos(next);
    return true;
  }, []);
  const show = React.useCallback(() => {
    cancelClose();
    place();
  }, [place]);
  const hide = React.useCallback(() => {
    cancelClose();
    setPos(null);
  }, []);
  const scheduleHide = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => {
      // Pointer left, but keyboard focus is still on the trigger or inside the panel:
      // keep it open (it closes on blur / Escape instead).
      const active = document.activeElement;
      if (active && (active === triggerRef.current || panelRef.current?.contains(active))) return;
      hide();
    }, CLOSE_DELAY_MS);
  };

  React.useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  // Escape closes. Page scroll / resize: the fixed panel FOLLOWS its trigger and only
  // closes once the trigger has left the screen (closing on any scroll made the popover
  // vanish whenever a wheel scroll reached the page, e.g. at the end of its list).
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && hide();
    const follow = (e?: Event) => {
      // Capture phase also sees the panel's own list scrolling — nothing to do then.
      if (e?.target instanceof Node && panelRef.current?.contains(e.target)) return;
      if (!place()) hide();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", follow, true);
    window.addEventListener("resize", follow);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", follow, true);
      window.removeEventListener("resize", follow);
    };
  }, [open, hide, place]);

  React.useEffect(() => cancelClose, []);

  const sorted = findings
    ? [...findings].sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9))
    : undefined;

  return (
    <>
      <span
        ref={triggerRef}
        tabIndex={0}
        role="button"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onMouseEnter={show}
        onMouseLeave={scheduleHide}
        onFocus={show}
        onBlur={(e) => {
          // Keep it open when focus moves into the panel.
          if (!(e.relatedTarget instanceof Node && panelRef.current?.contains(e.relatedTarget))) hide();
        }}
        // Inside a clickable PR row: hovering details must not navigate.
        onClick={(e) => e.stopPropagation()}
        style={s.trigger}
      >
        {children}
      </span>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-label={ariaLabel}
            // Focusable so keyboard users can Tab into it and scroll a long list
            // with the arrow keys; leaving it (blur) closes the popover.
            tabIndex={0}
            onBlur={(e) => {
              const to = e.relatedTarget;
              if (!(to instanceof Node && (panelRef.current?.contains(to) || triggerRef.current?.contains(to)))) hide();
            }}
            style={s.panel(pos!)}
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleHide}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={s.header}>
              <Icon.FileText size={12} aria-hidden />
              {sorted
                ? t(variant === "run" ? "popover.titleRun" : "popover.titlePr", { count: sorted.length })
                : t("popover.loading")}
            </div>
            {sorted && sorted.length === 0 && <div style={s.state}>{t("popover.empty")}</div>}
            {sorted?.map((f) => {
              const sev = SEV[f.severity];
              const SevIcon = Icon[sev.icon];
              const cat = CAT[f.category];
              const CatIcon = cat ? Icon[cat.icon] : null;
              const lines = f.end_line && f.end_line !== f.start_line ? `${f.start_line}-${f.end_line}` : `${f.start_line}`;
              return (
                <div key={f.id} style={s.item}>
                  <div style={s.titleRow}>
                    <SevIcon size={14} color={sev.c} aria-label={sev.label} style={{ flexShrink: 0 }} />
                    <span style={s.title} title={f.title}>
                      {f.title}
                    </span>
                    {cat && (
                      <span style={s.chip}>
                        {CatIcon && <CatIcon size={11} aria-hidden />}
                        {cat.label}
                      </span>
                    )}
                  </div>
                  <div style={s.meta} className="mono">
                    {repoFullName && headSha ? (
                      <FileLink href={githubBlobUrl(repoFullName, headSha, f.file, f.start_line, f.end_line)}>
                        {f.file}:{lines}
                      </FileLink>
                    ) : (
                      <span style={s.location} title={`${f.file}:${lines}`}>
                        {f.file}:{lines}
                      </span>
                    )}
                    <span style={s.conf}>{t("popover.confidence", { pct: Math.round(f.confidence * 100) })}</span>
                  </div>
                  <div style={s.rationale}>{f.rationale}</div>
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}

/** `file:line` deep-link to GitHub; new tab, underline on hover, never bubbles to the PR row. */
function FileLink({ href, children }: { href: string; children: React.ReactNode }) {
  const [hover, setHover] = React.useState(false);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={href}
      onClick={(e) => e.stopPropagation()}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ ...s.location, cursor: "pointer", textDecoration: hover ? "underline" : "none", textUnderlineOffset: 2 }}
    >
      {children}
    </a>
  );
}
