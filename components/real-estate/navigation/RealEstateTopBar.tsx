"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Building2, Check, ChevronsUpDown, Plus, Search, ShieldCheck } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { useCompanyWorkspace } from "@/components/company/CompanyWorkspaceContext";
import type { UserRole } from "@/types";
import "./real-estate-sidebar.css";

type Property = { id: string; label: string };
type Panel = "properties" | "create" | null;

function listingIdFromPath(pathname: string, base: string) {
  if (!pathname.startsWith(`${base}/`)) return null;
  const id = pathname.slice(base.length + 1).split("/")[0];
  if (!id || id === "mandate" || id === "viewing") return null;
  return id;
}

export function RealEstateTopBar({
  scope,
  unreadNotifications = 0,
  notificationRole,
}: {
  scope: "agent" | "manager";
  unreadNotifications?: number;
  notificationRole: UserRole;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const { clientId } = useCompanyWorkspace();
  const [properties, setProperties] = useState<Property[]>([]);
  const [query, setQuery] = useState("");
  const [panel, setPanel] = useState<Panel>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const propertiesId = useId();
  const createId = useId();
  const base = scope === "agent" ? "/sales" : "/client";
  const listingsBase = `${base}/listings`;
  const routeId = listingIdFromPath(pathname, listingsBase);
  const diligenceHref = `${base}/due-diligence`;
  const onDiligence = pathname === diligenceHref || pathname.startsWith(`${diligenceHref}/`);

  useEffect(() => {
    if (!clientId) return;
    let cancel = false;
    fetch(`/api/clients/${clientId}/listings?limit=80`)
      .then((response) => (response.ok ? response.json() : { listings: [] }))
      .then((json: { listings?: Array<{ id?: string; address?: string | null; suburb?: string | null }> }) => {
        if (cancel) return;
        setProperties(
          (json.listings ?? [])
            .filter((row): row is { id: string; address?: string | null; suburb?: string | null } => Boolean(row.id))
            .map((row) => ({
              id: row.id,
              label: row.address?.trim() || row.suburb?.trim() || "Property",
            }))
        );
      })
      .catch(() => {
        if (!cancel) setProperties([]);
      });
    return () => {
      cancel = true;
    };
  }, [clientId]);

  useEffect(() => {
    if (panel === "properties") searchRef.current?.focus();
  }, [panel]);

  useEffect(() => {
    if (!panel) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setPanel(null);
    }
    function onPointer(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-re-panel], [data-re-panel-trigger]")) return;
      setPanel(null);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [panel]);

  const current = useMemo(
    () => properties.find((item) => item.id === routeId) ?? properties[0] ?? null,
    [properties, routeId]
  );
  const needle = query.trim().toLowerCase();
  const visible = properties.filter((item) => item.label.toLowerCase().includes(needle));
  const starts = [
    { label: "Seller form", href: `${listingsBase}/mandate` },
    { label: "Buyer", href: scope === "agent" ? "/sales/buyers" : "/client/buyers" },
    { label: "Viewing", href: scope === "agent" ? "/sales/listings/viewing" : "/client/viewings" },
  ];

  function open(next: Panel) {
    setPanel((value) => (value === next ? null : next));
    if (next === "properties") setQuery("");
  }

  function go(href: string) {
    setPanel(null);
    router.push(href);
  }

  return (
    <header className="re-top">
      <button
        type="button"
        className="re-top-btn re-top-property"
        data-re-panel-trigger="properties"
        aria-expanded={panel === "properties"}
        aria-controls={propertiesId}
        aria-label={current ? `Current property, ${current.label}` : "Properties"}
        onClick={() => open("properties")}
      >
        <Building2 size={14} strokeWidth={2} aria-hidden />
        <span className="re-top-screen">{current?.label ?? "Properties"}</span>
        <ChevronsUpDown size={14} strokeWidth={2} aria-hidden className="re-top-swap" />
      </button>
      {panel === "properties" ? (
        <div id={propertiesId} role="dialog" aria-label="Properties" data-re-panel="properties" className="re-top-pop re-top-stock">
          <label className="re-sb-search">
            <Search size={16} strokeWidth={2} aria-hidden />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find a property"
              aria-label="Find a property"
            />
            <kbd>Esc</kbd>
          </label>
          {visible.length > 0 ? (
            visible.map((item) => {
              const selected = item.id === current?.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={selected ? "re-prop is-current" : "re-prop"}
                  aria-current={selected ? "true" : undefined}
                  onClick={() => go(`${listingsBase}/${item.id}`)}
                >
                  <Building2 size={14} strokeWidth={2} aria-hidden />
                  <span className="re-prop-name">{item.label}</span>
                  {selected ? <Check size={14} strokeWidth={2} aria-hidden /> : null}
                </button>
              );
            })
          ) : (
            <p className="re-top-empty">{properties.length === 0 ? "No properties yet." : "No properties match."}</p>
          )}
          <button type="button" className="re-top-add" onClick={() => go(`${listingsBase}/mandate`)}>
            <Plus size={15} strokeWidth={2} aria-hidden />
            Add a property
          </button>
        </div>
      ) : null}
      <span className="re-top-gap" />
      <button
        type="button"
        className="re-top-btn"
        data-re-panel-trigger="create"
        aria-expanded={panel === "create"}
        aria-controls={createId}
        onClick={() => open("create")}
      >
        <Plus size={15} strokeWidth={2} aria-hidden />
        Create new
      </button>
      {panel === "create" ? (
        <div id={createId} role="dialog" aria-label="Start something" data-re-panel="create" className="re-top-pop re-top-pop-end">
          {starts.map((item) => (
            <button key={item.href} type="button" className="re-prop" onClick={() => go(item.href)}>
              <span className="re-prop-name">{item.label}</span>
            </button>
          ))}
        </div>
      ) : null}
      <button
        type="button"
        className="re-top-btn"
        aria-current={onDiligence ? "page" : undefined}
        onClick={() => go(diligenceHref)}
      >
        <ShieldCheck size={15} strokeWidth={2} aria-hidden />
        <span>Due diligence</span>
      </button>
      <span className="layout:hidden">
        <NotificationBell initialUnread={unreadNotifications} role={notificationRole} />
      </span>
    </header>
  );
}
