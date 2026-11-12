"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  Bell,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  Handshake,
  Home,
  Inbox,
  Info,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  Sun,
  TriangleAlert,
  Users,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";

export type MockScreen =
  | "today"
  | "properties"
  | "calendar"
  | "people"
  | "sales"
  | "mandates"
  | "diligence"
  | "sellers"
  | "inspections"
  | "buyers"
  | "viewings"
  | "viewingForm"
  | "mandateChoice"
  | "mandateForm"
  | "openMandate"
  | "offers"
  | "inbox"
  | "activities"
  | "inquiries"
  | "seller"
  | "property"
  | "states";

const SCREENS: MockScreen[] = [
  "today",
  "properties",
  "calendar",
  "people",
  "sales",
  "mandates",
  "diligence",
  "sellers",
  "inspections",
  "buyers",
  "viewings",
  "viewingForm",
  "mandateChoice",
  "mandateForm",
  "openMandate",
  "offers",
  "inbox",
  "activities",
  "inquiries",
  "seller",
  "property",
  "states",
];

export function asMockScreen(value: string | undefined): MockScreen {
  return SCREENS.includes(value as MockScreen) ? (value as MockScreen) : "today";
}

const AGENT = {
  name: "Tatenda Marufu",
  handle: "tatenda",
  role: "Agent",
  initials: "TM",
};

type Tone = "danger" | "neutral";

const ANNOUNCEMENT: {
  tone: Tone;
  title: string;
  body: string;
  action: string;
  screen: MockScreen;
} = {
  tone: "danger",
  title: "Action required",
  body: "Tendai Moyo's viewing follow-up was due yesterday.",
  action: "Review today",
  screen: "today",
};

const NOTICES: Array<{ id: string; title: string; body: string; screen: MockScreen }> = [
  {
    id: "overdue",
    title: "Viewing follow-up overdue",
    body: "Tendai Moyo, Borrowdale.",
    screen: "today",
  },
  {
    id: "short",
    title: "Seller files still short",
    body: "Amina Cruz and Tendai Moyo are missing documents.",
    screen: "diligence",
  },
];

type Child = { id: string; label: string; screen: MockScreen };
type Item = { id: string; label: string; icon: LucideIcon; screen?: MockScreen; children?: Child[] };

/** Same order as the real-estate agent sidebar: open daily work, then the three groups. */
const NAV: Item[] = [
  { id: "today", label: "Today", icon: LayoutDashboard, screen: "today" },
  { id: "properties", label: "Properties", icon: Building2, screen: "properties" },
  { id: "calendar", label: "Calendar", icon: CalendarDays, screen: "calendar" },
  { id: "people", label: "People", icon: Users, screen: "people" },
  { id: "sales", label: "Sales", icon: Handshake, screen: "sales" },
  {
    id: "acquisition",
    label: "Property acquisition",
    icon: KeyRound,
    children: [
      { id: "mandates", label: "Mandates", screen: "mandates" },
      { id: "mandate-link", label: "Mandate link", screen: "mandateChoice" },
      { id: "diligence", label: "Due diligence", screen: "diligence" },
      { id: "sellers", label: "Sellers", screen: "sellers" },
      { id: "inspections", label: "Inspections", screen: "inspections" },
    ],
  },
  {
    id: "buyer_sales",
    label: "Buyer & tenant sales",
    icon: UsersRound,
    children: [
      { id: "buyers", label: "Buyers", screen: "buyers" },
      { id: "viewings", label: "Viewings", screen: "viewings" },
      { id: "viewing-link", label: "Viewing link", screen: "viewingForm" },
      { id: "offers", label: "Offers", screen: "offers" },
    ],
  },
  {
    id: "follow_up",
    label: "Follow-up",
    icon: Inbox,
    children: [
      { id: "inbox", label: "Inbox", screen: "inbox" },
      { id: "activities", label: "Activities", screen: "activities" },
      { id: "inquiries", label: "Inquiries", screen: "inquiries" },
    ],
  },
];

function screenOn(item: MockScreen, current: MockScreen) {
  if (item === current) return true;
  if (item === "mandateChoice" && (current === "mandateForm" || current === "openMandate")) return true;
  if (item === "sellers" && current === "seller") return true;
  if (item === "properties" && current === "property") return true;
  return false;
}

function groupFor(screen: MockScreen) {
  return NAV.find((item) => item.children?.some((child) => screenOn(child.screen, screen)))?.id ?? null;
}

const DOCK = NAV.filter((item): item is Item & { screen: MockScreen } => Boolean(item.screen));

function screenTitle(screen: MockScreen) {
  for (const item of NAV) {
    if (item.screen && screenOn(item.screen, screen)) return item.label;
    const child = item.children?.find((entry) => screenOn(entry.screen, screen));
    if (child) return child.label;
  }
  if (screen === "states") return "Screen states";
  return "Today";
}

type Panel = "teams" | "account" | "notices" | null;

export function MockFrame({
  screen,
  dark,
  onNavigate,
  onToggleDark,
  onReplay,
  children,
}: {
  screen: MockScreen;
  dark: boolean;
  onNavigate: (screen: MockScreen) => void;
  onToggleDark: () => void;
  onReplay: () => void;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [query, setQuery] = useState("");
  const [teamQuery, setTeamQuery] = useState("");
  const [unread, setUnread] = useState(true);
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const group = groupFor(screen);
    return new Set(group ? [group] : []);
  });
  const searchRef = useRef<HTMLInputElement>(null);
  const teamSearchRef = useRef<HTMLInputElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const [menuBehind, setMenuBehind] = useState(false);
  const teamsId = useId();
  const accountId = useId();
  const noticesId = useId();

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    function sync() {
      const node = navRef.current;
      if (!node) return;
      setMenuBehind(node.scrollHeight - node.clientHeight - node.scrollTop > 1);
    }
    sync();
    el.addEventListener("scroll", sync, { passive: true });
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", sync);
      observer.disconnect();
    };
  }, [query, openGroups, screen]);

  useEffect(() => {
    const group = groupFor(screen);
    if (!group) return;
    setOpenGroups((prev) => {
      if (prev.has(group)) return prev;
      const next = new Set(prev);
      next.add(group);
      return next;
    });
  }, [screen]);

  useEffect(() => {
    if (panel === "teams") teamSearchRef.current?.focus();
  }, [panel]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPanel(null);
        setMobileOpen(false);
        return;
      }
      if (event.key !== "f" && event.key !== "F") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      event.preventDefault();
      setPanel(null);
      searchRef.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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

  function go(next: MockScreen) {
    setPanel(null);
    setMobileOpen(false);
    setQuery("");
    onNavigate(next);
  }

  function togglePanel(next: Exclude<Panel, null>) {
    setPanel((current) => (current === next ? null : next));
    if (next === "notices") setUnread(false);
  }

  function toggleGroup(id: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const q = query.trim().toLowerCase();
  const visible = NAV.flatMap((item) => {
    if (!q) return [item];
    const self = item.label.toLowerCase().includes(q);
    const children = item.children?.filter((child) => child.label.toLowerCase().includes(q));
    if (self) return [item];
    if (children && children.length > 0) return [{ ...item, children }];
    return [];
  });
  const teamVisible = AGENT.name.toLowerCase().includes(teamQuery.trim().toLowerCase());

  return (
    <div data-theme={dark ? "dark" : "light"} className="re-mock re-frame sales-dashboard-premium bg-sales-bg text-sales-text-primary">
      {mobileOpen ? (
        <button type="button" className="re-sb-backdrop" aria-label="Close menu" onClick={() => setMobileOpen(false)} />
      ) : null}
      <aside className={mobileOpen ? "re-sb is-open" : "re-sb"}>
        <div className="re-sb-top">
          <button
            type="button"
            className="re-sb-switch"
            data-panel-trigger="teams"
            aria-expanded={panel === "teams"}
            aria-controls={teamsId}
            onClick={() => togglePanel("teams")}
          >
            <span className="re-sb-mark" aria-hidden>
              <Home size={14} strokeWidth={2} />
            </span>
            <span className="re-sb-switch-name">{AGENT.name}</span>
            {ANNOUNCEMENT.tone === "danger" ? <span className="re-sb-pill">Overdue</span> : null}
            <ChevronDown size={16} strokeWidth={2} aria-hidden className={panel === "teams" ? "re-sb-chev is-open" : "re-sb-chev"} />
          </button>
          <button type="button" className="re-sb-close" aria-label="Close menu" onClick={() => setMobileOpen(false)}>
            <X size={16} strokeWidth={1.8} aria-hidden />
          </button>
          {panel === "teams" ? (
            <div id={teamsId} role="dialog" aria-label="Workspaces" data-panel="teams" className="re-sb-pop re-sb-teams">
              <label className="re-sb-search">
                <Search size={16} strokeWidth={2} aria-hidden />
                <input
                  ref={teamSearchRef}
                  value={teamQuery}
                  onChange={(event) => setTeamQuery(event.target.value)}
                  placeholder="Teams"
                  aria-label="Find a team"
                />
                <kbd>Esc</kbd>
              </label>
              {teamVisible ? (
                <button type="button" className="re-sb-team is-current" aria-current="true">
                  <span className="re-sb-mark" aria-hidden>
                    <Home size={14} strokeWidth={2} />
                  </span>
                  <span className="re-sb-team-copy">
                    <span className="re-sb-team-name">{AGENT.name}</span>
                  </span>
                  {ANNOUNCEMENT.tone === "danger" ? <span className="re-sb-pill">Overdue</span> : null}
                  <Check size={14} strokeWidth={2} aria-hidden className="re-sb-check" />
                </button>
              ) : (
                <p className="re-sb-empty-line">No workspaces match.</p>
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

        <label className="re-sb-search re-sb-find">
          <Search size={16} strokeWidth={2} aria-hidden />
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find"
            aria-label="Find a screen"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setQuery("");
                event.currentTarget.blur();
              }
            }}
          />
          <kbd>F</kbd>
        </label>

        <nav ref={navRef} className="re-sb-nav" aria-label="Workspace">
          {visible.length === 0 ? <p className="re-sb-empty-line">No matches.</p> : null}
          {visible.map((item) => {
            const Icon = item.icon;
            const expanded = Boolean(q) || openGroups.has(item.id);
            if (!item.children) {
              const current = item.screen ? screenOn(item.screen, screen) : false;
              return (
                <button
                  key={item.id}
                  type="button"
                  className="re-sb-item"
                  aria-current={current ? "page" : undefined}
                  onClick={() => item.screen && go(item.screen)}
                >
                  <Icon size={18} strokeWidth={2} aria-hidden />
                  <span className="re-sb-label">{item.label}</span>
                </button>
              );
            }
            const childCurrent = item.children.some((child) => screenOn(child.screen, screen));
            return (
              <div key={item.id} className="re-sb-group">
                <button
                  type="button"
                  className="re-sb-item"
                  aria-expanded={expanded}
                  onClick={() => toggleGroup(item.id)}
                >
                  <Icon size={18} strokeWidth={2} aria-hidden />
                  <span className="re-sb-label">{item.label}</span>
                  <ChevronDown size={16} strokeWidth={2} aria-hidden className={expanded ? "re-sb-chev is-open" : "re-sb-chev"} />
                </button>
                {expanded ? (
                  <div className="re-sb-children">
                    {item.children.map((child) => (
                      <button
                        key={child.id}
                        type="button"
                        className="re-sb-item is-child"
                        aria-current={screenOn(child.screen, screen) ? "page" : undefined}
                        onClick={() => go(child.screen)}
                      >
                        <span className="re-sb-label">{child.label}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>

        <div className={menuBehind ? "re-sb-foot is-covered" : "re-sb-foot"}>
          <section className="re-sb-note" data-tone={ANNOUNCEMENT.tone} aria-label={ANNOUNCEMENT.title}>
            <div className="re-sb-note-head">
              <span className="re-sb-note-icon" aria-hidden>
                {ANNOUNCEMENT.tone === "danger" ? (
                  <TriangleAlert size={13} strokeWidth={1.8} />
                ) : (
                  <Info size={13} strokeWidth={1.8} />
                )}
              </span>
              <p className="re-sb-note-title">{ANNOUNCEMENT.title}</p>
            </div>
            <p className="re-sb-note-body">{ANNOUNCEMENT.body}</p>
            <button type="button" className="re-sb-note-action" onClick={() => go(ANNOUNCEMENT.screen)}>
              {ANNOUNCEMENT.action}
            </button>
          </section>

          <div className="re-sb-user">
            <span className="re-sb-avatar" aria-hidden>
              {AGENT.initials}
            </span>
            <span className="re-sb-handle" title={AGENT.handle}>
              {AGENT.handle}
            </span>
            <button
              type="button"
              className="re-sb-icon-btn"
              data-panel-trigger="account"
              aria-label="Account menu"
              aria-expanded={panel === "account"}
              aria-controls={accountId}
              onClick={() => togglePanel("account")}
            >
              <MoreHorizontal size={16} strokeWidth={1.8} aria-hidden />
            </button>
            <button
              type="button"
              className="re-sb-icon-btn"
              data-panel-trigger="notices"
              aria-label={unread ? "Notifications, unread" : "Notifications"}
              aria-expanded={panel === "notices"}
              aria-controls={noticesId}
              onClick={() => togglePanel("notices")}
            >
              <Bell size={16} strokeWidth={1.8} aria-hidden />
              {unread ? <span className="re-sb-dot" aria-hidden /> : null}
            </button>

            {panel === "account" ? (
              <div id={accountId} role="dialog" aria-label="Account" data-panel="account" className="re-sb-pop re-sb-account">
                <div className="re-sb-menu-id">
                  <p className="re-sb-menu-name">{AGENT.name}</p>
                  <p className="re-sb-menu-role">{AGENT.role}</p>
                </div>
                <div className="re-sb-menu-row is-static">
                  <span className="re-sb-label">Theme</span>
                  <span className="re-sb-theme">
                    <button type="button" aria-label="Light theme" aria-pressed={!dark} onClick={() => dark && onToggleDark()}>
                      <Sun size={13} strokeWidth={1.8} aria-hidden />
                    </button>
                    <button type="button" aria-label="Dark theme" aria-pressed={dark} onClick={() => !dark && onToggleDark()}>
                      <Moon size={13} strokeWidth={1.8} aria-hidden />
                    </button>
                  </span>
                </div>
                <button type="button" className="re-sb-menu-row" onClick={() => go("today")}>
                  <Home size={15} strokeWidth={1.7} aria-hidden />
                  <span className="re-sb-label">Home</span>
                </button>
                <button type="button" className="re-sb-menu-row" onClick={() => go("states")}>
                  <LayoutDashboard size={15} strokeWidth={1.7} aria-hidden />
                  <span className="re-sb-label">Screen states</span>
                </button>
                <button
                  type="button"
                  className="re-sb-menu-row"
                  onClick={() => {
                    setPanel(null);
                    onReplay();
                  }}
                >
                  <RotateCcw size={15} strokeWidth={1.7} aria-hidden />
                  <span className="re-sb-label">Replay loading</span>
                </button>
                <button type="button" className="re-sb-menu-row" onClick={() => setPanel(null)}>
                  <LogOut size={15} strokeWidth={1.7} aria-hidden />
                  <span className="re-sb-label">Sign out</span>
                </button>
                <div className="re-sb-status">
                  <span className="re-sb-status-dot" aria-hidden />
                  All systems normal
                </div>
              </div>
            ) : null}

            {panel === "notices" ? (
              <div id={noticesId} role="dialog" aria-label="Notifications" data-panel="notices" className="re-sb-pop re-sb-notices">
                <p className="re-sb-pop-title">Notifications</p>
                {NOTICES.map((notice) => (
                  <button key={notice.id} type="button" className="re-sb-notice" onClick={() => go(notice.screen)}>
                    <span className="re-sb-notice-title">{notice.title}</span>
                    <span className="re-sb-notice-body">{notice.body}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </aside>

      <div className="re-frame-main">
        <div className="re-sb-bar">
          <button
            type="button"
            className="re-sb-bar-mark"
            aria-label="Open menu"
            onClick={() => {
              setPanel(null);
              setMobileOpen(true);
            }}
          >
            <span className="re-sb-mark" aria-hidden>
              <Home size={14} strokeWidth={2} />
            </span>
          </button>
          <span className="re-sb-bar-name">{screenTitle(screen)}</span>
          <button
            type="button"
            className="re-sb-icon-btn"
            data-panel-trigger="notices"
            aria-label={unread ? "Notifications, unread" : "Notifications"}
            aria-expanded={panel === "notices"}
            aria-controls={`${noticesId}-bar`}
            onClick={() => togglePanel("notices")}
          >
            <Bell size={16} strokeWidth={1.8} aria-hidden />
            {unread ? <span className="re-sb-dot" aria-hidden /> : null}
          </button>
          {panel === "notices" && !mobileOpen ? (
            <div id={`${noticesId}-bar`} role="dialog" aria-label="Notifications" data-panel="notices" className="re-sb-pop re-sb-bar-notices">
              <p className="re-sb-pop-title">Notifications</p>
              {NOTICES.map((notice) => (
                <button key={notice.id} type="button" className="re-sb-notice" onClick={() => go(notice.screen)}>
                  <span className="re-sb-notice-title">{notice.title}</span>
                  <span className="re-sb-notice-body">{notice.body}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <main className="re-scroll">
          <div className="mx-auto max-w-[1120px] px-4 py-6 min-[480px]:px-5 min-[480px]:py-8">{children}</div>
        </main>
        <nav className="re-dock" aria-label="Daily work">
          {DOCK.map((item) => {
            const Icon = item.icon;
            const current = screenOn(item.screen, screen);
            return (
              <button
                key={item.id}
                type="button"
                className="re-dock-item"
                aria-current={current ? "page" : undefined}
                onClick={() => go(item.screen)}
              >
                <span className="re-dock-icon">
                  <Icon size={20} strokeWidth={1.75} aria-hidden />
                  {item.id === "today" && ANNOUNCEMENT.tone === "danger" ? <span className="re-dock-dot" aria-hidden /> : null}
                </span>
                <span className="re-dock-label">{item.label}</span>
              </button>
            );
          })}
          <button
            type="button"
            className="re-dock-item"
            aria-expanded={mobileOpen}
            aria-current={DOCK.some((item) => screenOn(item.screen, screen)) ? undefined : "page"}
            onClick={() => {
              setPanel(null);
              setMobileOpen((open) => !open);
            }}
          >
            <span className="re-dock-icon">
              <Menu size={20} strokeWidth={1.75} aria-hidden />
            </span>
            <span className="re-dock-label">More</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
