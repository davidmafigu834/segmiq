"use client";

import {
  AtSign,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Flame,
  Inbox,
  MessageSquare,
  Sparkles,
  UserRound,
} from "lucide-react";
import { Tooltip } from "@/components/sales/ui";
import { cn } from "@/lib/ui/cn";
import { SOCIAL_VIEW_ORDER } from "@/lib/social-inbox/display";
import type { SocialInboxViewId } from "@/lib/social-inbox/types";
import { InboxScrollArea } from "./InboxScrollArea";
import type { SocialInboxSession } from "./useSocialInboxSession";

const VIEW_META: Record<
  SocialInboxViewId,
  { label: string; icon: typeof Sparkles; group: "focus" | "messages" | "ops" }
> = {
  for_you: { label: "For You", icon: Sparkles, group: "focus" },
  hot: { label: "Hot opportunities", icon: Flame, group: "focus" },
  needs_reply: { label: "Needs reply", icon: Inbox, group: "focus" },
  follow_up: { label: "Follow up", icon: CheckCircle2, group: "focus" },
  dms: { label: "DMs", icon: MessageSquare, group: "messages" },
  comments: { label: "Comments", icon: AtSign, group: "messages" },
  converted: { label: "Converted", icon: CheckCircle2, group: "ops" },
  unassigned: { label: "Unassigned", icon: UserRound, group: "ops" },
};

export function InboxViewNav({ session }: { session: SocialInboxSession }) {
  const { viewsCollapsed, canViewUnassigned } = session;
  const focus = SOCIAL_VIEW_ORDER.filter((id) => VIEW_META[id].group === "focus");
  const messages = SOCIAL_VIEW_ORDER.filter((id) => VIEW_META[id].group === "messages");
  const ops = SOCIAL_VIEW_ORDER.filter(
    (id) => VIEW_META[id].group === "ops" && (id !== "unassigned" || canViewUnassigned)
  );

  return (
    <nav
      aria-label="Inbox views"
      className={cn(
        "relative flex min-h-0 shrink-0 flex-col overflow-hidden border-r border-sales-border bg-sales-surface transition-[width] duration-200 ease-out motion-reduce:transition-none",
        viewsCollapsed ? "w-[52px]" : "w-[208px]"
      )}
    >
      <div className={cn("flex h-11 shrink-0 items-center px-1.5", viewsCollapsed ? "justify-center" : "justify-end")}>
        <Tooltip label={viewsCollapsed ? "Expand views" : "Collapse views"} side="right">
          <button
            type="button"
            onClick={session.toggleViewsCollapsed}
            className="inline-flex h-7 w-7 items-center justify-center rounded-[6px] text-sales-text-muted transition-colors hover:bg-sales-surface-hover hover:text-sales-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--sales-focus-outline)]"
            aria-label={viewsCollapsed ? "Expand inbox views" : "Collapse inbox views"}
          >
            {viewsCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </Tooltip>
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <InboxScrollArea contentClassName="px-1.5 pb-3" showRail={!viewsCollapsed}>
          <Section session={session} ids={focus} />
          <Divider />
          {!viewsCollapsed ? (
            <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-sales-text-muted">
              Messages
            </p>
          ) : null}
          <Section session={session} ids={messages} />
          <Divider />
          <Section session={session} ids={ops} />
        </InboxScrollArea>
      </div>
    </nav>
  );
}

function Divider() {
  return <div className="mx-2 my-2 border-t border-sales-border" />;
}

function Section({ session, ids }: { session: SocialInboxSession; ids: SocialInboxViewId[] }) {
  return (
    <ul className="flex flex-col gap-0.5">
      {ids.map((id) => (
        <ViewRow key={id} id={id} session={session} />
      ))}
    </ul>
  );
}

function ViewRow({ id, session }: { id: SocialInboxViewId; session: SocialInboxSession }) {
  const meta = VIEW_META[id];
  const Icon = meta.icon;
  const selected = session.view === id;
  const count = session.counts[id];
  const collapsed = session.viewsCollapsed;
  const button = (
    <button
      type="button"
      onClick={() => session.changeView(id)}
      aria-current={selected ? "page" : undefined}
      className={cn(
        "relative flex w-full items-center rounded-[8px] transition-colors duration-150",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--sales-focus-outline)]",
        collapsed ? "h-9 justify-center" : "gap-2 py-[7px] pl-3 pr-2 text-left text-[13px]",
        selected
          ? "bg-[color-mix(in_srgb,var(--sales-brand)_18%,transparent)] font-medium text-sales-text-primary"
          : "text-sales-text-secondary hover:bg-sales-surface-hover hover:text-sales-text-primary"
      )}
    >
      {/* Absolute so the marker never shifts the icon off centre when collapsed. */}
      <span
        className={cn(
          "absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full",
          selected ? "bg-sales-brand" : "bg-transparent"
        )}
        aria-hidden
      />
      <Icon
        size={collapsed ? 17 : 15}
        strokeWidth={1.8}
        className={cn(selected ? "text-sales-text-primary" : "text-sales-text-muted")}
      />
      {!collapsed ? (
        <>
          <span className="min-w-0 flex-1 truncate">{meta.label}</span>
          <span className="tabular-nums text-[11px] text-sales-text-muted">{count}</span>
        </>
      ) : null}
    </button>
  );

  if (collapsed) {
    return (
      <li>
        <Tooltip label={`${meta.label} · ${count}`} side="right">
          {button}
        </Tooltip>
      </li>
    );
  }
  return <li>{button}</li>;
}
