"use client";

import type { ReactNode } from "react";
import {
  Brain,
  ChevronRight,
  ExternalLink,
  Flame,
  MoreHorizontal,
  Sparkles,
  UserRound,
} from "lucide-react";
import {
  Avatar,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  IconButton,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Skeleton,
  Tooltip,
} from "@/components/sales/ui";
import { cn } from "@/lib/ui/cn";
import { channelNetworkLabel, intentBandLabel, originHeadline } from "@/lib/social-inbox/display";
import { uniqueSignalChips } from "@/lib/social-inbox/inbox-ui";
import { ChannelGlyph } from "./ChannelGlyph";
import { FollowUpMenu } from "./ConversationPane";
import type { SocialInboxSession } from "./useSocialInboxSession";

export function SalesContextPanel({ session }: { session: SocialInboxSession }) {
  const { selected, intelCollapsed, hydrating } = session;

  if (intelCollapsed && session.mobilePane !== "intel") {
    return (
      <aside className="hidden h-full w-[48px] shrink-0 flex-col items-center gap-2 border-l border-sales-border bg-sales-surface py-3 layout:flex">
        <RailButton label="Customer" onClick={() => openSection(session, "customer")}>
          <UserRound size={15} />
        </RailButton>
        <RailButton label="Intent" onClick={() => openSection(session, "intent")}>
          <Flame size={15} />
        </RailButton>
        <RailButton label="Deal" onClick={() => openSection(session, "deal")}>
          <ExternalLink size={15} />
        </RailButton>
        <RailButton label="AI" onClick={() => openSection(session, "ai")}>
          <Brain size={15} />
        </RailButton>
      </aside>
    );
  }

  if (!selected) return <aside className="hidden h-full w-[340px] shrink-0 border-l border-sales-border bg-sales-surface layout:block" />;

  if (hydrating) {
    return (
      <aside className="hidden h-full w-[340px] shrink-0 space-y-3 border-l border-sales-border bg-sales-surface p-3 layout:block">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-20 w-full" />
      </aside>
    );
  }

  const item = selected.conversation;
  const intel = selected.intelligence;
  const chips = uniqueSignalChips(item.intentReasons);
  const quote = session.quotations[item.conversationId];
  const possibleMatch = item.conversationId === "demo-tendai" && intel.crm.state === "none";

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 w-full shrink-0 flex-col border-l border-sales-border bg-sales-surface layout:w-[340px]",
        session.mobilePane !== "intel" && "hidden layout:flex"
      )}
      aria-label="Sales context"
    >
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-sales-border px-3">
        <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">Sales context</p>
        <div className="flex items-center">
          <DropdownMenu align="end">
            <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-sales-text-muted hover:bg-sales-surface-hover">
              <MoreHorizontal size={15} />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => session.setOverlay("link_customer")}>Link customer</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => session.setOverlay("create_quote")}>Create quotation</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => session.setHistoryOpen((v) => !v)}>Recent activity</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <IconButton size="sm" aria-label="Collapse sales context" icon={<ChevronRight size={15} />} onClick={session.toggleIntelCollapsed} />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <div className="flex items-start gap-2.5">
          <Avatar name={item.displayName} size="md" src={item.avatarUrl} />
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-sales-text-primary">{item.displayName}</p>
            {item.username ? <p className="text-[12px] text-sales-text-muted">@{item.username}</p> : null}
            <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-sales-text-muted">
              <ChannelGlyph channel={item.channel} />
              {channelNetworkLabel(item.channel)}
            </p>
            <p className="mt-1 text-[12px] text-sales-text-secondary">
              {intel.crm.state === "none" ? "Potential customer" : intel.crm.state === "converted" ? "Lead" : "Existing customer"}
            </p>
          </div>
        </div>
        {intel.crm.contactId ? (
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => session.showFlash({ title: "Opening customer" }, "info")}>
            Open customer
          </Button>
        ) : null}

        {possibleMatch ? (
          <div className="mt-3 rounded-[10px] border border-sales-border bg-sales-bg px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">Possible customer match</p>
            <p className="mt-1 text-[13px] font-medium">Tendai Moyo</p>
            <p className="text-[12px] text-sales-text-muted">+263 77 214 8831 · 88% match</p>
            <Button size="sm" variant="secondary" className="mt-2" onClick={() => session.setOverlay("match_review")}>
              Review
            </Button>
          </div>
        ) : null}

        <Section id="ai" label="Next best action" session={session}>
          <div className="rounded-[10px] bg-[color-mix(in_srgb,var(--sales-brand)_12%,transparent)] px-3 py-2.5">
            <p className="text-[13px] font-semibold text-sales-text-primary">{intel.nextAction.label}</p>
            {intel.nextAction.followUpReason ? (
              <p className="mt-1 text-[12px] text-sales-text-secondary">{intel.nextAction.followUpReason}</p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {intel.nextAction.code === "assign" ? (
                <Button size="sm" variant="primary" onClick={() => session.setOverlay("what_should_i_do")}>
                  Assign
                </Button>
              ) : intel.nextAction.code === "create_quote" ? (
                <Button size="sm" variant="primary" onClick={() => session.setOverlay("create_quote")}>
                  Create quotation
                </Button>
              ) : intel.nextAction.code === "convert_lead" ? (
                <Button size="sm" variant="primary" onClick={() => session.setOverlay("convert_lead")}>
                  Convert to lead
                </Button>
              ) : (
                <Button size="sm" variant="primary" onClick={() => void session.draftWithAi()}>
                  Draft follow-up
                </Button>
              )}
              <Popover>
                <PopoverTrigger className="inline-flex h-8 items-center rounded-[8px] px-2 text-[12px] text-sales-text-secondary hover:bg-sales-surface-hover">
                  Set later
                </PopoverTrigger>
                <PopoverContent className="w-56 p-1.5">
                  <FollowUpMenu session={session} />
                </PopoverContent>
              </Popover>
            </div>
            <button
              type="button"
              className="mt-2 inline-flex items-center gap-1 text-[12px] text-sales-text-muted hover:text-sales-text-primary"
              onClick={() => session.setOverlay("what_should_i_do")}
            >
              <Sparkles size={12} /> What should I do?
            </button>
          </div>
        </Section>

        <Section id="intent" label="Sales intent" session={session}>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[22px] font-semibold tabular-nums leading-none text-sales-text-primary">
                {item.intentBand === "hot" ? item.intentScore : ""}
                <span className="ml-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
                  {intentBandLabel(item.intentBand)}
                </span>
              </p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-sales-bg">
                <div
                  className="h-full rounded-full bg-sales-brand"
                  style={{ width: `${Math.max(8, item.intentScore)}%` }}
                />
              </div>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-sales-text-muted">Why?</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {chips.map((chip) => (
              <span key={chip} className="rounded-full bg-sales-bg px-2 py-0.5 text-[11px] text-sales-text-secondary">
                {chip}
              </span>
            ))}
          </div>
          <Popover>
            <PopoverTrigger className="mt-2 text-[12px] text-sales-text-muted hover:text-sales-text-primary">
              View signals
            </PopoverTrigger>
            <PopoverContent className="w-72 p-3">
              <p className="text-[12px] font-semibold">High buying intent</p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-[12px] text-sales-text-secondary">
                {item.intentReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </PopoverContent>
          </Popover>
        </Section>

        {item.detectedProduct ? (
          <Section id="deal" label="Interested in" session={session}>
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-[var(--sales-ink)] text-[9px] font-semibold text-sales-brand">
                EQ
              </span>
              <div>
                <p className="text-[13px] font-medium">{item.detectedProduct}</p>
                <p className="text-[11px] text-sales-text-muted">
                  {item.detectedProduct.includes("CAT") ? "Used equipment · Financing requested" : "Package · Quotation requested"}
                </p>
              </div>
            </div>
            <div className="mt-2 flex gap-1.5">
              <Button size="sm" variant="ghost" onClick={() => session.showFlash({ title: "Product details" }, "info")}>
                View product
              </Button>
              <Button size="sm" variant="secondary" onClick={() => session.setOverlay("create_quote")}>
                Create quote
              </Button>
            </div>
          </Section>
        ) : null}

        <Section id="customer" label="Source" session={session}>
          <p className="text-[13px] font-medium text-sales-text-primary">
            {item.origin?.kind === "advertisement" ? "Facebook Ad" : channelNetworkLabel(item.channel)}
          </p>
          {originHeadline(item) ? <p className="text-[12px] text-sales-text-secondary">{originHeadline(item)}</p> : null}
          <p className="mt-1 text-[11px] text-sales-text-muted">
            First interaction · {item.lastMessageAt ? new Date(item.lastMessageAt).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
          </p>
          {item.origin?.customerQuote ? (
            <p className="mt-1 text-[12px] text-sales-text-secondary">“{item.origin.customerQuote}”</p>
          ) : null}
          <Button size="sm" variant="ghost" className="mt-1" onClick={() => session.setOverlay("post_preview")}>
            View original
          </Button>
        </Section>

        <Section id="deal" label={intel.crm.state === "converted" ? "Lead" : "CRM"} session={session}>
          {intel.crm.state === "none" ? (
            <>
              <p className="text-[13px] text-sales-text-secondary">Not added yet.</p>
              <div className="mt-2 flex gap-1.5">
                <Button size="sm" variant="primary" onClick={() => session.setOverlay("convert_lead")}>
                  Convert to lead
                </Button>
                <Button size="sm" variant="secondary" onClick={() => session.setOverlay("link_customer")}>
                  Link existing
                </Button>
              </div>
            </>
          ) : intel.crm.state === "converted" ? (
            <>
              <p className="text-[13px] font-medium">{intel.crm.customerName ?? item.displayName}</p>
              <p className="text-[12px] text-sales-text-muted">New lead</p>
              <Button size="sm" variant="ghost" className="mt-1" onClick={() => (window.location.href = session.flash?.href ?? session.seed.leadsBase)}>
                Open lead →
              </Button>
            </>
          ) : (
            <>
              <p className="text-[13px] font-medium">{intel.crm.customerName ?? item.displayName}</p>
              <p className="text-[12px] text-sales-text-muted">Customer since May 2026</p>
              <Button size="sm" variant="ghost" className="mt-1">
                Open customer →
              </Button>
            </>
          )}
        </Section>

        {intel.crm.state === "open_deal" ? (
          <Section id="deal" label="Open deal" session={session}>
            <p className="text-[13px] font-medium">{intel.crm.openDealName ?? item.detectedProduct}</p>
            <p className="text-[12px] text-sales-text-muted">Proposal sent · $48,000</p>
            <p className="text-[11px] text-sales-text-muted">Last activity 2d ago</p>
            <Button
              size="sm"
              variant="secondary"
              className="mt-2"
              onClick={() => (window.location.href = `${session.seed.dealsBase}${intel.crm.dealId ?? ""}`)}
            >
              Open deal
            </Button>
          </Section>
        ) : null}

        {quote ? (
          <Section id="deal" label="Quotation" session={session}>
            <p className="text-[13px] font-medium">{quote.id}</p>
            <p className="text-[12px] text-sales-text-secondary">
              {quote.product} · {quote.amount}
            </p>
            <p className="text-[11px] text-sales-text-muted">
              {quote.status} · {quote.sentAgo}
            </p>
            <div className="mt-2 flex gap-1.5">
              <Button size="sm" variant="secondary" onClick={() => (window.location.href = session.seed.quotesBase)}>
                Open quotation
              </Button>
              <Popover>
                <PopoverTrigger className="inline-flex h-8 items-center rounded-[8px] px-2 text-[12px] text-sales-text-secondary hover:bg-sales-surface-hover">
                  Follow up
                </PopoverTrigger>
                <PopoverContent className="w-56 p-1.5">
                  <FollowUpMenu session={session} />
                </PopoverContent>
              </Popover>
            </div>
          </Section>
        ) : null}

        <Section id="ai" label="Conversation summary" session={session}>
          <p className="text-[13px] leading-relaxed text-sales-text-secondary">
            {intel.summary ?? "No summary yet."}
          </p>
          <Button
            size="sm"
            variant="ghost"
            className="mt-1"
            onClick={() => session.showFlash({ title: "Summary refreshed" }, "info")}
          >
            Refresh summary
          </Button>
        </Section>

        <details
          className="mt-3 border-t border-sales-border pt-3"
          open={session.historyOpen}
          onToggle={(e) => session.setHistoryOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
            Recent activity
          </summary>
          <ul className="mt-2 space-y-2 text-[12px] text-sales-text-secondary">
            <li>Facebook comment · 18 Sep</li>
            <li>Messenger conversation · 18 Sep</li>
            {quote ? <li>Quotation {quote.id} sent · 18 Sep</li> : null}
            {item.followUpLabel ? <li>Follow-up scheduled · 19 Sep</li> : null}
            {intel.crm.state === "open_deal" ? <li>Deal updated · 19 Sep</li> : null}
          </ul>
        </details>
      </div>
    </aside>
  );
}

function openSection(session: SocialInboxSession, section: "customer" | "intent" | "deal" | "ai") {
  session.setIntelSection(section);
  if (session.intelCollapsed) session.toggleIntelCollapsed();
  session.setMobilePane("intel");
}

function RailButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        onClick={onClick}
        className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-sales-text-muted hover:bg-sales-surface-hover hover:text-sales-text-primary"
        aria-label={label}
      >
        {children}
      </button>
    </Tooltip>
  );
}

function Section({
  id,
  label,
  session,
  children,
}: {
  id: "customer" | "intent" | "deal" | "ai";
  label: string;
  session: SocialInboxSession;
  children: ReactNode;
}) {
  const highlight = session.intelSection === id;
  return (
    <section className={cn("mt-4", highlight && "rounded-[10px] ring-1 ring-[color-mix(in_srgb,var(--sales-brand)_35%,transparent)] ring-offset-2 ring-offset-sales-surface")}>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">{label}</p>
      {children}
    </section>
  );
}
