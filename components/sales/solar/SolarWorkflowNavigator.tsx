"use client";

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { ChevronRight } from "lucide-react";
import { SOLAR_SALES_STAGE_LABEL, type SolarSalesStage } from "@/lib/sales/solar-workflow";
import { cn } from "@/lib/ui/cn";

export const SOLAR_SALES_PAGE_TITLE = "Solar Sales";
export const SOLAR_SALES_PAGE_DESCRIPTION =
  "Manage every opportunity from first enquiry to won customer.";
export const SOLAR_SALES_PAGE_NOTE =
  "Pre-sale workflow • Delivery begins after the deal is won.";

/** Short navigator labels. Underlying stage ids and board headings stay unchanged. */
const NAV_LABEL: Record<SolarSalesStage, string> = {
  NEW_LEAD: "New Lead",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  SITE_VISIT_REQUIRED: "Site Visit",
  SITE_VISIT_COMPLETED: "Assessment",
  PROPOSAL_PREPARED: "Proposal",
  QUOTE_SENT: "Quote Sent",
  NEGOTIATION: "Negotiation",
  WON: "Won",
  LOST: "Lost",
};

const FLOW_STAGES: SolarSalesStage[] = [
  "NEW_LEAD",
  "CONTACTED",
  "QUALIFIED",
  "SITE_VISIT_REQUIRED",
  "SITE_VISIT_COMPLETED",
  "PROPOSAL_PREPARED",
  "QUOTE_SENT",
  "NEGOTIATION",
  "WON",
];

function opportunityPhrase(count: number) {
  return count === 1 ? "1 opportunity" : `${count} opportunities`;
}

function findScrollParent(el: HTMLElement): HTMLElement | null {
  let node = el.parentElement;
  while (node && node !== document.body && node !== document.documentElement) {
    const overflowY = getComputedStyle(node).overflowY;
    if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") return node;
    node = node.parentElement;
  }
  return null;
}

function pinnedChromeOffset(nav: HTMLElement) {
  let offset = 0;
  document.querySelectorAll("header, [data-impersonation-banner]").forEach((node) => {
    if (!(node instanceof HTMLElement) || node.contains(nav)) return;
    const style = getComputedStyle(node);
    if (style.position !== "sticky" && style.position !== "fixed") return;
    const top = Number.parseFloat(style.top);
    if (!Number.isFinite(top) || top > 1) return;
    if (style.display === "none" || style.visibility === "hidden") return;
    offset = Math.max(offset, node.getBoundingClientRect().height);
  });
  return offset;
}

function scrollBehavior(): ScrollBehavior {
  if (typeof window === "undefined") return "auto";
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

export function SolarWorkflowNavigator({
  counts,
  mode,
  selected,
  onSelect,
  scrollerRef,
  columnNodes,
  observeKey,
}: {
  counts: Record<SolarSalesStage, number>;
  mode: "scroll" | "select";
  selected?: SolarSalesStage;
  onSelect?: (stage: SolarSalesStage) => void;
  scrollerRef: RefObject<HTMLDivElement | null>;
  columnNodes: RefObject<Map<SolarSalesStage, HTMLElement>>;
  observeKey: string;
}) {
  const navRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const jumpLock = useRef<SolarSalesStage | null>(null);
  const [viewed, setViewed] = useState<SolarSalesStage>(selected ?? "NEW_LEAD");
  const active = mode === "select" && selected ? selected : viewed;

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const apply = () => {
      const parent = findScrollParent(nav);
      const offset = parent ? 0 : pinnedChromeOffset(nav);
      nav.style.setProperty("--solar-nav-stick", `${Math.round(offset)}px`);
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, []);

  useEffect(() => {
    if (mode !== "scroll") return;
    let observer: IntersectionObserver | null = null;
    let frame = 0;
    let attempts = 0;

    const attach = () => {
      const root = scrollerRef.current;
      const nodes = columnNodes.current;
      if (!root || !nodes || nodes.size === 0) {
        if (attempts < 8) {
          attempts += 1;
          frame = requestAnimationFrame(attach);
        }
        return;
      }

      const ratios = new Map<SolarSalesStage, number>();
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const stage = (entry.target as HTMLElement).dataset.stage as SolarSalesStage | undefined;
            if (!stage) continue;
            ratios.set(stage, entry.isIntersecting ? entry.intersectionRatio : 0);
          }
          const rootRect = root.getBoundingClientRect();
          let best: SolarSalesStage | null = null;
          let bestDistance = Number.POSITIVE_INFINITY;
          let bestRatio = 0;
          let fallback: SolarSalesStage | null = null;
          let fallbackRatio = 0;
          for (const [stage, ratio] of ratios) {
            if (ratio > fallbackRatio) {
              fallback = stage;
              fallbackRatio = ratio;
            }
            if (ratio < 0.5) continue;
            const node = nodes.get(stage);
            if (!node) continue;
            const distance = Math.abs(node.getBoundingClientRect().left - rootRect.left);
            if (distance < bestDistance) {
              bestDistance = distance;
              best = stage;
              bestRatio = ratio;
            }
          }
          const next = best ?? fallback;
          const nextRatio = best ? bestRatio : fallbackRatio;
          if (!next) return;
          if (jumpLock.current) {
            if (next === jumpLock.current && nextRatio >= 0.45) jumpLock.current = null;
            else return;
          }
          setViewed((current) => (current === next ? current : next));
        },
        { root, threshold: [0.2, 0.45, 0.7, 0.9] }
      );

      nodes.forEach((node) => observer?.observe(node));
    };

    attach();
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [columnNodes, mode, observeKey, scrollerRef]);

  useEffect(() => {
    const track = trackRef.current;
    const item = track?.querySelector<HTMLElement>(`[data-nav-stage="${active}"]`);
    if (!track || !item) return;
    const itemRect = item.getBoundingClientRect();
    const trackRect = track.getBoundingClientRect();
    if (itemRect.left >= trackRect.left - 1 && itemRect.right <= trackRect.right + 1) return;
    const target = item.offsetLeft - (track.clientWidth - item.offsetWidth) / 2;
    track.scrollTo({ left: Math.max(0, target), behavior: scrollBehavior() });
  }, [active]);

  function jump(stage: SolarSalesStage) {
    setViewed(stage);
    onSelect?.(stage);
    if (mode === "select") return;
    const scroller = scrollerRef.current;
    const column = columnNodes.current?.get(stage);
    if (!scroller || !column) return;
    const delta = column.getBoundingClientRect().left - scroller.getBoundingClientRect().left;
    jumpLock.current = stage;
    scroller.scrollTo({ left: Math.max(0, scroller.scrollLeft + delta - 8), behavior: scrollBehavior() });
    window.setTimeout(() => {
      if (jumpLock.current === stage) jumpLock.current = null;
    }, scrollBehavior() === "auto" ? 80 : 700);
  }

  return (
    <nav
      ref={navRef}
      aria-label="Workflow stages"
      className="sticky z-20 -mx-1 border-b border-sales-border-subtle bg-sales-bg px-1 py-2"
      style={{ top: "var(--solar-nav-stick, 0px)" }}
    >
      <div className="flex items-center gap-2">
        <div ref={trackRef} className="flex min-w-0 flex-1 items-center overflow-x-auto pb-0.5">
          <ol className={cn("flex items-center", mode === "select" ? "gap-1.5" : "gap-0.5")}>
            {FLOW_STAGES.map((stage, index) => (
              <li key={stage} className="flex shrink-0 items-center gap-0.5">
                {mode === "scroll" && index > 0 ? (
                  <ChevronRight
                    size={14}
                    strokeWidth={1.8}
                    className="shrink-0 text-sales-text-muted"
                    aria-hidden
                  />
                ) : null}
                <StageButton
                  stage={stage}
                  count={counts[stage] ?? 0}
                  active={active === stage}
                  onJump={jump}
                />
              </li>
            ))}
          </ol>
        </div>
        <div className="flex shrink-0 items-center border-l border-sales-border-subtle pl-2">
          <StageButton
            stage="LOST"
            count={counts.LOST ?? 0}
            active={active === "LOST"}
            onJump={jump}
          />
        </div>
      </div>
    </nav>
  );
}

function StageButton({
  stage,
  count,
  active,
  onJump,
}: {
  stage: SolarSalesStage;
  count: number;
  active: boolean;
  onJump: (stage: SolarSalesStage) => void;
}) {
  const won = stage === "WON";
  const lost = stage === "LOST";
  return (
    <button
      type="button"
      data-nav-stage={stage}
      aria-current={active ? "true" : undefined}
      aria-label={`Jump to ${SOLAR_SALES_STAGE_LABEL[stage]}, ${opportunityPhrase(count)}`}
      onClick={() => onJump(stage)}
      className={cn(
        "relative inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-[8px] border px-2.5 text-left",
        "transition-colors duration-200 motion-reduce:transition-none active:translate-y-px motion-reduce:active:translate-y-0",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sales-focus-outline,#d4ff4f)]",
        active
          ? "border-sales-border-strong bg-sales-surface text-sales-text-primary"
          : "border-sales-border-subtle bg-sales-surface-subtle/70 text-sales-text-secondary hover:bg-sales-surface",
        won && "border-sales-brand-border",
        lost && "text-sales-danger-fg",
        lost && active && "border-sales-danger/40"
      )}
    >
      {won ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sales-brand" aria-hidden /> : null}
      <span className={cn("text-[13px] leading-none", active ? "font-semibold" : "font-medium")}>
        {NAV_LABEL[stage]}
      </span>
      <span className="text-[12px] tabular-nums leading-none text-sales-text-muted" aria-hidden>
        · {count}
      </span>
      <span
        className={cn(
          "absolute inset-x-2 -bottom-px h-0.5 rounded-full",
          active ? (lost ? "bg-sales-danger" : "bg-sales-brand") : "bg-transparent"
        )}
        aria-hidden
      />
    </button>
  );
}
