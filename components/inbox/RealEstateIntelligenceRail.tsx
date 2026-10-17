"use client";
/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */
/* Hallmark · pre-emit critique: P4 H4 E4 S4 R4 V3 */

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Home,
  MapPin,
  PanelRightClose,
  UserRound,
} from "lucide-react";
import type { InboxConversation } from "@/lib/inbox/types";
import type { ReIntelligencePanel } from "@/lib/agent/real-estate/intelligence";
import type { AgentHandoffSummary } from "@/lib/agent/real-estate/handoff-summary";
import { isDemandSide, isSupplySide, isUnclassifiedDealSide } from "@/lib/real-estate/requirements";
import { AcquisitionConversationActions } from "./AcquisitionConversationActions";
import { BuyerConversationActions } from "./BuyerConversationActions";
import { AgentConversationCard } from "./AgentConversationCard";
import { SalesCopilotPanel } from "./SalesCopilotWorkspace";
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
  clientId?: string;
};

type EnquiryChoice = "purchase" | "rental" | "sale" | "rent";

const ENQUIRY_CHOICES: Array<{ id: EnquiryChoice; label: string; detail: string }> = [
  { id: "purchase", label: "Buying a property", detail: "They want to purchase." },
  { id: "rental", label: "Renting a property", detail: "They want somewhere to live." },
  { id: "sale", label: "Selling a property", detail: "They want to put a property on the market." },
  { id: "rent", label: "Renting out a property", detail: "They want to let a property." },
];

function RailSection({ children }: { children: ReactNode }) {
  return <section className="border-b border-sales-border-subtle px-4 py-4">{children}</section>;
}

function sectionTitle(label: string) {
  return <h3 className="wa-section-title mb-3">{label}</h3>;
}

function Fact({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value?.trim()) return null;
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="shrink-0 text-[12px] text-sales-text-muted">{label}</dt>
      <dd className="min-w-0 text-right text-[13px] font-medium text-sales-text-primary">{value}</dd>
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

function propertyMeta(property: NonNullable<ReIntelligencePanel["linkedProperty"]>): string {
  return [
    property.bedrooms != null ? `${property.bedrooms} bed` : null,
    property.price != null ? property.price.toLocaleString() : null,
    property.status,
  ]
    .filter(Boolean)
    .join(" · ");
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
  clientId,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [panel, setPanel] = useState<ReIntelligencePanel | null>(null);
  const [handoff, setHandoff] = useState<AgentHandoffSummary | null>(null);
  const [enquiryChoice, setEnquiryChoice] = useState<EnquiryChoice | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
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
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [conversation.id]);

  useEffect(() => {
    setEnquiryChoice(null);
    void load();
  }, [load, refreshKey]);

  const displayName = displayContactName(conversation);
  const demand = isDemandSide(panel?.dealSide);
  const supply = isSupplySide(panel?.dealSide);
  const unclassified = !panel || isUnclassifiedDealSide(panel.dealSide);
  const mobilePanelClass = mobileFullScreen
    ? open
      ? "max-[1099px]:relative max-[1099px]:z-auto max-[1099px]:flex max-[1099px]:h-full max-[1099px]:w-full max-[1099px]:max-w-none max-[1099px]:flex-1"
      : "max-[1099px]:hidden"
    : open
      ? "max-[860px]:translate-x-0"
      : "max-[860px]:translate-x-full";
  const widthStyle = panelWidth != null ? { width: panelWidth } : undefined;

  return (
    <aside
      style={widthStyle}
      className={[
        "wa-context-pane flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-l border-sales-border bg-sales-surface",
        panelAnimated ? "inbox-panel-animated" : "",
        panelWidth != null
          ? "w-full min-w-0 shrink-0 min-[1280px]:w-auto"
          : "w-full min-w-0 min-[1100px]:w-[min(100%,360px)] min-[1100px]:shrink-0 min-[1280px]:w-[clamp(330px,22vw,380px)]",
        mobileFullScreen
          ? ""
          : `max-[860px]:fixed max-[860px]:bottom-0 max-[860px]:right-0 ${mobileTopClass} max-[860px]:z-40 max-[860px]:w-[min(380px,92vw)] max-[860px]:shadow-[-4px_0_24px_rgba(0,0,0,0.12)] max-[860px]:transition-transform`,
        mobilePanelClass,
      ].join(" ")}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-sales-border px-3 py-2.5 max-[1099px]:pt-[max(0.75rem,env(safe-area-inset-top))]">
        {onMobileBack ? (
          <button
            type="button"
            onClick={onMobileBack}
            className="inline-flex h-11 w-11 items-center justify-center rounded-[8px] text-sales-text-secondary hover:bg-sales-surface-hover min-[1100px]:hidden"
            aria-label="Back to conversation"
          >
            <ArrowLeft size={16} />
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-sales-text-primary">
            <span className="min-[1100px]:hidden">Sales tools</span>
            <span className="hidden min-[1100px]:inline">Sales intelligence</span>
          </p>
          <p className="truncate text-[12px] text-sales-text-muted">{displayName}</p>
        </div>
        <button
          type="button"
          onClick={onCollapse}
          className="inline-flex h-11 w-11 items-center justify-center rounded-[8px] text-sales-text-secondary hover:bg-sales-surface-hover"
          aria-label="Close sales tools"
        >
          <PanelRightClose size={16} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex items-center gap-3 border-b border-sales-border-subtle px-4 py-3">
          <WhatsAppAvatar
            name={displayName}
            phone={conversation.phone}
            imageUrl={conversation.whatsappProfilePictureUrl}
            size="md"
          />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-sales-text-primary">{displayName}</p>
            <p className="truncate text-[12px] text-sales-text-secondary">
              {panel?.dealSideLabel ?? "Not classified yet"}
              {conversation.assignee?.name ? ` · ${conversation.assignee.name}` : ""}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3 px-4 py-4" aria-busy aria-label="Loading sales intelligence">
            <div className="h-16 animate-pulse rounded-[10px] bg-sales-surface-hover" />
            <div className="h-24 animate-pulse rounded-[10px] bg-sales-surface-hover" />
            <div className="h-20 animate-pulse rounded-[10px] bg-sales-surface-hover" />
          </div>
        ) : failed ? (
          <RailSection>
            {sectionTitle("Sales intelligence unavailable")}
            <p className="text-[13px] leading-5 text-sales-text-secondary">
              The customer context could not be loaded. The conversation is still available.
            </p>
            <button type="button" className="mt-3 min-h-11 text-[13px] font-semibold text-sales-text-primary" onClick={() => void load()}>
              Retry
            </button>
          </RailSection>
        ) : (
          <>
            {panel?.nextBestAction ? (
              <RailSection>
                {sectionTitle("Next action")}
                <p className="text-[14px] font-medium leading-5 text-sales-text-primary">{panel.nextBestAction.label}</p>
              </RailSection>
            ) : null}

            {clientId && unclassified ? (
              <RailSection>
                {sectionTitle("Classify this enquiry")}
                <p className="mb-3 text-[13px] leading-5 text-sales-text-secondary">
                  What is this customer enquiring about? Choosing a type opens the form. Nothing is saved until you confirm.
                </p>
                <div className="space-y-2">
                  {ENQUIRY_CHOICES.map((choice) => {
                    const selected = enquiryChoice === choice.id;
                    return (
                      <button
                        key={choice.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setEnquiryChoice(choice.id)}
                        className={`flex min-h-11 w-full flex-col items-start rounded-[10px] border px-3 py-2 text-left ${
                          selected ? "border-sales-text-primary bg-sales-surface-hover" : "border-sales-border bg-sales-surface"
                        }`}
                      >
                        <span className="text-[14px] font-semibold text-sales-text-primary">{choice.label}</span>
                        <span className="text-[12px] text-sales-text-secondary">{choice.detail}</span>
                      </button>
                    );
                  })}
                </div>
                {enquiryChoice === "purchase" || enquiryChoice === "rental" ? (
                  <div className="mt-4">
                    <BuyerConversationActions
                      clientId={clientId}
                      conversation={conversation}
                      intentLocked={enquiryChoice}
                    />
                  </div>
                ) : null}
                {enquiryChoice === "sale" || enquiryChoice === "rent" ? (
                  <div className="mt-4">
                    <AcquisitionConversationActions
                      clientId={clientId}
                      conversation={conversation}
                      intent={enquiryChoice}
                    />
                  </div>
                ) : null}
              </RailSection>
            ) : null}

            {clientId && demand ? (
              <RailSection>
                {sectionTitle(panel?.dealSide === "tenant_side" ? "Rental search" : "Buyer search")}
                <BuyerConversationActions
                  clientId={clientId}
                  conversation={conversation}
                  intentLocked={panel?.dealSide === "tenant_side" ? "rental" : "purchase"}
                />
              </RailSection>
            ) : null}

            {clientId && supply ? (
              <RailSection>
                {sectionTitle(panel?.dealSide === "landlord_side" ? "Landlord opportunity" : "Seller opportunity")}
                <AcquisitionConversationActions
                  clientId={clientId}
                  conversation={conversation}
                  intent={panel?.dealSide === "landlord_side" ? "rent" : "sale"}
                />
              </RailSection>
            ) : null}

            {panel?.linkedProperty ? (
              <RailSection>
                {sectionTitle("Linked property")}
                <div className="flex items-start gap-2">
                  <Home size={14} className="mt-0.5 shrink-0 text-sales-text-muted" />
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-sales-text-primary">{panel.linkedProperty.label}</p>
                    <p className="text-[12px] text-sales-text-secondary">{propertyMeta(panel.linkedProperty)}</p>
                  </div>
                </div>
              </RailSection>
            ) : null}

            {demand ? (
              <RailSection>
                {sectionTitle(panel?.dealSide === "tenant_side" ? "Rental requirements" : "Looking for")}
                <dl>
                  <Fact label="Budget" value={panel?.requirements.budget} />
                  <Fact label="Areas" value={panel?.requirements.areas} />
                  <Fact label="Bedrooms" value={panel?.requirements.bedrooms} />
                  <Fact label="Timeline" value={panel?.requirements.timeline} />
                  <Fact label="Readiness" value={panel?.requirements.matchReadiness} />
                </dl>
                {panel?.requirements.missing.length ? (
                  <p className="mt-2 text-[12px] text-sales-text-secondary">Still needed: {panel.requirements.missing.join(", ")}</p>
                ) : null}
              </RailSection>
            ) : null}

            {demand && (panel?.viewingAgent.name || panel?.upcomingViewings.length) ? (
              <RailSection>
                {sectionTitle("Viewings")}
                <div className="flex items-center gap-2 text-[13px] text-sales-text-primary">
                  <UserRound size={14} className="text-sales-text-muted" />
                  <span>{panel?.viewingAgent.name ?? "Not assigned yet"}</span>
                </div>
                {panel?.viewingAgent.routeReasonLabel ? (
                  <p className="mt-1 text-[12px] text-sales-text-secondary">{panel.viewingAgent.routeReasonLabel}</p>
                ) : null}
                {panel?.upcomingViewings.length ? (
                  <ul className="mt-3 space-y-2">
                    {panel.upcomingViewings.map((viewing) => (
                      <li key={`${viewing.listingLabel}-${viewing.scheduledAt}`} className="flex items-start gap-2 border-t border-sales-border-subtle pt-2">
                        <CalendarDays size={13} className="mt-0.5 text-sales-text-muted" />
                        <div>
                          <p className="text-[13px] font-medium text-sales-text-primary">{viewing.listingLabel}</p>
                          <p className="text-[12px] text-sales-text-secondary">{formatWhen(viewing.scheduledAt)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </RailSection>
            ) : null}

            {demand && panel?.topMatches.length ? (
              <RailSection>
                {sectionTitle("Matching properties")}
                <ul className="space-y-2">
                  {panel.topMatches.map((match) => (
                    <li key={match.listingId}>
                      <Link
                        href={`/sales/listings/${match.listingId}`}
                        className="flex min-h-11 items-center justify-between gap-2 rounded-[8px] px-1 hover:bg-sales-surface-hover"
                      >
                        <span className="min-w-0 truncate text-[13px] font-medium text-sales-text-primary">{match.label}</span>
                        <span className="shrink-0 text-[12px] text-sales-text-secondary">{match.matchLabel}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[12px] leading-5 text-sales-text-muted">
                  Opening a property does not send a WhatsApp message.
                </p>
              </RailSection>
            ) : null}

            {demand && handoff ? (
              <RailSection>
                {sectionTitle("Recorded context")}
                <dl>
                  <Fact label="Budget" value={handoff.budget} />
                  <Fact label="Areas" value={handoff.areas} />
                  <Fact label="Bedrooms" value={handoff.bedrooms} />
                  <Fact label="Timeline" value={handoff.timeline} />
                </dl>
                {handoff.conversationSummary ? (
                  <p className="mt-2 text-[12px] leading-5 text-sales-text-secondary">{handoff.conversationSummary}</p>
                ) : null}
              </RailSection>
            ) : null}

            <AgentConversationCard
              leadId={conversation.id}
              conversation={conversation}
              activityHref={`/sales/leads/${conversation.id}?tab=agent`}
            />

            <SalesCopilotPanel leadId={conversation.id} />

            {conversation.sourceLabel || panel?.sourceLabel ? (
              <RailSection>
                {sectionTitle("Source")}
                <div className="flex items-center gap-2 text-[12px] text-sales-text-secondary">
                  <MapPin size={13} />
                  {panel?.sourceLabel ?? conversation.sourceLabel}
                </div>
              </RailSection>
            ) : null}
          </>
        )}
      </div>

      <div className="shrink-0 border-t border-sales-border px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Link
          href={`/sales/leads/${conversation.id}`}
          onClick={() => onUpdated?.()}
          className="inline-flex h-11 w-full items-center justify-center rounded-[8px] border border-sales-border bg-sales-surface text-[13px] font-semibold text-sales-text-primary hover:bg-sales-surface-hover"
        >
          Open customer record
        </Link>
      </div>
    </aside>
  );
}
