"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Check, ChevronDown, CircleHelp, Home, Lightbulb, LogOut, Moon, MoreHorizontal, Plus, Search, Sun, TriangleAlert, Users, X } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { secureSignOut } from "@/components/auth/SessionLifecycle";
import { useCrmThemeOptional } from "@/components/CrmThemeProvider";
import type { UserRole } from "@/types";
import "./real-estate-sidebar.css";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "·";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

function handleFrom(name: string) {
  return (name.trim().split(/\s+/)[0] ?? "account").toLowerCase();
}

type SidebarTip = {
  title: string;
  body: string;
  action: string;
  href?: string;
  focusSearch?: boolean;
};

function workspaceTips(homeHref: string): SidebarTip[] {
  const manager = homeHref.startsWith("/client");
  const root = manager ? "/client" : "/sales";
  return [
    {
      title: "Find a screen",
      body: "Press F, then type the page you need.",
      action: "Try Find",
      focusSearch: true,
    },
    {
      title: "Today",
      body: manager ? "What the agency still needs sits on Today." : "A new buyer or seller form starts on Today.",
      action: "Open Today",
      href: homeHref,
    },
    {
      title: "Calendar",
      body: "This week's viewings sit on Calendar.",
      action: "Open Calendar",
      href: `${root}/calendar`,
    },
    manager
      ? {
          title: "Review",
          body: "A file that needs a decision sits in Review.",
          action: "Open Review",
          href: "/client/review",
        }
      : {
          title: "Sales Inbox",
          body: "WhatsApp replies wait in Sales Inbox.",
          action: "Open inbox",
          href: "/sales/inbox",
        },
    {
      title: "Properties",
      body: "Search an address before a viewing is booked.",
      action: "Open Properties",
      href: `${root}/listings`,
    },
  ];
}

export function RealEstateSidebarChrome({
  name,
  role,
  homeHref,
  helpHref,
  notificationRole,
  unread,
  attention,
  drawer,
  onClose,
  query,
  onQuery,
  children,
}: {
  name: string;
  role: string;
  homeHref: string;
  helpHref: string;
  notificationRole: UserRole;
  unread: number;
  attention: number;
  drawer?: boolean;
  onClose?: () => void;
  query: string;
  onQuery: (value: string) => void;
  children: ReactNode;
}) {
  const theme = useCrmThemeOptional();
  const dark = theme?.theme === "dark";
  const [panel, setPanel] = useState<"teams" | "account" | null>(null);
  const [teamQuery, setTeamQuery] = useState("");
  const [covered, setCovered] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const teamsId = useId();
  const accountId = useId();
  const teamVisible = name.toLowerCase().includes(teamQuery.trim().toLowerCase());
  const tips = workspaceTips(homeHref);
  const [tipIndex, setTipIndex] = useState(() => Math.floor(Date.now() / (3 * 60 * 60 * 1000)) % tips.length);
  const tip = tips[tipIndex % tips.length] ?? tips[0]!;

  useEffect(() => {
    const windowMs = 3 * 60 * 60 * 1000;
    let timer = 0;
    function schedule() {
      const delay = Math.max(1000, windowMs - (Date.now() % windowMs));
      timer = window.setTimeout(() => {
        setTipIndex(Math.floor(Date.now() / windowMs) % tips.length);
        schedule();
      }, delay);
    }
    schedule();
    return () => window.clearTimeout(timer);
  }, [tips.length]);

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    function sync() {
      const node = navRef.current;
      if (!node) return;
      setCovered(node.scrollHeight - node.clientHeight - node.scrollTop > 1);
    }
    sync();
    el.addEventListener("scroll", sync, { passive: true });
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", sync);
      observer.disconnect();
    };
  }, [query, children]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPanel(null);
        return;
      }
      if (event.key !== "f" && event.key !== "F") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      const narrow = window.matchMedia("(max-width: 1099px)").matches;
      if (drawer ? !narrow : narrow) return;
      event.preventDefault();
      setPanel(null);
      searchRef.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer]);

  useEffect(() => {
    if (!panel) return;
    function onPointer(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-panel], [data-panel-trigger]")) return;
      setPanel(null);
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [panel]);

  return (
    <div className={drawer ? "re-sb is-drawer" : "re-sb"}>
      <div className="re-sb-top">
        <button
          type="button"
          className="re-sb-switch"
          data-panel-trigger="teams"
          aria-expanded={panel === "teams"}
          aria-controls={teamsId}
          onClick={() => setPanel((current) => (current === "teams" ? null : "teams"))}
        >
          <span className="re-sb-mark" aria-hidden>
            <Home size={14} strokeWidth={2} />
          </span>
          <span className="re-sb-switch-name">{name}</span>
          {attention > 0 ? <span className="re-sb-pill">Overdue</span> : null}
          <ChevronDown size={16} strokeWidth={2} aria-hidden className={panel === "teams" ? "re-sb-chev is-open" : "re-sb-chev"} />
        </button>
        <button type="button" className="re-sb-close" aria-label="Close menu" onClick={onClose}>
          <X size={16} strokeWidth={1.8} aria-hidden />
        </button>
        {panel === "teams" ? (
          <div id={teamsId} role="dialog" aria-label="Workspaces" data-panel="teams" className="re-sb-pop re-sb-teams">
            <label className="re-sb-search">
              <Search size={16} strokeWidth={2} aria-hidden />
              <input value={teamQuery} onChange={(event) => setTeamQuery(event.target.value)} placeholder="Teams" aria-label="Find a team" />
              <kbd>Esc</kbd>
            </label>
            {teamVisible ? (
              <button type="button" className="re-sb-team" aria-current="page">
                <span className="re-sb-mark" aria-hidden>
                  <Home size={14} strokeWidth={2} />
                </span>
                <span className="re-sb-team-copy">
                  <span className="re-sb-team-name">{name}</span>
                </span>
                {attention > 0 ? <span className="re-sb-pill">Overdue</span> : null}
                <Check size={14} strokeWidth={2} aria-hidden />
              </button>
            ) : (
              <p className="re-sb-soon-block">No workspaces match.</p>
            )}
            {teamQuery.trim() === "" ? (
              <div className="re-sb-soon-block">
                <span className="re-sb-soon-icon" aria-hidden>
                  <Users size={18} strokeWidth={1.6} />
                </span>
                <p>Teams you create and join appear here for quick context switching.</p>
              </div>
            ) : null}
            <button type="button" className="re-sb-create" disabled>
              <span className="re-sb-soon-icon" aria-hidden>
                <Plus size={16} strokeWidth={1.8} />
              </span>
              <span className="re-sb-create-copy">
                <span className="re-sb-create-title">Create a team</span>
                <span className="re-sb-create-sub">Collaboration is coming soon.</span>
              </span>
            </button>
          </div>
        ) : null}
      </div>

      <label className="re-sb-search">
        <Search size={16} strokeWidth={2} aria-hidden />
        <input
          ref={searchRef}
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Find"
          aria-label="Find a screen"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              onQuery("");
              event.currentTarget.blur();
            }
          }}
        />
        <kbd>F</kbd>
      </label>

      <nav ref={navRef} className="re-sb-nav" aria-label="Workspace">
        {children}
      </nav>

      <div className={covered ? "re-sb-foot is-covered" : "re-sb-foot"}>
        {attention > 0 ? (
          <section className="re-sb-note" data-tone="danger" aria-label="Action required">
            <div className="re-sb-note-head">
              <span className="re-sb-note-icon" aria-hidden>
                <TriangleAlert size={13} strokeWidth={1.8} />
              </span>
              <p className="re-sb-note-title">Action required</p>
            </div>
            <p className="re-sb-note-body">{homeHref.startsWith("/client") ? "A message is waiting for a reply." : "A viewing follow-up was due yesterday."}</p>
            <Link href={homeHref} className="re-sb-note-action" onClick={onClose}>
              Review today
            </Link>
          </section>
        ) : (
          <section className="re-sb-note" data-tone="tip" aria-label={tip.title}>
            <div className="re-sb-note-head">
              <span className="re-sb-note-icon" aria-hidden>
                <Lightbulb size={13} strokeWidth={1.8} />
              </span>
              <p className="re-sb-note-title">{tip.title}</p>
            </div>
            <p className="re-sb-note-body">{tip.body}</p>
            {tip.focusSearch ? (
              <button
                type="button"
                className="re-sb-note-action"
                onClick={() => {
                  searchRef.current?.focus();
                  onClose?.();
                }}
              >
                {tip.action}
              </button>
            ) : (
              <Link href={tip.href ?? homeHref} className="re-sb-note-action" onClick={onClose}>
                {tip.action}
              </Link>
            )}
          </section>
        )}
        <div className="re-sb-user">
          <span className="re-sb-avatar" aria-hidden>
            {initials(name)}
          </span>
          <span className="re-sb-handle" title={handleFrom(name)}>
            {handleFrom(name)}
          </span>
          <button
            type="button"
            className="re-sb-icon-btn"
            data-panel-trigger="account"
            aria-label="Account menu"
            aria-expanded={panel === "account"}
            aria-controls={accountId}
            onClick={() => setPanel((current) => (current === "account" ? null : "account"))}
          >
            <MoreHorizontal size={16} strokeWidth={1.8} aria-hidden />
          </button>
          <NotificationBell initialUnread={unread} role={notificationRole} variant="sidebar" />
          {panel === "account" ? (
            <div id={accountId} role="dialog" aria-label="Account" data-panel="account" className="re-sb-pop re-sb-account">
              <div className="re-sb-menu-id">
                <p className="re-sb-menu-name">{name}</p>
                <p className="re-sb-menu-role">{role}</p>
              </div>
              <div className="re-sb-menu-row is-static">
                <span className="re-sb-label">Theme</span>
                <span className="re-sb-theme">
                  <button type="button" aria-label="Light theme" aria-pressed={!dark} onClick={() => theme?.setTheme("light")}>
                    <Sun size={13} strokeWidth={1.8} aria-hidden />
                  </button>
                  <button type="button" aria-label="Dark theme" aria-pressed={dark} onClick={() => theme?.setTheme("dark")}>
                    <Moon size={13} strokeWidth={1.8} aria-hidden />
                  </button>
                </span>
              </div>
              <Link href={homeHref} className="re-sb-menu-row" onClick={() => { setPanel(null); onClose?.(); }}>
                <Home size={15} strokeWidth={1.7} aria-hidden />
                <span className="re-sb-label">Home</span>
              </Link>
              <Link href={helpHref} className="re-sb-menu-row" onClick={() => { setPanel(null); onClose?.(); }}>
                <CircleHelp size={15} strokeWidth={1.7} aria-hidden />
                <span className="re-sb-label">Help</span>
              </Link>
              <button
                type="button"
                className="re-sb-menu-row"
                onClick={() => {
                  setPanel(null);
                  void secureSignOut("/login");
                }}
              >
                <LogOut size={15} strokeWidth={1.7} aria-hidden />
                <span className="re-sb-label">Sign out</span>
              </button>
              <div className="re-sb-status">
                <span className="re-sb-status-dot" aria-hidden />
                All systems normal
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
