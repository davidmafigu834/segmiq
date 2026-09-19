"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Filter,
  MoreHorizontal,
  RefreshCw,
  Share2,
} from "lucide-react";
import { SiFacebook, SiInstagram } from "react-icons/si";
import {
  Button,
  Checkbox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  IconButton,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SearchInput,
  StatusDot,
} from "@/components/sales/ui";
import { cn } from "@/lib/ui/cn";
import { formatRelativeTime } from "@/lib/social-inbox/display";
import { EMPTY_FILTERS } from "@/lib/social-inbox/inbox-ui";
import { ChannelGlyph } from "./ChannelGlyph";
import { ConversationPane } from "./ConversationPane";
import { ConversationQueue } from "./ConversationQueue";
import { InboxOverlays } from "./InboxOverlays";
import { InboxViewNav } from "./InboxViewNav";
import { SalesContextPanel } from "./SalesContextPanel";
import type { SocialInboxSession } from "./useSocialInboxSession";

export function SocialInboxApp({
  session,
  channelsHref,
}: {
  session: SocialInboxSession;
  channelsHref: string;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (e.key === "Escape") {
        session.setOverlay(null);
        return;
      }
      if (session.overlay) return;
      if (typing) return;
      if (e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) {
        e.preventDefault();
        session.setOverlay("search");
        return;
      }
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        session.moveSelection(1);
      }
      if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        session.moveSelection(-1);
      }
      if (e.key === "c") session.composerRef.current?.focus();
      if (e.key === "f") session.setFollowUp(session.suggestedThursday);
      if (e.key === "a") session.setOverlay("what_should_i_do");
      if (e.key === "e") session.resolveConversation();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [session]);

  if (session.noChannels && !session.hydrating) {
    return (
      <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-sales-bg">
        <WorkspaceHeader session={session} channelsHref={channelsHref} />
        <div className="flex flex-1 items-center justify-center px-6">
          <EmptyState
            icon={<Share2 size={22} />}
            title="Turn social conversations into sales."
            description="Connect Facebook and Instagram to identify buying intent, reply faster and turn conversations into leads and deals."
            action={
              session.canManageChannels ? (
                <Button variant="primary" onClick={() => session.setOverlay("connect_channels")}>
                  Connect Facebook
                </Button>
              ) : undefined
            }
          />
        </div>
        {!session.canManageChannels ? (
          <p className="-mt-6 pb-8 text-center text-[12px] text-sales-text-muted">
            Ask a company manager to connect Facebook and Instagram.
          </p>
        ) : null}
        <div className="flex justify-center gap-6 pb-10 text-[12px] text-sales-text-muted">
          <span className="inline-flex items-center gap-1.5">
            <SiFacebook /> Facebook Messenger
          </span>
          <span>Facebook Comments</span>
          <span className="inline-flex items-center gap-1.5">
            <SiInstagram /> Instagram DMs
          </span>
          <span>Instagram Comments</span>
        </div>
        <InboxOverlays session={session} />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-sales-bg">
      <WorkspaceHeader session={session} channelsHref={channelsHref} />
      {session.connectionAttention && !session.noChannels ? (
        <div className="flex items-center gap-2 border-b border-sales-border bg-sales-warning-soft px-4 py-1.5 text-[12px] text-sales-text-primary">
          A social channel needs reconnection.
          <Button size="sm" variant="secondary" onClick={() => session.reconnectChannel()}>
            Reconnect
          </Button>
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className={cn("flex min-h-0 overflow-hidden", session.mobilePane !== "queue" && "hidden layout:flex")}>
          <div className="hidden min-h-0 layout:flex">
            <InboxViewNav session={session} />
          </div>
          <ConversationQueue session={session} />
        </div>
        <div
          className={cn(
            "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
            session.mobilePane !== "thread" && "hidden layout:flex"
          )}
        >
          <ConversationPane session={session} />
        </div>
        <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden layout:w-[340px] layout:flex-none", session.mobilePane !== "intel" && "hidden layout:flex")}>
          <SalesContextPanel session={session} />
        </div>
      </div>
      {session.flash ? (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 justify-center">
          <div className="pointer-events-auto flex items-center gap-2 rounded-[10px] border border-sales-border bg-sales-surface px-3 py-2 text-[12px] shadow-[var(--sales-btn-shadow)]">
            <span className="font-medium">{session.flash.title}</span>
            {session.flash.undo ? (
              <button type="button" className="font-semibold text-sales-text-primary" onClick={session.flash.undo}>
                Undo
              </button>
            ) : null}
            {session.flash.href ? (
              <a href={session.flash.href} className="font-semibold text-sales-text-primary">
                {session.flash.hrefLabel ?? "Open"}
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
      <InboxOverlays session={session} />
      {session.overlay === "search" ? <SearchOverlay session={session} /> : null}
    </div>
  );
}

function WorkspaceHeader({ session, channelsHref }: { session: SocialInboxSession; channelsHref: string }) {
  const [filterOpen, setFilterOpen] = useState(false);
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-sales-border bg-sales-surface px-3">
      <div className="min-w-[120px]">
        <h1 className="text-[16px] font-semibold tracking-[-0.02em] text-sales-text-primary">Social Inbox</h1>
      </div>
      <div className="mx-auto hidden min-w-0 max-w-xl flex-1 sm:block">
        <SearchInput
          value={session.query}
          onChange={(value) => {
            session.setQuery(value);
            if (value.length >= 2) session.setOverlay("search");
          }}
          placeholder="Search people, messages, products…"
          shortcutHint
          onClear={() => session.setQuery("")}
        />
      </div>
      <div className="ml-auto flex items-center gap-1">
        {session.canViewUnassigned ? (
          <DropdownMenu align="end">
            <DropdownMenuTrigger className="inline-flex h-8 items-center rounded-[8px] px-2 text-[12px] text-sales-text-secondary hover:bg-sales-surface-hover">
              {session.teamScope === "mine" ? "My inbox" : session.teamScope === "team" ? "Entire sales team" : session.team.find((t) => t.id === session.teamScope)?.name ?? "Team"}
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-48">
              <DropdownMenuItem onSelect={() => session.setTeamScope("mine")}>My inbox</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => session.setTeamScope("team")}>Entire sales team</DropdownMenuItem>
              <DropdownMenuSeparator />
              {session.team.map((member) => (
                <DropdownMenuItem key={member.id} onSelect={() => session.setTeamScope(member.id)}>
                  {member.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}

        <ChannelHealth session={session} channelsHref={channelsHref} />

        <Popover open={filterOpen} onOpenChange={setFilterOpen} align="end">
          <PopoverTrigger className="inline-flex h-8 items-center gap-1 rounded-[8px] px-2 text-[12px] text-sales-text-secondary hover:bg-sales-surface-hover">
            <Filter size={13} />
            Filter{session.filterBadge ? ` ${session.filterBadge}` : ""}
          </PopoverTrigger>
          <PopoverContent className="w-[280px] p-3">
            <FilterForm session={session} onApply={() => setFilterOpen(false)} />
          </PopoverContent>
        </Popover>

        <TooltipRefresh session={session} />

        <DropdownMenu align="end">
          <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-sales-text-muted hover:bg-sales-surface-hover">
            <MoreHorizontal size={16} />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={() => (window.location.href = channelsHref)}>Manage channels</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => session.setOverlay("tour")}>Show tour</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => session.changeView("converted")}>Converted</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

function TooltipRefresh({ session }: { session: SocialInboxSession }) {
  return (
    <IconButton
      size="sm"
      aria-label="Refresh"
      icon={<RefreshCw size={14} />}
      onClick={() => {
        void session.refreshWorkspace().catch(() => undefined);
      }}
    />
  );
}

function ChannelHealth({ session, channelsHref }: { session: SocialInboxSession; channelsHref: string }) {
  const attention = session.connectionAttention;
  const lastSync = session.connections
    .map((c) => c.lastSyncAt || c.lastEventAt)
    .filter(Boolean)
    .sort()
    .at(-1);
  return (
        <Popover align="end">
      <PopoverTrigger className="inline-flex h-8 items-center gap-1.5 rounded-[8px] px-2 text-[12px] text-sales-text-secondary hover:bg-sales-surface-hover">
        <StatusDot tone={attention ? "warning" : session.noChannels ? "neutral" : "success"} />
        {session.noChannels ? "No channels" : attention ? "1 channel needs attention" : "Channels connected"}
      </PopoverTrigger>
          <PopoverContent className="w-72 p-3">
        {session.connections.length === 0 ? (
          <p className="text-[13px] text-sales-text-secondary">Connect Facebook to receive Messenger and comments here.</p>
        ) : (
          session.connections.map((conn) => (
          <div key={conn.id} className="flex items-start justify-between gap-2 py-1.5">
            <div className="flex items-center gap-2">
              {conn.provider === "instagram" ? <SiInstagram size={14} /> : <SiFacebook size={14} />}
              <div>
                <p className="text-[13px] font-medium">{conn.displayName || (conn.provider === "instagram" ? "Instagram" : "Facebook")}</p>
                <p className="text-[12px] text-sales-text-muted">
                  {conn.status === "connected" ? "Connected" : conn.lastError ?? conn.status}
                </p>
              </div>
            </div>
            {conn.status !== "connected" ? (
              <Button size="sm" variant="primary" onClick={() => session.reconnectChannel()}>
                Reconnect
              </Button>
            ) : null}
          </div>
          ))
        )}
        {lastSync ? (
          <p className="mt-1 text-[11px] text-sales-text-muted">Last synced {formatRelativeTime(lastSync)}</p>
        ) : null}
        <button
          type="button"
          className="mt-2 text-[12px] font-medium text-sales-text-primary"
          onClick={() => (window.location.href = channelsHref)}
        >
          Manage channels →
        </button>
      </PopoverContent>
    </Popover>
  );
}

function FilterForm({ session, onApply }: { session: SocialInboxSession; onApply: () => void }) {
  const f = session.filters;
  const toggle = (key: keyof typeof f, value: boolean) => session.setFilters({ ...f, [key]: value });
  return (
    <div className="space-y-3 text-[13px]">
      <fieldset>
        <legend className="mb-1 text-[11px] font-semibold uppercase text-sales-text-muted">Channel</legend>
        <Checkbox label="Facebook" checked={f.facebook} onCheckedChange={(on) => toggle("facebook", on)} />
        <Checkbox label="Instagram" checked={f.instagram} onCheckedChange={(on) => toggle("instagram", on)} />
      </fieldset>
      <fieldset>
        <legend className="mb-1 text-[11px] font-semibold uppercase text-sales-text-muted">Type</legend>
        <Checkbox label="DM" checked={f.dm} onCheckedChange={(on) => toggle("dm", on)} />
        <Checkbox label="Comment" checked={f.comment} onCheckedChange={(on) => toggle("comment", on)} />
      </fieldset>
      <fieldset>
        <legend className="mb-1 text-[11px] font-semibold uppercase text-sales-text-muted">Sales intent</legend>
        <Checkbox label="Hot" checked={f.hot} onCheckedChange={(on) => toggle("hot", on)} />
        <Checkbox label="Warm" checked={f.warm} onCheckedChange={(on) => toggle("warm", on)} />
        <Checkbox label="Cold" checked={f.cold} onCheckedChange={(on) => toggle("cold", on)} />
      </fieldset>
      <fieldset>
        <legend className="mb-1 text-[11px] font-semibold uppercase text-sales-text-muted">Status</legend>
        <Checkbox label="Needs reply" checked={f.needsReply} onCheckedChange={(on) => toggle("needsReply", on)} />
        <Checkbox label="Follow up" checked={f.followUp} onCheckedChange={(on) => toggle("followUp", on)} />
        <Checkbox label="Converted" checked={f.converted} onCheckedChange={(on) => toggle("converted", on)} />
      </fieldset>
      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase text-sales-text-muted">Campaign</p>
        <Input
          value={f.campaign}
          onChange={(e) => session.setFilters({ ...f, campaign: e.target.value })}
          placeholder="Search campaigns"
        />
      </div>
      <div className="flex justify-between pt-1">
        <Button size="sm" variant="ghost" onClick={() => session.setFilters(EMPTY_FILTERS)}>
          Reset
        </Button>
        <Button size="sm" variant="primary" onClick={onApply}>
          Apply filters
        </Button>
      </div>
    </div>
  );
}

function SearchOverlay({ session }: { session: SocialInboxSession }) {
  const hits = session.searchHits;
  return (
    <div className="absolute inset-0 z-30 bg-[color-mix(in_srgb,var(--sales-ink)_25%,transparent)]" onClick={() => session.setOverlay(null)}>
      <div
        className="mx-auto mt-16 w-[min(560px,calc(100%-24px))] overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface shadow-[var(--sales-btn-shadow)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-sales-border p-3">
          <SearchInput
            value={session.query}
            onChange={session.setQuery}
            placeholder="Search people, messages, products…"
            shortcutHint
          />
        </div>
        <div className="max-h-[420px] overflow-y-auto p-3 text-[13px]">
          {!hits ? (
            <p className="text-sales-text-muted">Type at least two characters.</p>
          ) : (
            <>
              <Group title="People">
                {hits.people.map((p) => (
                  <button
                    key={p.conversationId}
                    type="button"
                    className="flex w-full items-center gap-2 rounded-[8px] px-2 py-1.5 text-left hover:bg-sales-surface-hover"
                    onClick={() => {
                      session.selectConversation(p.conversationId);
                      session.setOverlay(null);
                    }}
                  >
                    {p.displayName}
                    <ChannelGlyph channel={p.channel} />
                  </button>
                ))}
              </Group>
              <Group title="Conversations">
                {hits.conversations.map((p) => (
                  <button
                    key={p.conversationId}
                    type="button"
                    className="flex w-full items-center gap-2 rounded-[8px] px-2 py-1.5 text-left hover:bg-sales-surface-hover"
                    onClick={() => {
                      session.selectConversation(p.conversationId);
                      session.setOverlay(null);
                    }}
                  >
                    <span className="truncate">“{p.preview}”</span>
                  </button>
                ))}
              </Group>
              <Group title="Products">
                {hits.products.map((p) => (
                  <p key={p.id} className="px-2 py-1.5">
                    {p.name}
                  </p>
                ))}
              </Group>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-3">
      <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-sales-text-muted">{title}</p>
      {children}
    </div>
  );
}
