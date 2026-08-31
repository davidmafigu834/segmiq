"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Home,
  Loader2,
  MapPin,
  PanelRightClose,
  Sparkles,
  UserRound,
} from "lucide-react";
import type { InboxConversation } from "@/lib/inbox/types";
import type { ReIntelligencePanel } from "@/lib/agent/real-estate/intelligence";
import type { AgentHandoffSummary } from "@/lib/agent/real-estate/handoff-summary";
import { AgentConversationCard } from "./AgentConversationCard";
import { displayContactName, WhatsAppAvatar } from "./WhatsAppAvatar";

type Props = {
  conversation: InboxConversation;
  open: boolean;
  onCollapse: () => void;
  onMobileBack?: () => void;
  mobileFullScreen?: boolean;
  mobileTopClass?: string;
  panelWidth?: number;
  panelAnimated?: boolean;
  refreshKey?: number;
  onUpdated?: () => void;
};

function RailSection({ children }: { children: ReactNode }) {
  return <section className="border-b border-sales-border-subtle px-4 py-4">{children}</section>;
}

function sectionTitle(label: string) {
  return (
    <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-sales-text-muted">
      {label}
    </h3>
  );
}

function Fact({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value?.trim()) return null;
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="shrink-0 text-[11px] text-sales-text-muted">{label}</dt>
      <dd className="min-w-0 truncate text-right text-[12.5px] font-medium text-sales-text-primary">
        {value}
      </dd>
    </div>
  );
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function RealEstateIntelligenceRail({
  conversation,
  open,
  onCollapse,
  onMobileBack,
  mobileFullScreen = false,
  mobileTopClass = "max-[1099px]:top-0",
  panelWidth,
  panelAnimated = false,
  refreshKey = 0,
  onUpdated,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [panel, setPanel] = useState<ReIntelligencePanel | null>(null);
  const [handoff, setHandoff] = useState<AgentHandoffSummary | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/agent/conversations/${conversation.id}`, { cache: "no-store" });
      if (!res.ok) throw new Error("failed");
      const json = (await res.json()) as {
        reIntelligence?: ReIntelligencePanel | null;
        handoffSummary?: AgentHandoffSummary | null;
      };
      setPanel(json.reIntelligence ?? null);
      setHandoff(json.handoffSummary ?? null);
    } catch {
      setPanel(null);
      setHandoff(null);
    } finally {
      setLoading(false);
    }
  }, [conversation.id]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const displayName = displayContactName(conversation);
  const mobilePanelClass = mobileFullScreen
    ? open
      ? "max-[1099px]:fixed max-[1099px]:inset-0 max-[1099px]:z-40 max-[1099px]:flex max-[1099px]:w-full"
      : "max-[1099px]:hidden"
    : open
      ? "max-[860px]:translate-x-0"
      : "max-[860px]:translate-x-full";

  const widthStyle = panelWidth != null ? { width: panelWidth } : undefined;

  return (
    <aside
      style={widthStyle}
      className={[
        "flex h-full min-h-0 flex-col overflow-hidden border-l border-sales-border bg-sales-surface",
        panelAnimated ? "inbox-panel-animated" : "",
        panelWidth != null ? "shrink-0" : "w-[min(100%,360px)] min-[1280px]:w-[clamp(300px,22vw,380px)]",
        mobileFullScreen
          ? ""
          : `max-[860px]:fixed max-[860px]:bottom-0 max-[860px]:right-0 ${mobileTopClass} max-[860px]:z-40 max-[860px]:w-[min(360px,92vw)] max-[860px]:shadow-[-4px_0_24px_rgba(0,0,0,0.12)] max-[860px]:transition-transform`,
        mobilePanelClass,
      ].join(" ")}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-sales-border px-3 py-2.5">
        {onMobileBack ? (
          <button
            type="button"
            onClick={onMobileBack}
            className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-sales-text-secondary hover:bg-sales-surface-hover min-[860px]:hidden"
            aria-label="Back to conversation"
          >
            <ArrowLeft size={16} />
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-sales-text-primary">Property intelligence</p>
          <p className="truncate text-[11px] text-sales-text-muted">{displayName}</p>
        </div>
        <button
          type="button"
          onClick={onCollapse}
          className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-sales-text-secondary hover:bg-sales-surface-hover"
          aria-label="Collapse intelligence panel"
        >
          <PanelRightClose size={16} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex items-center gap-3 border-b border-sales-border-subtle px-4 py-3">
          <WhatsAppAvatar name={displayName} phone={conversation.phone} size="md" />
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-sales-text-primary">{displayName}</p>
            {panel?.dealSideLabel ? (
              <p className="text-[11px] text-sales-text-secondary">{panel.dealSideLabel}</p>
            ) : null}
          </div>
        </div>

        <AgentConversationCard
          leadId={conversation.id}
          conversation={conversation}
          activityHref={`/sales/leads/${conversation.id}?tab=agent`}
        />

        {loading ? (
          <div className="flex items-center justify-center py-10 text-sales-text-muted">
            <Loader2 size={18} className="animate-spin" />
          </div>
        ) : (
          <>
            {handoff ? (
              <RailSection>
                {sectionTitle("Agent handoff")}
                <dl className="space-y-0">
                  <Fact label="Match readiness" value={handoff.matchReadiness} />
                  <Fact label="Recommended" value={handoff.recommendedAction} />
                  <Fact label="Budget" value={handoff.budget} />
                  <Fact label="Areas" value={handoff.areas} />
                  <Fact label="Bedrooms" value={handoff.bedrooms} />
                  <Fact label="Timeline" value={handoff.timeline} />
                  <Fact label="Viewing agent" value={handoff.viewingAgentName} />
                </dl>
                {handoff.conversationSummary ? (
                  <p className="mt-2 text-[11px] leading-relaxed text-sales-text-secondary">
                    {handoff.conversationSummary}
                  </p>
                ) : null}
              </RailSection>
            ) : null}

            {panel?.linkedProperty ? (
              <RailSection>
                {sectionTitle("Linked property")}
                <div className="rounded-[10px] border border-sales-border bg-sales-surface-subtle px-3 py-2.5">
                  <div className="flex items-start gap-2">
                    <Home size={14} className="mt-0.5 shrink-0 text-sales-brand" />
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-sales-text-primary">
                        {panel.linkedProperty.label}
                      </p>
                      <p className="text-[11px] text-sales-text-secondary">
                        {[
                          panel.linkedProperty.bedrooms != null
                            ? `${panel.linkedProperty.bedrooms} bed`
                            : null,
                          panel.linkedProperty.price != null
                            ? `$${panel.linkedProperty.price.toLocaleString()}`
                            : null,
                          panel.linkedProperty.status,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  </div>
                </div>
              </RailSection>
            ) : null}

            <RailSection>
              {sectionTitle("Buyer requirements")}
              <dl className="space-y-0">
                <Fact label="Budget" value={panel?.requirements.budget} />
                <Fact label="Areas" value={panel?.requirements.areas} />
                <Fact label="Bedrooms" value={panel?.requirements.bedrooms} />
                <Fact label="Timeline" value={panel?.requirements.timeline} />
                <Fact label="Readiness" value={panel?.requirements.matchReadiness} />
              </dl>
              {panel?.requirements.missing.length ? (
                <p className="mt-2 text-[11px] text-sales-text-secondary">
                  Missing: {panel.requirements.missing.join(", ")}
                </p>
              ) : null}
            </RailSection>

            <RailSection>
              {sectionTitle("Viewing routing")}
              <div className="flex items-center gap-2 text-[12px] text-sales-text-primary">
                <UserRound size={14} className="text-sales-text-muted" />
                <span>{panel?.viewingAgent.name ?? "Not assigned yet"}</span>
              </div>
              <p className="mt-1 text-[11px] text-sales-text-secondary">
                {panel?.viewingAgent.routeReasonLabel ?? "Routing pending"}
              </p>
              {panel?.upcomingViewings.length ? (
                <ul className="mt-3 space-y-2">
                  {panel.upcomingViewings.map((viewing) => (
                    <li
                      key={`${viewing.listingLabel}-${viewing.scheduledAt}`}
                      className="flex items-start gap-2 rounded-[8px] border border-sales-border-subtle px-2.5 py-2"
                    >
                      <CalendarDays size={13} className="mt-0.5 text-sales-text-muted" />
                      <div>
                        <p className="text-[11px] font-medium text-sales-text-primary">
                          {viewing.listingLabel}
                        </p>
                        <p className="text-[10px] text-sales-text-secondary">
                          {formatWhen(viewing.scheduledAt)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </RailSection>

            {panel?.topMatches.length ? (
              <RailSection>
                {sectionTitle("Top matches")}
                <ul className="space-y-2">
                  {panel.topMatches.map((match) => (
                    <li key={match.listingId}>
                      <Link
                        href={`/sales/listings/${match.listingId}`}
                        className="flex items-center justify-between gap-2 rounded-[8px] border border-sales-border-subtle px-2.5 py-2 hover:bg-sales-surface-hover"
                      >
                        <span className="min-w-0 truncate text-[11px] font-medium text-sales-text-primary">
                          {match.label}
                        </span>
                        <span className="shrink-0 text-[10px] text-sales-text-secondary">
                          {match.matchLabel}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </RailSection>
            ) : null}

            {panel?.nextBestAction ? (
              <RailSection>
                {sectionTitle("Next best action")}
                <div className="flex items-start gap-2 rounded-[10px] border border-sales-border bg-sales-brand-soft/40 px-3 py-2.5">
                  <Sparkles size={14} className="mt-0.5 shrink-0 text-sales-brand" />
                  <p className="text-[12px] font-medium text-sales-text-primary">
                    {panel.nextBestAction.label}
                  </p>
                </div>
              </RailSection>
            ) : null}

            {conversation.sourceLabel ? (
              <RailSection>
                {sectionTitle("Attribution")}
                <div className="flex items-center gap-2 text-[11px] text-sales-text-secondary">
                  <MapPin size={13} />
                  {panel?.sourceLabel ?? conversation.sourceLabel}
                </div>
              </RailSection>
            ) : null}
          </>
        )}
      </div>

      <div className="shrink-0 border-t border-sales-border px-4 py-3">
        <Link
          href={`/sales/leads/${conversation.id}`}
          onClick={() => onUpdated?.()}
          className="inline-flex h-8 w-full items-center justify-center rounded-[8px] border border-sales-border bg-sales-surface text-[11px] font-medium text-sales-text-primary hover:bg-sales-surface-hover"
        >
          Open inquiry workspace
        </Link>
      </div>
    </aside>
  );
}
