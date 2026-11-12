"use client";

/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · component-scope */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type MouseEvent } from "react";
import { Check, Columns2, Home, KeyRound, ListFilter, Rows2, Search, UserRound } from "lucide-react";
import { cn } from "@/lib/ui/cn";

export type SellerHit = { id: string; name: string; detail: string; href: string; active?: boolean; company?: boolean };
export type TodayView = "split" | "stacked";
type SellerScope = "all" | "active" | "company";

type OwnerPayload = {
  owners?: { contactId: string; name: string | null; kind?: string; properties: number; active?: number; opportunityIds?: string[] }[];
  opportunities?: { id: string; contact_id: string | null; suburb: string | null; city: string | null }[];
};

const RESULT_LIMIT = 6;

const SCOPES: { id: SellerScope; label: string; placeholder: string; heading: string }[] = [
  { id: "all", label: "All sellers", placeholder: "Search sellers…", heading: "Sellers" },
  { id: "active", label: "With an active property", placeholder: "Search active sellers…", heading: "Active sellers" },
  { id: "company", label: "Companies", placeholder: "Search companies…", heading: "Companies" },
];

const toolBtn =
  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-sales-border bg-sales-surface text-sales-text-secondary transition-colors hover:bg-sales-surface-hover hover:text-sales-text-primary focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]";

const VIEW_KEY = "re-today-view";

/** Today layout choice, kept per browser. */
export function useTodayView(): [TodayView, (view: TodayView) => void] {
  const [view, setView] = useState<TodayView>("split");
  useEffect(() => {
    if (window.localStorage.getItem(VIEW_KEY) === "stacked") setView("stacked");
  }, []);
  const choose = useCallback((next: TodayView) => {
    setView(next);
    window.localStorage.setItem(VIEW_KEY, next);
  }, []);
  return [view, choose];
}

function sellersFromPayload(json: OwnerPayload, ownersHref: string): SellerHit[] {
  const opportunities = json.opportunities ?? [];
  return (json.owners ?? []).map((owner) => {
    const owned = opportunities.filter((row) =>
      owner.opportunityIds?.length ? owner.opportunityIds.includes(row.id) : row.contact_id === owner.contactId
    );
    const places = [...new Set(owned.map((row) => row.suburb || row.city).filter((value): value is string => Boolean(value)))].slice(0, 2);
    const count = `${owner.properties} ${owner.properties === 1 ? "property" : "properties"}`;
    const name = owner.name || "Unnamed seller";
    const profileId = owner.contactId.startsWith("unlinked:") || owner.contactId.startsWith("company:")
      ? owner.opportunityIds?.[0]
      : owner.contactId;
    return {
      id: owner.contactId,
      name,
      detail: [owner.kind === "company" ? "Company" : null, count, ...places].filter(Boolean).join(" · "),
      href: profileId ? `${ownersHref}/${encodeURIComponent(profileId)}` : `${ownersHref}?q=${encodeURIComponent(name)}`,
      active: (owner.active ?? 0) > 0,
      company: owner.kind === "company",
    };
  });
}

/**
 * Today toolbar: seller search on the left, onboarding on the right.
 * Sellers load on first focus, so the dashboard pays nothing until someone searches.
 */
export function TodayCommandBar({
  clientId,
  ownersHref = "/sales/owners",
  sellerHref = "/sales/listings/mandate",
  buyerHref = "/sales/listings/viewing",
  sellers: providedSellers,
  onNavigate,
  view,
  onViewChange,
  viewToggleClassName = "hidden layout:flex",
}: {
  clientId?: string;
  ownersHref?: string;
  sellerHref?: string;
  buyerHref?: string;
  /** Supplied sellers skip the fetch. */
  sellers?: SellerHit[];
  onNavigate?: (href: string) => void;
  /** Side by side or stacked sections. The toggle shows only where the page has two columns. */
  view?: TodayView;
  onViewChange?: (view: TodayView) => void;
  viewToggleClassName?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const [scope, setScope] = useState<SellerScope>("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loaded, setLoaded] = useState<SellerHit[] | null>(providedSellers ?? null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  const load = useCallback(async () => {
    if (providedSellers || loaded || status === "loading" || !clientId) return;
    setStatus("loading");
    try {
      const res = await fetch(`/api/clients/${clientId}/owners`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setLoaded(sellersFromPayload((await res.json()) as OwnerPayload, ownersHref));
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }, [clientId, loaded, ownersHref, providedSellers, status]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      event.preventDefault();
      inputRef.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDown(event: PointerEvent) {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const needle = query.trim().toLowerCase();
  const scoped = scope !== "all";
  const scopeInfo = SCOPES.find((item) => item.id === scope) ?? SCOPES[0];
  const matches = useMemo(() => {
    if ((!needle && !scoped) || !loaded) return [];
    return loaded.filter((seller) => {
      if (scope === "active" && !seller.active) return false;
      if (scope === "company" && !seller.company) return false;
      return !needle || `${seller.name} ${seller.detail}`.toLowerCase().includes(needle);
    });
  }, [loaded, needle, scope, scoped]);
  const shown = matches.slice(0, RESULT_LIMIT);
  const allHref = `${ownersHref}?q=${encodeURIComponent(query.trim())}`;
  const showPanel = open && (needle.length > 0 || scoped);

  function pickScope(next: SellerScope) {
    setScope(next);
    setActive(0);
    void load();
    setOpen(next !== "all" || needle.length > 0);
    inputRef.current?.focus();
  }

  function go(href: string) {
    setOpen(false);
    if (onNavigate) onNavigate(href);
    else router.push(href);
  }

  function linkClick(href: string) {
    return (event: MouseEvent<HTMLAnchorElement>) => {
      setOpen(false);
      if (!onNavigate) return;
      event.preventDefault();
      onNavigate(href);
    };
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-3">
      <h1 className="sr-only">Today</h1>
      <div className="flex min-w-0 flex-[1_1_360px] items-center gap-2">
      <div ref={boxRef} className="relative min-w-0 flex-1">
        <label className="group flex h-11 min-w-0 items-center gap-2.5 rounded-[10px] border border-sales-border bg-sales-surface px-3 transition-colors focus-within:border-sales-text-muted focus-within:shadow-[var(--sales-focus-ring)]">
          <Search size={16} strokeWidth={1.75} className="shrink-0 text-sales-text-muted" aria-hidden />
          <span className="sr-only">Search sellers</span>
          <input
            ref={inputRef}
            type="search"
            role="combobox"
            aria-expanded={showPanel}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={showPanel && shown[active] ? `${listId}-${active}` : undefined}
            autoComplete="off"
            value={query}
            placeholder={scopeInfo.placeholder}
            title="Search sellers by name or suburb"
            onFocus={() => {
              void load();
              setOpen(true);
            }}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
              setOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                if (query) setQuery("");
                else inputRef.current?.blur();
                setOpen(false);
              } else if (event.key === "ArrowDown") {
                event.preventDefault();
                setActive((index) => Math.min(index + 1, Math.max(shown.length - 1, 0)));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive((index) => Math.max(index - 1, 0));
              } else if (event.key === "Enter" && (needle || scoped)) {
                event.preventDefault();
                go(shown[active]?.href ?? allHref);
              }
            }}
            className="h-full min-w-0 flex-1 bg-transparent text-[14px] text-sales-text-primary outline-none placeholder:text-sales-text-muted [&::-webkit-search-cancel-button]:hidden"
          />
          <kbd aria-hidden className="hidden h-6 min-w-6 shrink-0 items-center justify-center rounded-[6px] border border-sales-border px-1.5 font-sans text-[12px] font-medium text-sales-text-muted group-focus-within:hidden sm:inline-flex">
            /
          </kbd>
        </label>

        {showPanel ? (
          <div className="absolute left-0 top-[calc(100%+6px)] z-30 w-full min-w-[min(420px,calc(100vw_-_2rem))] overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface shadow-sales-dropdown">
            {status === "loading" || (!loaded && status !== "error") ? (
              <p className="px-4 py-3 text-[13px] text-sales-text-muted">Looking through your sellers…</p>
            ) : status === "error" ? (
              <p className="px-4 py-3 text-[13px] text-sales-text-secondary">
                Sellers didn&apos;t load.{" "}
                <button type="button" onClick={() => { setStatus("idle"); void load(); }} className="font-semibold text-sales-text-primary underline">
                  Try again
                </button>
              </p>
            ) : shown.length === 0 ? (
              <div className="px-4 py-3">
                <p className="text-[13px] text-sales-text-secondary">
                  {needle
                    ? <>No match for &ldquo;{query.trim()}&rdquo; in {scopeInfo.heading.toLowerCase()}.</>
                    : `No ${scopeInfo.heading.toLowerCase()} on file yet.`}
                </p>
                <Link href={sellerHref} onClick={linkClick(sellerHref)} className="mt-1 inline-flex min-h-9 items-center text-[13px] font-semibold text-sales-text-primary underline-offset-2 hover:underline">
                  Onboard them as a new seller
                </Link>
              </div>
            ) : (
              <>
                <p className="px-4 pb-1 pt-3 text-[11px] font-medium uppercase tracking-[0.12em] text-sales-text-muted">{scopeInfo.heading}</p>
                <ul id={listId} role="listbox" aria-label="Matching sellers" className="pb-1">
                  {shown.map((seller, index) => (
                    <li key={seller.id} id={`${listId}-${index}`} role="option" aria-selected={index === active}>
                      <Link
                        href={seller.href}
                        onClick={linkClick(seller.href)}
                        onMouseEnter={() => setActive(index)}
                        className={cn(
                          "flex min-h-11 items-center gap-3 px-4 py-2 transition-colors",
                          index === active ? "bg-sales-surface-hover" : ""
                        )}
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-sales-border-subtle bg-sales-bg text-sales-text-secondary" aria-hidden>
                          <UserRound size={15} strokeWidth={1.75} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-semibold text-sales-text-primary">{seller.name}</span>
                          <span className="block truncate text-[12px] text-sales-text-muted">{seller.detail}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link
                  href={allHref}
                  onClick={linkClick(allHref)}
                  className="flex min-h-11 items-center border-t border-sales-border-subtle px-4 text-[13px] font-semibold text-sales-text-primary transition-colors hover:bg-sales-surface-hover"
                >
                  {matches.length > shown.length ? `See all ${matches.length} matches` : "Open all sellers"}
                </Link>
              </>
            )}
          </div>
        ) : null}
      </div>
      <SellerFilter scope={scope} onPick={pickScope} />
      {view && onViewChange ? <ViewToggle view={view} onChange={onViewChange} className={viewToggleClassName} /> : null}
      </div>

      <OnboardSwitch sellerHref={sellerHref} buyerHref={buyerHref} onClick={linkClick} />
    </div>
  );
}

function SellerFilter({ scope, onPick }: { scope: SellerScope; onPick: (scope: SellerScope) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onDown(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = SCOPES.find((item) => item.id === scope) ?? SCOPES[0];
  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={scope === "all" ? "Filter sellers" : `Filter sellers: ${current.label}`}
        title="Filter sellers"
        onClick={() => setOpen((value) => !value)}
        className={cn(toolBtn, "relative", (open || scope !== "all") && "text-sales-text-primary")}
      >
        <ListFilter size={17} strokeWidth={1.75} aria-hidden />
        {scope !== "all" ? <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-sales-text-primary" aria-hidden /> : null}
      </button>
      {open ? (
        <div id={menuId} role="menu" aria-label="Show sellers" className="absolute right-0 top-[calc(100%+6px)] z-30 w-60 overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface py-1 shadow-sales-dropdown">
          <p className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-[0.12em] text-sales-text-muted">Show sellers</p>
          {SCOPES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitemradio"
              aria-checked={item.id === scope}
              onClick={() => {
                setOpen(false);
                onPick(item.id);
              }}
              className="flex min-h-10 w-full items-center gap-2 px-3 text-left text-[14px] text-sales-text-primary transition-colors hover:bg-sales-surface-hover focus-visible:bg-sales-surface-hover focus-visible:outline-none"
            >
              <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden>
                {item.id === scope ? <Check size={15} strokeWidth={2} /> : null}
              </span>
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ViewToggle({ view, onChange, className }: { view: TodayView; onChange: (view: TodayView) => void; className?: string }) {
  const options: { id: TodayView; label: string; icon: typeof Columns2 }[] = [
    { id: "split", label: "Side by side", icon: Columns2 },
    { id: "stacked", label: "Stacked", icon: Rows2 },
  ];
  return (
    <div role="group" aria-label="Today layout" className={cn("h-11 shrink-0 items-center gap-0.5 rounded-[10px] border border-sales-border bg-sales-surface p-1", className)}>
      {options.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          aria-pressed={view === id}
          aria-label={label}
          title={label}
          onClick={() => onChange(id)}
          className={cn(
            "inline-flex h-[34px] w-[34px] items-center justify-center rounded-[7px] transition-colors focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]",
            view === id ? "bg-sales-surface-hover text-sales-text-primary" : "text-sales-text-muted hover:text-sales-text-primary"
          )}
        >
          <Icon size={16} strokeWidth={1.75} aria-hidden />
        </button>
      ))}
    </div>
  );
}

/** Two people the agent brings in: the seller with the property, the buyer looking for one. */
function OnboardSwitch({
  sellerHref,
  buyerHref,
  onClick,
}: {
  sellerHref: string;
  buyerHref: string;
  onClick: (href: string) => (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Onboard"
      className="ml-auto flex h-11 w-full min-w-0 shrink-0 items-center gap-2 rounded-full border border-sales-border bg-sales-surface pl-1.5 pr-1 sm:w-auto"
    >
      <span className="flex shrink-0 items-center" aria-hidden>
        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-sales-border bg-sales-bg text-sales-text-primary">
          <Home size={14} strokeWidth={1.75} />
        </span>
        <span className="-ml-2 flex h-7 w-7 items-center justify-center rounded-full border border-sales-border bg-sales-bg text-sales-text-primary">
          <KeyRound size={14} strokeWidth={1.75} />
        </span>
      </span>
      <span className="text-[13px] font-semibold text-sales-text-secondary">Onboard</span>
      <span className="ml-auto flex items-center gap-0.5 rounded-full bg-sales-bg p-0.5">
        <Link
          href={sellerHref}
          onClick={onClick(sellerHref)}
          aria-label="Onboard a seller. Sends the seller form."
          className="inline-flex h-8 items-center rounded-full bg-sales-brand px-3.5 text-[13px] font-semibold text-sales-brand-text transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]"
        >
          Seller
        </Link>
        <Link
          href={buyerHref}
          onClick={onClick(buyerHref)}
          aria-label="Onboard a buyer. Opens the viewing form."
          className="inline-flex h-8 items-center rounded-full px-3.5 text-[13px] font-semibold text-sales-text-primary transition-colors hover:bg-sales-surface-hover focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]"
        >
          Buyer
        </Link>
      </span>
    </div>
  );
}
