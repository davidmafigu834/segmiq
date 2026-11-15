"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  Bell,
  Building2,
  Check,
  ChevronDown,
  ChevronsUpDown,
  Home,
  Info,
  LogOut,
  Menu,
  Moon,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  Shield,
  Sun,
  TriangleAlert,
  X,
} from "lucide-react";
import { AbstractMark, PixelPortrait } from "@/components/real-estate/navigation/workspace-marks";
import { DOCK, NAV, STARTS, groupFor, screenOn, type Screen } from "./nav";
import { ORGS } from "./desk";

const OPERATOR = {
  name: "Rudo Chikwanha",
  handle: "rudo",
  role: "Super Admin",
};

const ANNOUNCEMENT = {
  title: "Action required",
  body: "Charter Properties has not signed the service agreement.",
  action: "Open organisation",
  screen: "organisation" as Screen,
};

const NOTICES = [
  { id: "agreement", title: "Agreement unsigned", body: "Charter Properties.", screen: "organisation" as Screen },
  { id: "invoice", title: "Invoice overdue", body: "Highlands Realty, INV-2041.", screen: "invoice" as Screen },
  { id: "whatsapp", title: "WhatsApp delivery degraded", body: "Follow-up jobs are paused.", screen: "incidents" as Screen },
];

type Panel = "account" | "notices" | "orgs" | "create" | null;

export function MockFrame({
  screen,
  dark,
  onNavigate,
  onToggleDark,
  onReplay,
  children,
}: {
  screen: Screen;
  dark: boolean;
  onNavigate: (screen: Screen, id?: string) => void;
  onToggleDark: () => void;
  onReplay: () => void;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [query, setQuery] = useState("");
  const [orgQuery, setOrgQuery] = useState("");
  const [orgId, setOrgId] = useState(ORGS[0].id);
  const [unread, setUnread] = useState(true);
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const group = groupFor(screen);
    return new Set(group ? [group] : []);
  });
  const searchRef = useRef<HTMLInputElement>(null);
  const orgSearchRef = useRef<HTMLInputElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const [menuBehind, setMenuBehind] = useState(false);
  const accountId = useId();
  const noticesId = useId();
  const orgsId = useId();
  const createId = useId();

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
    if (panel === "orgs") orgSearchRef.current?.focus();
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

  function go(next: Screen, id?: string) {
    setPanel(null);
    setMobileOpen(false);
    setQuery("");
    onNavigate(next, id);
  }

  function togglePanel(next: Exclude<Panel, null>) {
    setPanel((current) => (current === next ? null : next));
    if (next === "notices") setUnread(false);
    if (next === "orgs") setOrgQuery("");
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
  const orgNeedle = orgQuery.trim().toLowerCase();
  const orgRows = ORGS.filter((org) => org.name.toLowerCase().includes(orgNeedle));
  const currentOrg = ORGS.find((org) => org.id === orgId) ?? ORGS[0];

  if (screen === "signin") {
    return (
      <div data-theme={dark ? "dark" : "light"} className="re-mock re-frame sales-dashboard-premium bg-sales-bg text-sales-text-primary">
        {children}
      </div>
    );
  }

  return (
    <div data-theme={dark ? "dark" : "light"} className="re-mock re-frame sales-dashboard-premium bg-sales-bg text-sales-text-primary">
      {mobileOpen ? (
        <button type="button" className="re-sb-backdrop" aria-label="Close menu" onClick={() => setMobileOpen(false)} />
      ) : null}
      <aside className={mobileOpen ? "re-sb is-open" : "re-sb"}>
        <div className="re-sb-top">
          <div className="re-sb-switch sa-brand">
            <AbstractMark seed="SegmiQ" />
            <span className="re-sb-switch-name">SegmiQ</span>
            <span className="re-sb-pill is-plan">Platform</span>
          </div>
          <button type="button" className="re-sb-close" aria-label="Close menu" onClick={() => setMobileOpen(false)}>
            <X size={16} strokeWidth={1.8} aria-hidden />
          </button>
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

        <nav ref={navRef} className="re-sb-nav" aria-label="Platform">
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
            return (
              <div key={item.id} className="re-sb-group">
                <button type="button" className="re-sb-item" aria-expanded={expanded} onClick={() => toggleGroup(item.id)}>
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
          <section className="re-sb-note" data-tone="danger" aria-label={ANNOUNCEMENT.title}>
            <div className="re-sb-note-head">
              <span className="re-sb-note-icon" aria-hidden>
                <TriangleAlert size={13} strokeWidth={1.8} />
              </span>
              <p className="re-sb-note-title">{ANNOUNCEMENT.title}</p>
            </div>
            <p className="re-sb-note-body">{ANNOUNCEMENT.body}</p>
            <button type="button" className="re-sb-note-action" onClick={() => go(ANNOUNCEMENT.screen, "charter")}>
              {ANNOUNCEMENT.action}
            </button>
          </section>

          <div className="re-sb-user">
            <PixelPortrait seed={OPERATOR.name} />
            <span className="re-sb-handle" title={OPERATOR.handle}>
              {OPERATOR.handle}
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
                  <p className="re-sb-menu-name">{OPERATOR.name}</p>
                  <p className="re-sb-menu-role">{OPERATOR.role}</p>
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
                <button type="button" className="re-sb-menu-row" onClick={() => go("overview")}>
                  <Home size={15} strokeWidth={1.7} aria-hidden />
                  <span className="re-sb-label">Home</span>
                </button>
                <button type="button" className="re-sb-menu-row" onClick={() => go("settings")}>
                  <Shield size={15} strokeWidth={1.7} aria-hidden />
                  <span className="re-sb-label">Account</span>
                </button>
                <button type="button" className="re-sb-menu-row" onClick={() => go("states")}>
                  <Info size={15} strokeWidth={1.7} aria-hidden />
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
                <button type="button" className="re-sb-menu-row" onClick={() => go("signin")}>
                  <LogOut size={15} strokeWidth={1.7} aria-hidden />
                  <span className="re-sb-label">Sign out</span>
                </button>
                <div className="re-sb-status">
                  <span className="re-sb-status-dot" aria-hidden />
                  WhatsApp delivery is degraded
                </div>
              </div>
            ) : null}

            {panel === "notices" ? (
              <div id={noticesId} role="dialog" aria-label="Notifications" data-panel="notices" className="re-sb-pop re-sb-notices">
                <p className="re-sb-pop-title">Notifications</p>
                {NOTICES.map((notice) => (
                  <button key={notice.id} type="button" className="re-sb-notice" onClick={() => go(notice.screen, notice.screen === "organisation" ? "charter" : notice.screen === "invoice" ? "highlands" : undefined)}>
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
        <header className="re-top">
          <button
            type="button"
            className="re-top-btn re-top-property"
            data-panel-trigger="orgs"
            aria-expanded={panel === "orgs"}
            aria-controls={orgsId}
            aria-label={`Current organisation, ${currentOrg.name}`}
            onClick={() => togglePanel("orgs")}
          >
            <Building2 size={14} strokeWidth={2} aria-hidden className="re-top-property-icon" />
            <span className="re-top-screen">{currentOrg.name}</span>
            <ChevronsUpDown size={14} strokeWidth={2} aria-hidden className="re-top-swap" />
          </button>
          {panel === "orgs" ? (
            <div id={orgsId} role="dialog" aria-label="Organisations" data-panel="orgs" className="re-sb-pop re-top-pop re-top-stock">
              <label className="re-sb-search">
                <Search size={16} strokeWidth={2} aria-hidden />
                <input
                  ref={orgSearchRef}
                  value={orgQuery}
                  onChange={(event) => setOrgQuery(event.target.value)}
                  placeholder="Find an organisation"
                  aria-label="Find an organisation"
                />
                <kbd>Esc</kbd>
              </label>
              {orgRows.length > 0 ? (
                orgRows.map((org) => {
                  const current = org.id === currentOrg.id;
                  return (
                    <button
                      key={org.id}
                      type="button"
                      className={current ? "re-prop is-current" : "re-prop"}
                      aria-current={current ? "true" : undefined}
                      onClick={() => {
                        setOrgId(org.id);
                        go("organisation", org.id);
                      }}
                    >
                      <Building2 size={14} strokeWidth={2} aria-hidden />
                      <span className="re-prop-name">{org.name}</span>
                      {current ? <Check size={14} strokeWidth={2} aria-hidden className="re-sb-check" /> : null}
                    </button>
                  );
                })
              ) : (
                <p className="re-sb-empty-line">No organisations match.</p>
              )}
              <button type="button" className="re-top-add" onClick={() => go("organisations", "add")}>
                <Plus size={15} strokeWidth={2} aria-hidden />
                New organisation
              </button>
            </div>
          ) : null}
          <span className="re-top-gap" />
          <button
            type="button"
            className="re-top-btn"
            data-panel-trigger="create"
            aria-expanded={panel === "create"}
            aria-controls={createId}
            onClick={() => togglePanel("create")}
          >
            <Plus size={15} strokeWidth={2} aria-hidden />
            <span className="re-top-new-label">Create new</span>
          </button>
          {panel === "create" ? (
            <div id={createId} role="dialog" aria-label="Create" data-panel="create" className="re-sb-pop re-top-pop re-top-pop-end">
              {STARTS.map((item) => (
                <button key={item.label} type="button" className="re-sb-menu-row" onClick={() => go(item.screen, item.id)}>
                  <span className="re-sb-label">{item.label}</span>
                </button>
              ))}
            </div>
          ) : null}
          <button type="button" className="re-top-btn" aria-current={screen === "support" ? "page" : undefined} onClick={() => go("support")}>
            <Shield size={15} strokeWidth={2} aria-hidden />
            <span>Support access</span>
          </button>
          <button
            type="button"
            className="re-sb-icon-btn re-top-bell"
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
                <button key={notice.id} type="button" className="re-sb-notice" onClick={() => go(notice.screen, notice.id === "agreement" ? "charter" : notice.id === "invoice" ? "highlands" : undefined)}>
                  <span className="re-sb-notice-title">{notice.title}</span>
                  <span className="re-sb-notice-body">{notice.body}</span>
                </button>
              ))}
            </div>
          ) : null}
        </header>
        <main className="re-scroll">
          <div className="mx-auto max-w-[1120px] px-4 py-6 min-[480px]:px-5 min-[480px]:py-8">{children}</div>
        </main>
        <nav className="re-dock" aria-label="Platform">
          {DOCK.map((item) => {
            const Icon = item.icon;
            const current = screenOn(item.screen, screen);
            return (
              <button key={item.id} type="button" className="re-dock-item" aria-current={current ? "page" : undefined} onClick={() => go(item.screen)}>
                <span className="re-dock-icon">
                  <Icon size={20} strokeWidth={1.75} aria-hidden />
                  {item.id === "overview" ? <span className="re-dock-dot" aria-hidden /> : null}
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
