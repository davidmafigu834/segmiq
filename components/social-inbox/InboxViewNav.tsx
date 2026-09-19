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
        "relative flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-r border-sales-border bg-sales-surface transition-[width] duration-200 ease-out motion-reduce:transition-none",
        viewsCollapsed ? "w-[52px]" : "w-[208px]"
      )}
    >
      <div className="flex h-11 shrink-0 items-center justify-end px-1.5">
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
      <div className="social-inbox-scroll h-0 min-h-0 flex-1 overflow-y-scroll overscroll-contain px-1.5 pb-3">
        <Section session={session} ids={focus} />
        <Divider collapsed={viewsCollapsed} />
        {!viewsCollapsed ? (
          <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-sales-text-muted">
            Messages
          </p>
        ) : null}
        <Section session={session} ids={messages} />
        <Divider collapsed={viewsCollapsed} />
        <Section session={session} ids={ops} />
      </div>
    </nav>
  );
}

function Divider({ collapsed }: { collapsed: boolean }) {
  return <div className={cn("my-2 border-t border-sales-border", collapsed ? "mx-2" : "mx-2")} />;
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
  const button = (
    <button
      type="button"
      onClick={() => session.changeView(id)}
      aria-current={selected ? "page" : undefined}
      className={cn(
        "flex w-full items-center gap-2 rounded-[8px] px-2 py-[7px] text-left text-[13px] transition-colors duration-150",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--sales-focus-outline)]",
        selected
          ? "bg-[color-mix(in_srgb,var(--sales-brand)_18%,transparent)] font-medium text-sales-text-primary"
          : "text-sales-text-secondary hover:bg-sales-surface-hover hover:text-sales-text-primary",
        session.viewsCollapsed && "justify-center px-0"
      )}
    >
      <span
        className={cn(
          "relative inline-flex h-4 w-0.5 shrink-0 rounded-full",
          selected ? "bg-sales-brand" : "bg-transparent"
        )}
        aria-hidden
      />
      <Icon size={15} strokeWidth={1.8} className={cn(selected ? "text-sales-text-primary" : "text-sales-text-muted")} />
      {!session.viewsCollapsed ? (
        <>
          <span className="min-w-0 flex-1 truncate">{meta.label}</span>
          <span className="tabular-nums text-[11px] text-sales-text-muted">{count}</span>
        </>
      ) : null}
    </button>
  );

  if (session.viewsCollapsed) {
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
