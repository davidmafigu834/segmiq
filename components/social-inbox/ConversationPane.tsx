"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Clock3,
  Copy,
  ExternalLink,
  Globe2,
  MoreHorizontal,
  Reply,
  Sparkles,
} from "lucide-react";
import {
  Avatar,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IconButton,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Skeleton,
  Tooltip,
} from "@/components/sales/ui";
import { cn } from "@/lib/ui/cn";
import {
  channelKindLabel,
  channelNetworkLabel,
  formatRelativeTime,
  intentBandLabel,
  originHeadline,
} from "@/lib/social-inbox/display";
import { formatFollowUpLong, uniqueSignalChips } from "@/lib/social-inbox/inbox-ui";
import type { SocialMessageDto } from "@/lib/social-inbox/types";
import { ChannelGlyph } from "./ChannelGlyph";
import { ComposerBar } from "./ComposerBar";
import { InboxScrollArea } from "./InboxScrollArea";
import type { SocialInboxSession } from "./useSocialInboxSession";

export function ConversationPane({ session }: { session: SocialInboxSession }) {
  const { selected, hydrating, detailLoading, selectedId } = session;

  if (hydrating || (selectedId && !selected && detailLoading)) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-sales-bg">
        <div className="h-16 border-b border-sales-border px-4 py-3">
          <Skeleton className="h-10 w-64" />
        </div>
        <div className="flex-1 space-y-3 p-4">
          <Skeleton className="h-16 w-3/4" />
          <Skeleton className="ml-auto h-12 w-1/2" />
          <Skeleton className="h-12 w-2/3" />
        </div>
      </div>
    );
  }

  if (!selected || !selectedId) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center bg-sales-bg px-8 text-center">
        <p className="text-[16px] font-semibold text-sales-text-primary">Select a conversation</p>
        <p className="mt-1 max-w-sm text-[13px] text-sales-text-muted">
          Choose someone from the inbox to see their conversation and sales context.
        </p>
        <p className="mt-4 text-[12px] text-sales-text-muted">Use ↑ and ↓ to move through conversations.</p>
      </div>
    );
  }

  const item = selected.conversation;
  const isComment = item.conversationKind === "comment";

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-sales-bg" aria-label="Active conversation">
      <ConversationHeader session={session} />
      {item.channel.startsWith("instagram") &&
      session.connections.some((c) => c.provider === "instagram" && c.status !== "connected") ? (
        <div className="flex items-center gap-2 border-b border-sales-border bg-sales-warning-soft px-4 py-2 text-[12px] text-sales-text-primary">
          Instagram isn&apos;t syncing right now.
          <Button size="sm" variant="secondary" onClick={() => session.reconnectChannel()}>
            Reconnect
          </Button>
        </div>
      ) : null}
      <Timeline session={session} isComment={isComment} />
      <ComposerBar session={session} />
    </section>
  );
}

function ConversationHeader({ session }: { session: SocialInboxSession }) {
  const item = session.selected!.conversation;
  const intel = session.selected!.intelligence;
  const followAt = intel.nextAction.followUpAt;

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-sales-border bg-sales-surface px-3">
      <button
        type="button"
        className="flex shrink-0 items-center gap-2.5 rounded-[8px] px-1 py-1 text-left hover:bg-sales-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--sales-focus-outline)] layout:hidden"
        onClick={() => session.setMobilePane("queue")}
        aria-label="Back to inbox"
      >
        ←
      </button>
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-[8px] px-1 py-1 text-left hover:bg-sales-surface-hover"
        onClick={() => {
          if (session.intelCollapsed) session.toggleIntelCollapsed();
          session.setIntelSection("customer");
          session.setMobilePane("intel");
        }}
      >
        <Avatar name={item.displayName} size="sm" src={item.avatarUrl} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold leading-tight text-sales-text-primary">
            {item.displayName}
          </span>
          <span className="mt-0.5 flex min-w-0 items-center gap-1 text-[11px] text-sales-text-muted">
            <ChannelGlyph channel={item.channel} className="shrink-0" />
            <span className="min-w-0 truncate">
              {channelNetworkLabel(item.channel)} {channelKindLabel(item.channel)}
              {item.detectedProduct ? ` · ${item.detectedProduct}` : ""}
            </span>
          </span>
        </span>
      </button>

      <div className="flex shrink-0 items-center gap-1">
        {item.intentBand === "hot" ? (
          <span className="hidden text-[12px] font-medium tabular-nums text-sales-text-secondary sm:inline">
            {item.intentScore} {intentBandLabel(item.intentBand)}
          </span>
        ) : (
          <span className="hidden text-[12px] text-sales-text-muted sm:inline">{intentBandLabel(item.intentBand)}</span>
        )}

        <DropdownMenu align="end">
          <DropdownMenuTrigger className="inline-flex h-8 max-w-[7.5rem] items-center gap-1 rounded-[8px] px-2 text-[12px] text-sales-text-secondary hover:bg-sales-surface-hover">
            <span className="truncate">{item.assignedToName ?? "Unassigned"}</span>
            <ChevronDown size={12} className="shrink-0" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <DropdownMenuLabel>Assigned to</DropdownMenuLabel>
            {session.team.map((member) => (
              <DropdownMenuItem key={member.id} onSelect={() => session.assignTo(member.id, member.name)}>
                {member.name}
                {member.id === item.assignedToId ? <Check size={14} className="ml-auto" /> : null}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => session.assignTo(null, null)}>Unassigned</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <FollowUpControl session={session} followAt={followAt} />

        {item.crmState === "none" ? (
          <DropdownMenu align="end">
            <DropdownMenuTrigger className="sales-btn-primary inline-flex h-8 items-center rounded-[8px] bg-sales-brand px-3 text-[12px] font-semibold text-[var(--sales-ink)]">
              Convert
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-52">
              <DropdownMenuItem onSelect={() => session.setOverlay("convert_lead")}>Convert to lead</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => session.setOverlay("create_deal")}>Create deal</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => session.setOverlay("link_customer")}>Link existing customer</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => session.setOverlay("not_sales")}>Not a sales opportunity</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}

        <DropdownMenu align="end">
          <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-sales-text-muted hover:bg-sales-surface-hover">
            <MoreHorizontal size={16} />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <DropdownMenuItem onSelect={session.markUnread}>Mark unread</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => session.setOverlay("link_customer")}>Link customer</DropdownMenuItem>
            {item.crmState === "none" ? (
              <DropdownMenuItem onSelect={() => session.setOverlay("convert_lead")}>Create lead</DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onSelect={() => session.setOverlay("create_deal")}>Create deal</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => session.setOverlay("create_quote")}>Create quotation</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => session.setOverlay("not_sales")}>Mark not sales opportunity</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => session.resolveConversation()}>Resolve conversation</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => session.showFlash({ title: "Conversation archived" }, "info")}>
              Archive
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => session.showFlash({ title: "Reported as spam" }, "warning")}>
              Report spam
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          size="sm"
          variant="ghost"
          className="layout:hidden"
          onClick={() => session.setMobilePane("intel")}
        >
          Context
        </Button>
      </div>
    </header>
  );
}

function FollowUpControl({ session, followAt }: { session: SocialInboxSession; followAt: string | null }) {
  const item = session.selected!.conversation;
  if (item.followUpLabel && followAt) {
    return (
      <Popover>
        <PopoverTrigger className="inline-flex h-8 items-center rounded-[8px] border border-sales-border px-2 text-[12px] text-sales-text-primary hover:bg-sales-surface-hover">
          Follow-up · {item.followUpLabel.replace("Follow up ", "")}
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3">
          <p className="text-[12px] font-semibold">Follow-up scheduled</p>
          <p className="mt-1 text-[12px] text-sales-text-secondary">{formatFollowUpLong(followAt)}</p>
          {session.selected?.intelligence.nextAction.followUpReason ? (
            <p className="mt-2 text-[12px] text-sales-text-muted">{session.selected.intelligence.nextAction.followUpReason}</p>
          ) : null}
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="secondary" onClick={session.completeFollowUp}>
              Mark complete
            </Button>
            <Button size="sm" variant="ghost" onClick={session.clearFollowUp}>
              Remove
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Popover>
      <Tooltip label="Follow up">
        <PopoverTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-sales-text-secondary hover:bg-sales-surface-hover">
          <Clock3 size={13} />
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent className="w-56 p-1.5">
        <FollowUpMenu session={session} />
      </PopoverContent>
    </Popover>
  );
}

export function FollowUpMenu({ session }: { session: SocialInboxSession }) {
  const laterToday = new Date();
  laterToday.setHours(17, 0, 0, 0);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  const three = new Date();
  three.setDate(three.getDate() + 3);
  three.setHours(9, 0, 0, 0);
  const week = new Date();
  week.setDate(week.getDate() + 7);
  week.setHours(9, 0, 0, 0);

  return (
    <div className="flex flex-col">
      <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-sales-text-muted">Suggested</p>
      <button
        type="button"
        className="rounded-[6px] px-2 py-1.5 text-left text-[13px] hover:bg-sales-surface-hover"
        onClick={() => void session.setFollowUp(session.suggestedThursday)}
      >
        {session.suggestedThursday.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}
      </button>
      <div className="my-1 border-t border-sales-border" />
      {[
        { label: "Later today", date: laterToday },
        { label: "Tomorrow", date: tomorrow },
        { label: "In 3 days", date: three },
        { label: "Next week", date: week },
      ].map(({ label, date }) => (
        <button
          key={label}
          type="button"
          className="rounded-[6px] px-2 py-1.5 text-left text-[13px] hover:bg-sales-surface-hover"
          onClick={() => session.setFollowUp(date)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Timeline({ session, isComment }: { session: SocialInboxSession; isComment: boolean }) {
  const selected = session.selected!;
  const item = selected.conversation;
  const scroller = useRef<HTMLDivElement>(null);
  const chips = uniqueSignalChips(item.intentReasons);
  const insight = insightFor(session);

  useEffect(() => {
    if (session.stickBottom && scroller.current) {
      scroller.current.scrollTop = scroller.current.scrollHeight;
    }
  }, [selected.messages.length, session.stickBottom, session.typingName]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <InboxScrollArea
        viewportRef={scroller}
        contentClassName="px-4 py-3 pb-4"
        onScroll={(e) => {
          const el = e.currentTarget;
          const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
          session.setStickBottom(atBottom);
          if (atBottom) session.setNewCount(0);
        }}
      >
        {item.origin && (item.origin.kind === "advertisement" || item.origin.kind === "post" || item.origin.kind === "reel") ? (
          <OriginCard session={session} />
        ) : null}

        {isComment ? <PublicCommentBanner session={session} /> : null}

        <ol className="mt-3 space-y-3">
          {selected.messages.map((message, index) => (
            <MessageRow
              key={message.id}
              message={message}
              session={session}
              chips={index === selected.messages.length - 1 && message.direction === "inbound" ? chips : []}
            />
          ))}
        </ol>
        {session.typingName ? (
          <p className="mt-3 text-[12px] text-sales-text-muted">{session.typingName} is typing…</p>
        ) : null}
        {insight && !session.insightDismissed[item.conversationId] ? (
          <div className="mt-3 rounded-[10px] border border-sales-border bg-sales-surface px-3 py-2">
            <div className="flex items-start gap-2">
              <Sparkles size={14} className="mt-0.5 shrink-0 text-sales-text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold text-sales-text-primary">{insight.title}</p>
                <p className="text-[12px] text-sales-text-secondary">{insight.body}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {insight.actions.map((action) => (
                    <Button key={action.label} size="sm" variant={action.primary ? "secondary" : "ghost"} onClick={action.onClick}>
                      {action.label}
                    </Button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                className="text-sales-text-muted hover:text-sales-text-primary"
                aria-label="Dismiss insight"
                onClick={() => session.setInsightDismissed((s) => ({ ...s, [item.conversationId]: true }))}
              >
                ×
              </button>
            </div>
          </div>
        ) : null}
      </InboxScrollArea>
      {session.newCount > 0 ? (
        <button
          type="button"
          className="absolute bottom-3 left-1/2 z-[1] -translate-x-1/2 rounded-full bg-[var(--sales-ink)] px-3 py-1.5 text-[12px] text-white shadow-sm"
          onClick={() => {
            session.setStickBottom(true);
            session.setNewCount(0);
            if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
          }}
        >
          ↓ {session.newCount} new message{session.newCount > 1 ? "s" : ""}
        </button>
      ) : null}
    </div>
  );
}

function insightFor(session: SocialInboxSession) {
  const selected = session.selected!;
  const item = selected.conversation;
  if (item.intentBand !== "hot" && item.crmState !== "open_deal") return null;
  if (item.crmState === "open_deal") {
    return {
      title: "Follow-up opportunity",
      body: selected.intelligence.nextAction.followUpReason ?? "An open deal is waiting on this conversation.",
      actions: [
        { label: "Draft follow-up", primary: true, onClick: () => void session.draftWithAi() },
        { label: "Open deal", primary: false, onClick: () => session.setOverlay("create_deal") },
      ],
    };
  }
  if (selected.intelligence.nextAction.code === "convert_lead") {
    return {
      title: "Strong buying intent",
      body: selected.intelligence.nextAction.followUpReason ?? selected.intelligence.summary ?? "This conversation looks like a sales opportunity.",
      actions: [
        { label: "Convert to lead", primary: true, onClick: () => session.setOverlay("convert_lead") },
        { label: "See details", primary: false, onClick: () => session.setOverlay("what_should_i_do") },
      ],
    };
  }
  return {
    title: "Strong buying intent",
    body: "Asked about price, deposit and availability.",
    actions: [
      { label: "Convert to lead", primary: true, onClick: () => session.setOverlay("convert_lead") },
        { label: "See details", primary: false, onClick: () => { if (session.intelCollapsed) session.toggleIntelCollapsed(); } },
    ],
  };
}

function OriginCard({ session }: { session: SocialInboxSession }) {
  const origin = session.selected!.conversation.origin;
  if (!origin) return null;
  return (
    <button
      type="button"
      onClick={() => session.setOverlay("post_preview")}
      className="flex w-full items-center gap-3 rounded-[10px] border border-sales-border bg-sales-surface px-3 py-2.5 text-left hover:bg-sales-surface-hover"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[8px] bg-[var(--sales-ink)] text-[10px] font-semibold text-sales-brand">
        CAT
      </span>
      <span className="min-w-0">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-sales-text-muted">
          From {origin.kind === "advertisement" ? "Facebook ad" : origin.kind === "reel" ? "Instagram reel" : "post"}
        </span>
        <span className="block truncate text-[13px] font-medium text-sales-text-primary">
          {origin.adName ?? origin.campaignName ?? session.selected!.conversation.detectedProduct}
        </span>
        {origin.caption ? (
          <span className="block truncate text-[12px] text-sales-text-muted">{origin.caption}</span>
        ) : null}
      </span>
      <ExternalLink size={14} className="ml-auto text-sales-text-muted" />
    </button>
  );
}

function PublicCommentBanner({ session }: { session: SocialInboxSession }) {
  const item = session.selected!.conversation;
  const hasPrivate = session.selected!.messages.some((m) => m.visibility === "private");
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-[10px] border border-sales-border bg-sales-surface px-3 py-2">
      <p className="flex min-w-0 flex-1 items-center gap-1.5 text-[12px] text-sales-text-muted">
        <Globe2 size={12} className="shrink-0" />
        <span className="truncate">
          Public {channelKindLabel(item.channel).toLowerCase()}
          {originHeadline(item) ? ` · ${originHeadline(item)}` : ""}
        </span>
      </p>
      {hasPrivate ? (
        <p className="text-[12px] text-sales-text-muted">Private conversation started</p>
      ) : (
        <div className="flex shrink-0 flex-wrap gap-1">
          <Button size="sm" variant="ghost" onClick={() => session.setComposerMode("public_reply")}>
            Reply publicly
          </Button>
          <Button size="sm" variant="secondary" onClick={() => session.setComposerMode("private_message")}>
            Send privately
          </Button>
        </div>
      )}
    </div>
  );
}

function MessageRow({
  message,
  session,
  chips,
}: {
  message: SocialMessageDto;
  session: SocialInboxSession;
  chips: string[];
}) {
  const mine = message.direction === "outbound";
  const [hover, setHover] = useState(false);

  return (
    <li
      className={cn("flex", mine ? "justify-end" : "justify-start")}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className={cn("max-w-[min(100%,440px)]", mine ? "items-end" : "items-start")}>
        {message.isInternalNote ? (
          <div className="rounded-[10px] border border-dashed border-sales-border bg-[color-mix(in_srgb,var(--sales-warning)_10%,var(--sales-surface))] px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-sales-text-muted">
              {message.actorName} · Internal note
            </p>
            <p className="mt-1 text-[14px] leading-relaxed text-sales-text-primary">{message.body}</p>
          </div>
        ) : (
          <div
            className={cn(
              "rounded-[12px] px-3 py-2 text-[14px] leading-relaxed",
              mine
                ? "bg-sales-bg text-sales-text-primary"
                : "bg-sales-surface text-sales-text-primary",
              message.visibility === "public" && "ring-1 ring-inset ring-sales-border"
            )}
          >
            {message.visibility === "public" ? (
              <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-sales-text-muted">
                <Globe2 size={10} /> Public
              </p>
            ) : null}
            <p>{message.body}</p>
            <p className="mt-1 flex items-center gap-2 text-[11px] text-sales-text-muted">
              {formatRelativeTime(message.sentAt)}
              {message.aiDraft ? <span>Drafted by SegmiQ</span> : null}
              {message.sendStatus === "sending" ? <span>Sending…</span> : null}
              {message.sendStatus === "sent" && mine ? <span>Sent</span> : null}
              {message.sendStatus === "failed" ? (
                <button
                  type="button"
                  className="font-medium text-sales-danger"
                  onClick={() => session.retryMessage(message.id)}
                >
                  Not sent · Retry
                </button>
              ) : null}
            </p>
          </div>
        )}
        {chips.length ? (
          <Tooltip label="Detected buying signals">
            <div className="mt-1 flex flex-wrap gap-1">
              {chips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full bg-sales-bg px-2 py-0.5 text-[11px] text-sales-text-secondary"
                >
                  {chip}
                </span>
              ))}
            </div>
          </Tooltip>
        ) : null}
        {hover ? (
          <div className={cn("mt-1 flex gap-0.5", mine ? "justify-end" : "justify-start")}>
            <Tooltip label="Reply">
              <IconButton size="sm" aria-label="Reply" icon={<Reply size={13} />} onClick={() => session.composerRef.current?.focus()} />
            </Tooltip>
            <Tooltip label="Copy">
              <IconButton
                size="sm"
                aria-label="Copy"
                icon={<Copy size={13} />}
                onClick={() => {
                  void navigator.clipboard.writeText(message.body);
                  session.showFlash({ title: "Copied" }, "info");
                }}
              />
            </Tooltip>
            {message.direction === "inbound" ? (
              <Tooltip label="Draft response">
                <IconButton size="sm" aria-label="Draft response" icon={<Sparkles size={13} />} onClick={() => void session.draftWithAi()} />
              </Tooltip>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}
