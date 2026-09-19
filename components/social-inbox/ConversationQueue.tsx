"use client";

import { Clock3, MoreHorizontal, UserPlus } from "lucide-react";
import {
  Avatar,
  Badge,
  Button,
  Checkbox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  FilterPill,
  IconButton,
  Skeleton,
  Tooltip,
} from "@/components/sales/ui";
import { cn } from "@/lib/ui/cn";
import {
  channelShortLabel,
  formatRelativeTime,
  formatWaitingDuration,
  intentBandLabel,
} from "@/lib/social-inbox/display";
import { EMPTY_FILTERS, uniqueSignalChips } from "@/lib/social-inbox/inbox-ui";
import type { SocialQueueItem } from "@/lib/social-inbox/types";
import { ChannelGlyph } from "./ChannelGlyph";
import { InboxScrollArea } from "./InboxScrollArea";
import type { SocialInboxSession } from "./useSocialInboxSession";

export function ConversationQueue({ session }: { session: SocialInboxSession }) {
  const { view, groups, visibleItems, hydrating, selectionMode, selectedIds } = session;

  const headings: Record<typeof view, { title: string; sub: string }> = {
    for_you: { title: "For you", sub: `${session.counts.for_you} need attention` },
    hot: { title: "Hot opportunities", sub: "People showing strong buying signals." },
    needs_reply: { title: "Needs reply", sub: "Customers waiting for you." },
    follow_up: { title: "Follow up", sub: `${session.counts.follow_up} conversations` },
    dms: { title: "Direct messages", sub: "Private conversations." },
    comments: { title: "Comments", sub: commentsSub(session) },
    converted: { title: "Converted", sub: "Social interactions that became sales records." },
    unassigned: { title: "Unassigned", sub: `${session.counts.unassigned} conversations need an owner` },
  };

  return (
    <section
      aria-label="Conversation queue"
      className="flex min-h-0 w-full shrink-0 flex-col overflow-hidden border-r border-sales-border bg-sales-surface layout:w-[340px]"
    >
      <div className="shrink-0 border-b border-sales-border px-3 py-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-[14px] font-semibold leading-tight text-sales-text-primary">{headings[view].title}</h2>
            <p className="mt-0.5 text-[12px] text-sales-text-muted">{headings[view].sub}</p>
          </div>
          {selectionMode ? (
            <button
              type="button"
              className="text-[12px] text-sales-text-muted hover:text-sales-text-primary"
              onClick={() => {
                session.setSelectionMode(false);
                session.setSelectedIds([]);
              }}
            >
              Cancel
            </button>
          ) : null}
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1 layout:hidden">
          {(["for_you", "hot", "needs_reply", "follow_up", "dms", "comments", "converted", "unassigned"] as const)
            .filter((id) => id !== "unassigned" || session.canViewUnassigned)
            .map((id) => (
              <Chip
                key={id}
                active={session.view === id}
                onClick={() => session.changeView(id)}
                label={id === "for_you" ? "For you" : id === "needs_reply" ? "Needs reply" : id === "follow_up" ? "Follow up" : id === "hot" ? "Hot" : id === "dms" ? "DMs" : id === "comments" ? "Comments" : id === "converted" ? "Converted" : "Unassigned"}
              />
            ))}
        </div>
        {view === "for_you" ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Chip
              active={session.filters.hot}
              onClick={() => session.setFilters((f) => ({ ...f, hot: !f.hot }))}
              label="Priority"
            />
            <Chip
              active={session.teamScope === "mine"}
              onClick={() => session.setTeamScope(session.teamScope === "mine" ? "team" : "mine")}
              label="Assigned to me"
            />
            <Chip active={false} onClick={() => undefined} label="Newest" />
          </div>
        ) : null}
        {view === "dms" ? (
          <div className="mt-2 flex gap-1.5">
            {(["all", "facebook", "instagram"] as const).map((n) => (
              <Chip
                key={n}
                active={session.filters.dmNetwork === n}
                onClick={() => session.setFilters((f) => ({ ...f, dmNetwork: n }))}
                label={n === "all" ? "All" : n === "facebook" ? "Facebook" : "Instagram"}
              />
            ))}
          </div>
        ) : null}
        {view === "comments" ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Chip
              active={!session.filters.commentsBuyersOnly}
              onClick={() => session.setFilters((f) => ({ ...f, commentsBuyersOnly: false }))}
              label="All"
            />
            <Chip
              active={session.filters.commentsBuyersOnly}
              onClick={() => session.setFilters((f) => ({ ...f, commentsBuyersOnly: true }))}
              label="Potential buyers"
            />
          </div>
        ) : null}
        {view === "hot" ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Chip active={session.teamScope === "mine"} onClick={() => session.setTeamScope("mine")} label="Mine" />
            <Chip active label="Score ↓" onClick={() => undefined} />
          </div>
        ) : null}
        {session.filterBadge > 0 ? (
          <div className="mt-2">
            <FilterPill
              label="Filters"
              value={String(session.filterBadge)}
              onRemove={() => session.setFilters(EMPTY_FILTERS)}
            />
          </div>
        ) : null}
      </div>

      {selectionMode && selectedIds.length > 0 ? (
        <div className="flex shrink-0 items-center gap-2 border-b border-sales-border bg-[color-mix(in_srgb,var(--sales-brand)_10%,transparent)] px-3 py-2 text-[12px]">
          <span className="font-medium text-sales-text-primary">{selectedIds.length} selected</span>
          <div className="ml-auto flex gap-1">
            {session.canAssign ? (
                  <Button size="sm" variant="secondary" onClick={() => session.setOverlay("what_should_i_do")}>
                    Assign
                  </Button>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                selectedIds.forEach((id) => session.patchConversation(id, (item) => ({ ...item, unread: false })));
                session.setSelectedIds([]);
                session.setSelectionMode(false);
                session.showFlash({ title: "Marked read" }, "info");
              }}
            >
              Mark read
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                session.setSelectedIds([]);
                session.setSelectionMode(false);
              }}
            >
              Clear
            </Button>
          </div>
        </div>
      ) : null}

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <InboxScrollArea>
          {hydrating ? (
          <div className="px-3 py-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="mb-3 h-[76px] w-full" />
            ))}
          </div>
        ) : visibleItems.length === 0 ? (
          <EmptyState
            size="compact"
            title={
              session.items.length
                ? "Nothing in this view."
                : session.connections.some((c) => c.status !== "disconnected")
                  ? "No comments or messages imported yet."
                  : "No conversations need your attention."
            }
            description={
              session.items.length
                ? "Try DMs or Comments to see everything imported from your Page."
                : session.connections.some((c) => c.lastError)
                  ? session.connections.find((c) => c.lastError)?.lastError
                  : session.connections.some((c) => c.status !== "disconnected")
                    ? "Past Page comments and Messenger threads are imported on Refresh. New ones arrive as they happen."
                    : "You're caught up."
            }
            action={
              session.items.length && view !== "dms" ? (
                <Button size="sm" variant="secondary" onClick={() => session.changeView("dms")}>
                  View all conversations
                </Button>
              ) : !session.items.length && session.connections.some((c) => c.status !== "disconnected") ? (
                <Button size="sm" variant="secondary" onClick={() => session.changeView("comments")}>
                  View comments
                </Button>
              ) : view !== "dms" ? (
                <Button size="sm" variant="secondary" onClick={() => session.changeView("dms")}>
                  View all conversations
                </Button>
              ) : null
            }
          />
        ) : (
          groups.map((group) => (
            <div key={group.id}>
              {group.label ? (
                <p className="sticky top-0 z-[1] bg-sales-surface px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-sales-text-muted">
                  {group.label}
                </p>
              ) : null}
              <ul>
                {group.items.map((item) => (
                  <QueueRow key={item.conversationId} item={item} session={session} />
                ))}
              </ul>
            </div>
            ))
          )}
        </InboxScrollArea>
      </div>
    </section>
  );
}

function commentsSub(session: SocialInboxSession) {
  const comments = session.items.filter((i) => i.conversationKind === "comment");
  const buyers = comments.filter((i) => i.intentBand !== "cold").length;
  if (session.filters.commentsBuyersOnly) {
    return `${buyers} potential buyers from ${comments.length} comments.`;
  }
  return `${comments.length} comments · ${buyers} look like buyers.`;
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-7 rounded-full px-2.5 text-[11px] transition-colors",
        active
          ? "bg-sales-surface font-medium text-sales-text-primary ring-1 ring-sales-border"
          : "bg-sales-bg text-sales-text-muted hover:text-sales-text-primary"
      )}
    >
      {label}
    </button>
  );
}

function QueueRow({ item, session }: { item: SocialQueueItem; session: SocialInboxSession }) {
  const selected = session.selectedId === item.conversationId;
  const checked = session.selectedIds.includes(item.conversationId);
  const chips = uniqueSignalChips(item.intentReasons);
  const showScore = item.intentBand === "hot" && (session.view === "hot" || session.view === "unassigned");
  const waiting = session.view === "needs_reply" || session.view === "unassigned";

  return (
    <li>
      <div
        className={cn(
          "group relative flex cursor-pointer gap-2.5 border-b border-sales-border px-3 py-2.5 transition-colors duration-150",
          selected
            ? "bg-[color-mix(in_srgb,var(--sales-brand)_8%,transparent)]"
            : "hover:bg-sales-surface-hover"
        )}
      >
        <span
          className={cn(
            "absolute bottom-2 left-0 top-2 w-0.5 rounded-full transition-opacity",
            selected ? "bg-sales-brand opacity-100" : "opacity-0"
          )}
          aria-hidden
        />
        {session.selectionMode || session.canAssign ? (
          <div className={cn("pt-1", session.selectionMode ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
            <Checkbox
              checked={checked}
              aria-label={`Select ${item.displayName}`}
              onCheckedChange={(on) => {
                session.setSelectionMode(true);
                session.setSelectedIds((ids) =>
                  on ? [...ids, item.conversationId] : ids.filter((id) => id !== item.conversationId)
                );
              }}
            />
          </div>
        ) : null}
        <button
          type="button"
          className="flex min-w-0 flex-1 gap-2.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sales-focus-outline)]"
          onClick={() => session.selectConversation(item.conversationId)}
        >
          <span className="relative mt-0.5 shrink-0">
            <Avatar name={item.displayName} size="sm" src={item.avatarUrl} />
            {item.unread ? (
              <span className="absolute -left-0.5 -top-0.5 h-2 w-2 rounded-full bg-sales-brand" aria-label="Unread" />
            ) : null}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span
                className={cn(
                  "min-w-0 truncate text-[13px] text-sales-text-primary",
                  item.unread ? "font-semibold" : "font-medium"
                )}
              >
                {item.displayName}
              </span>
              <ChannelGlyph channel={item.channel} />
              <span className="ml-auto shrink-0 text-[11px] tabular-nums text-sales-text-muted">
                {waiting ? formatWaitingDuration(item.lastMessageAt) : formatRelativeTime(item.lastMessageAt)}
              </span>
            </span>
            <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-sales-text-muted">
              <span className="truncate">
                {channelShortLabel(item.channel)}
                {item.detectedProduct ? ` · ${item.detectedProduct}` : ""}
              </span>
              {session.canViewUnassigned && item.assignedToName ? (
                <span className="ml-auto truncate">{item.assignedToName}</span>
              ) : null}
            </span>
            <span className="mt-0.5 block truncate text-[12.5px] text-sales-text-secondary">“{item.preview}”</span>
            <span className="mt-1 flex flex-wrap items-center gap-1">
              {showScore ? (
                <Badge tone="brand" size="sm">
                  {item.intentScore} {intentBandLabel(item.intentBand)}
                </Badge>
              ) : item.intentBand === "hot" ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-sales-text-primary">
                  High intent
                </span>
              ) : item.intentBand === "warm" ? (
                <span className="text-[11px] text-sales-text-muted">Warm</span>
              ) : null}
              {item.followUpLabel ? (
                <span className="text-[11px] text-sales-text-muted">{item.followUpLabel}</span>
              ) : null}
              {item.primaryLabel && item.primaryLabel !== "Hot" ? (
                <span className="text-[11px] text-sales-text-muted">{item.primaryLabel}</span>
              ) : null}
              {session.view === "comments" || session.view === "hot"
                ? chips.slice(0, 3).map((chip) => (
                    <span key={chip} className="text-[11px] text-sales-text-muted">
                      {chip}
                    </span>
                  ))
                : null}
            </span>
          </span>
        </button>
        <div className="absolute right-2 top-2 hidden gap-0.5 group-hover:flex">
          {session.canAssign ? (
            <Tooltip label="Assign">
              <IconButton
                size="sm"
                aria-label="Assign"
                icon={<UserPlus size={14} />}
                onClick={(e) => {
                  e.stopPropagation();
                  session.selectConversation(item.conversationId);
                  session.setOverlay("what_should_i_do");
                }}
              />
            </Tooltip>
          ) : null}
          <Tooltip label="Later">
            <IconButton
              size="sm"
              aria-label="Snooze"
              icon={<Clock3 size={14} />}
              onClick={(e) => {
                e.stopPropagation();
                session.selectConversation(item.conversationId);
                const later = new Date();
                later.setHours(later.getHours() + 3, 0, 0, 0);
                session.snoozeUntil(later);
              }}
            />
          </Tooltip>
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-sales-text-muted hover:bg-sales-surface-hover hover:text-sales-text-primary">
              <MoreHorizontal size={14} />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-44">
              <DropdownMenuItem onSelect={() => session.selectConversation(item.conversationId)}>Open</DropdownMenuItem>
              {item.crmState === "none" ? (
                <DropdownMenuItem
                  onSelect={() => {
                    session.selectConversation(item.conversationId);
                    session.setOverlay("convert_lead");
                  }}
                >
                  Convert
                </DropdownMenuItem>
              ) : null}
              {session.view === "follow_up" ? (
                <DropdownMenuItem onSelect={() => session.completeFollowUp()}>Complete</DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </li>
  );
}
