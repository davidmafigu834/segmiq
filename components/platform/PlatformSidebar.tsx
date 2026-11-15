"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Home, Lightbulb, LogOut, Moon, MoreHorizontal, Search, Settings, Sun, X } from "lucide-react";
import { AbstractMark, PixelPortrait } from "@/components/real-estate/navigation/workspace-marks";
import { NotificationBell } from "@/components/NotificationBell";
import { secureSignOut } from "@/components/auth/SessionLifecycle";
import { ExitImpersonationMenuItem } from "@/components/agency/ExitImpersonationMenuItem";
import { useCrmThemeOptional } from "@/components/CrmThemeProvider";
import { ShellIcon } from "@/components/shell/shell-icons";
import type { AppShellNavGroup, AppShellNavItem } from "@/components/shell/app-shell-types";
import type { UserRole } from "@/types";
import "@/components/real-estate/navigation/real-estate-sidebar.css";

const GROUP_ICONS: Record<string, AppShellNavItem["icon"]> = {
  Platform: "layout-dashboard",
  Commercial: "receipt",
  Operations: "activity",
  Security: "shield",
  Configuration: "settings",
};

function handleFrom(name: string) {
  return (name.trim().split(/\s+/)[0] ?? "account").toLowerCase();
}

function routeActive(href: string, pathname: string, search: string) {
  const [path, queryString] = href.split("?");
  if (!path) return false;
  if (path === "/dashboard") return pathname === "/dashboard";
  if (path === "/dashboard/commercial-sales") {
    const view = new URLSearchParams(search).get("view");
    const onIndex = pathname === path;
    if (queryString) return onIndex && view === new URLSearchParams(queryString).get("view");
    return onIndex && view !== "quotes";
  }
  return pathname === path || pathname.startsWith(`${path}/`);
}

function itemMatches(item: AppShellNavItem, query: string) {
  if (item.label.toLowerCase().includes(query)) return true;
  return item.children?.some((child) => child.label.toLowerCase().includes(query)) ?? false;
}

export function PlatformSidebar({
  groups,
  pathname,
  userName,
  userRoleLabel,
  profileHref,
  homeHref,
  unread,
  notificationRole,
  drawer = false,
  captureKeys = false,
  onClose,
}: {
  groups: AppShellNavGroup[];
  pathname: string;
  userName: string;
  userRoleLabel: string;
  profileHref?: string;
  homeHref: string;
  unread: number;
  notificationRole: UserRole;
  drawer?: boolean;
  captureKeys?: boolean;
  onClose?: () => void;
}) {
  const theme = useCrmThemeOptional();
  const dark = theme ? theme.theme !== "light" : true;
  const [query, setQuery] = useState("");
  const [panel, setPanel] = useState<"account" | "notices" | null>(null);
  const [covered, setCovered] = useState(false);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<Set<string>>(() => new Set(groups.map((group) => group.label).filter((label) => {
    const group = groups.find((item) => item.label === label);
    return group?.items.some((item) => routeActive(item.href, pathname, "")) ?? false;
  })));
  const searchRef = useRef<HTMLInputElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const accountId = useId();
  const person = userName.trim() || "Account";

  useEffect(() => {
    const nextSearch = window.location.search;
    setSearch(nextSearch);
    setOpen((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const group of groups) {
        const hit = group.items.some((item) => routeActive(item.href, pathname, nextSearch));
        if (hit && !next.has(group.label)) {
          next.add(group.label);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [pathname, groups]);

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
  }, [query, open]);

  useEffect(() => {
    if (!captureKeys) return;
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
      event.preventDefault();
      setPanel(null);
      searchRef.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [captureKeys]);

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

  function linkActive(href: string) {
    return routeActive(href, pathname, search);
  }

  const needle = query.trim().toLowerCase();
  const visible = groups.flatMap((group) => {
    if (!needle) return [group];
    if (group.label.toLowerCase().includes(needle)) return [group];
    const items = group.items.filter((item) => itemMatches(item, needle));
    if (items.length === 0) return [];
    return [{ ...group, items }];
  });

  function toggleGroup(label: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  function closeMenus() {
    setPanel(null);
    onClose?.();
  }

  return (
    <div className={drawer ? "re-sb is-drawer" : "re-sb"}>
      <div className="re-sb-top">
        <div className="re-sb-switch sa-brand">
          <AbstractMark seed="SegmiQ" />
          <span className="re-sb-switch-name">SegmiQ</span>
          <span className="re-sb-pill is-plan">Platform</span>
        </div>
        {drawer ? (
          <button type="button" className="re-sb-close" aria-label="Close menu" onClick={onClose}>
            <X size={16} strokeWidth={1.8} aria-hidden />
          </button>
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

      <nav ref={navRef} className="re-sb-nav" aria-label="Platform">
        {visible.length === 0 ? <p className="re-sb-empty-line">No matches.</p> : null}
        {visible.map((group) => {
          const expanded = Boolean(needle) || open.has(group.label);
          const icon = GROUP_ICONS[group.label] ?? group.items[0]?.icon ?? "layout-dashboard";
          return (
            <div key={group.label} className="re-sb-group">
              <button type="button" className="re-sb-item" aria-expanded={expanded} onClick={() => toggleGroup(group.label)}>
                <ShellIcon name={icon} className="h-[18px] w-[18px] shrink-0" />
                <span className="re-sb-label">{group.label}</span>
                <ChevronDown size={16} strokeWidth={2} aria-hidden className={expanded ? "re-sb-chev is-open" : "re-sb-chev"} />
              </button>
              {expanded ? (
                <div className="re-sb-children">
                  {group.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="re-sb-item is-child"
                      aria-current={linkActive(item.href) ? "page" : undefined}
                      onClick={closeMenus}
                    >
                      <span className="re-sb-label">{item.label}</span>
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      <div className={covered ? "re-sb-foot is-covered" : "re-sb-foot"}>
        <section className="re-sb-note" data-tone="neutral" aria-label="Find a screen">
          <div className="re-sb-note-head">
            <span className="re-sb-note-icon" aria-hidden>
              <Lightbulb size={13} strokeWidth={1.8} />
            </span>
            <p className="re-sb-note-title">Find a screen</p>
          </div>
          <p className="re-sb-note-body">Press F, then type the page you need.</p>
          <button
            type="button"
            className="re-sb-note-action"
            onClick={() => {
              searchRef.current?.focus();
            }}
          >
            Try Find
          </button>
        </section>

        <div className="re-sb-user">
          <PixelPortrait seed={person} />
          <span className="re-sb-handle" title={handleFrom(person)}>
            {handleFrom(person)}
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
          <NotificationBell
            initialUnread={unread}
            role={notificationRole}
            variant="sidebar"
            open={panel === "notices"}
            onOpenChange={(next) => setPanel(next ? "notices" : null)}
          />
          {panel === "account" ? (
            <div id={accountId} role="dialog" aria-label="Account" data-panel="account" className="re-sb-pop re-sb-account">
              <div className="re-sb-menu-id">
                <p className="re-sb-menu-name">{person}</p>
                <p className="re-sb-menu-role">{userRoleLabel}</p>
              </div>
              <div className="re-sb-menu-row is-static">
                <span className="re-sb-label">Theme</span>
                <span className="re-sb-theme" role="group" aria-label="Theme">
                  <button type="button" aria-label="Light theme" aria-pressed={!dark} onClick={() => theme?.setTheme("light")}>
                    <Sun size={13} strokeWidth={1.8} aria-hidden />
                  </button>
                  <button type="button" aria-label="Dark theme" aria-pressed={dark} onClick={() => theme?.setTheme("dark")}>
                    <Moon size={13} strokeWidth={1.8} aria-hidden />
                  </button>
                </span>
              </div>
              <Link href={homeHref} className="re-sb-menu-row" onClick={closeMenus}>
                <Home size={15} strokeWidth={1.7} aria-hidden />
                <span className="re-sb-label">Home</span>
              </Link>
              {profileHref ? (
                <Link href={profileHref} className="re-sb-menu-row" onClick={closeMenus}>
                  <Settings size={15} strokeWidth={1.7} aria-hidden />
                  <span className="re-sb-label">Account</span>
                </Link>
              ) : null}
              <ExitImpersonationMenuItem className="re-sb-menu-row" onSelect={closeMenus} />
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
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
