"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, Inbox, Users, Building2, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { UserRole } from "@/types";
import { PLATFORM_COMMAND_PAGES } from "@/components/platform/nav";

type SearchResult = {
  type: "lead" | "client" | "user";
  id: string;
  title: string;
  subtitle: string;
  meta?: string;
  href: string;
};

export function GlobalSearch({
  role,
  placeholder,
}: {
  role: UserRole;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
        setQuery("");
        setResults([]);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const t = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
          const data = (await res.json()) as { results?: SearchResult[] };
          setResults(data.results ?? []);
          setActiveIndex(0);
        } finally {
          setLoading(false);
        }
      })();
    }, 200);
    return () => window.clearTimeout(t);
  }, [query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults([]);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const list = role === "SUPER_ADMIN" ? results.filter((r) => r.type !== "lead") : results;
      const actions = role === "SUPER_ADMIN" && !query.trim() ? PLATFORM_COMMAND_PAGES : [];
      const max = query.trim() ? list.length : actions.length;
      if (!max) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, max - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (!query.trim() && actions[activeIndex]) {
          router.push(actions[activeIndex].href);
          close();
          return;
        }
        if (list[activeIndex]) {
          router.push(list[activeIndex].href);
          close();
        }
      }
    },
    [activeIndex, close, query, results, role, router]
  );

  const isPlatform = role === "SUPER_ADMIN";
  const visibleResults = isPlatform ? results.filter((r) => r.type !== "lead") : results;
  const grouped = groupResults(visibleResults, isPlatform);
  const pageMatches = isPlatform
    ? PLATFORM_COMMAND_PAGES.filter((p) => {
        if (!query.trim()) return true;
        const q = query.trim().toLowerCase();
        return p.label.toLowerCase().includes(q) || p.hint.toLowerCase().includes(q);
      })
    : [];

  function openSearch() {
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  return (
    <>
      <div className="inline-flex shrink-0 items-center">
        <button
          type="button"
          onClick={openSearch}
          className="sd-search-trigger hidden h-10 w-[220px] shrink-0 items-center gap-2.5 rounded-[10px] border border-sales-border bg-sales-surface px-3 text-left text-[13px] text-sales-text-muted transition-colors hover:border-sales-border-strong xl:w-[260px] lg:inline-flex"
        >
          <Search className="h-4 w-4 shrink-0" strokeWidth={1.5} />
          <span className="min-w-0 flex-1 truncate">
            {placeholder ??
              (role === "SALESPERSON" || role === "CLIENT_MANAGER"
                ? "Search leads, deals, customers, quotes..."
                : "Search…")}
          </span>
          <kbd className="hidden shrink-0 rounded-[4px] border border-sales-border bg-sales-surface-subtle px-1.5 py-0.5 font-mono text-[10px] text-sales-text-muted sm:inline-block">
            ⌘K
          </kbd>
        </button>
        <button
          type="button"
          onClick={openSearch}
          className="sd-search-trigger inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-sales-border bg-sales-surface text-sales-text-secondary transition-colors hover:bg-sales-surface-hover lg:hidden"
          aria-label="Search"
        >
          <Search className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-[70] flex flex-col bg-black/40 md:flex-row md:items-start md:justify-center md:pt-24"
          ref={containerRef}
        >
          <div className="flex h-full w-full max-w-none flex-col overflow-hidden border-border bg-surface-card shadow-2xl md:mx-4 md:h-auto md:max-h-[min(90vh,720px)] md:max-w-[90vw] md:w-[640px] md:rounded-xl md:border">
            <div className="flex shrink-0 items-center gap-3 border-b border-border px-5 py-4">
              <Search className="h-4 w-4 shrink-0 text-ink-tertiary" strokeWidth={1.5} />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  placeholder ??
                  (role === "SALESPERSON"
                    ? "Search leads, deals, customers, quotes..."
                    : role === "CLIENT_MANAGER"
                      ? "Search leads and team…"
                      : role === "SUPER_ADMIN"
                        ? "Search organisations, users, IDs..."
                        : "Search leads, clients, and team…")
                }
                className="min-w-0 flex-1 border-0 bg-transparent text-base text-ink-primary outline-none placeholder:text-ink-tertiary"
              />
              {query ? (
                <button
                  type="button"
                  className="text-ink-tertiary hover:text-ink-primary"
                  onClick={() => {
                    setQuery("");
                    inputRef.current?.focus();
                  }}
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" strokeWidth={1.5} />
                </button>
              ) : null}
              <kbd className="hidden shrink-0 rounded-md border border-border bg-surface-card-alt px-2 py-1 font-mono text-xs text-ink-tertiary sm:inline-block">
                ESC
              </kbd>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {!query ? (
                isPlatform ? (
                  <div className="py-2">
                    <div className="px-5 py-2 text-[11px] font-medium uppercase tracking-[0.06em] text-ink-tertiary">
                      Quick actions
                    </div>
                    {pageMatches.map((page, index) => (
                      <Link
                        key={page.href}
                        href={page.href}
                        onClick={() => close()}
                        onMouseEnter={() => setActiveIndex(index)}
                        className={[
                          "flex items-center gap-3 px-5 py-2.5",
                          index === activeIndex ? "bg-surface-card-alt" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-ink-tertiary" strokeWidth={1.5} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-ink-primary">{page.label}</div>
                          <div className="truncate text-xs text-ink-tertiary">{page.hint}</div>
                        </div>
                      </Link>
                    ))}
                    <div className="mt-2 flex flex-wrap items-center gap-4 px-5 pb-4 text-[11px] text-ink-tertiary">
                      <span>
                        <kbd className="font-mono">↑↓</kbd> navigate
                      </span>
                      <span>
                        <kbd className="font-mono">↵</kbd> select
                      </span>
                      <span>
                        <kbd className="font-mono">esc</kbd> close
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 text-center text-sm text-ink-tertiary">
                    {role === "SALESPERSON"
                      ? "Type to search your assigned leads."
                      : role === "CLIENT_MANAGER"
                        ? "Type to search leads and salespeople for your business."
                        : "Type to search across leads, clients, and team members."}
                    <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-xs">
                      <span>
                        <kbd className="font-mono">↑↓</kbd> navigate
                      </span>
                      <span>
                        <kbd className="font-mono">↵</kbd> select
                      </span>
                      <span>
                        <kbd className="font-mono">esc</kbd> close
                      </span>
                    </div>
                  </div>
                )
              ) : null}

              {query && loading ? (
                <div className="p-6 text-center text-sm text-ink-tertiary">Searching…</div>
              ) : null}

              {query && !loading && visibleResults.length === 0 && pageMatches.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="text-sm text-ink-secondary">No results for &quot;{query}&quot;</div>
                  {isPlatform ? (
                    <p className="mt-1 text-xs text-ink-tertiary">
                      Try another organisation name, ID or administrator.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {query && isPlatform && pageMatches.length > 0 ? (
                <div>
                  <div className="bg-surface-card-alt px-5 py-2 text-[11px] font-medium text-ink-tertiary">
                    Pages
                  </div>
                  {pageMatches.map((page) => (
                    <Link
                      key={page.href}
                      href={page.href}
                      onClick={() => close()}
                      className="flex items-center gap-3 border-b border-border px-5 py-3 last:border-b-0"
                    >
                      <ArrowRight className="h-4 w-4 shrink-0 text-ink-tertiary" strokeWidth={1.5} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-ink-primary">{page.label}</div>
                        <div className="truncate text-xs text-ink-tertiary">{page.hint}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : null}

              {grouped.map((group) => (
                <div key={group.type}>
                  <div className="bg-surface-card-alt px-5 py-2 text-[11px] font-medium text-ink-tertiary">
                    {group.label}
                  </div>
                  {group.items.map((item) => {
                    const globalIndex = results.indexOf(item);
                    const isActive = globalIndex === activeIndex;
                    return (
                      <Link
                        key={`${item.type}-${item.id}`}
                        href={item.href}
                        onClick={() => close()}
                        onMouseEnter={() => setActiveIndex(globalIndex)}
                        className={[
                          "flex items-center gap-3 border-b border-border px-5 py-3 last:border-b-0",
                          isActive ? "bg-surface-card-alt" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <GroupIcon type={item.type} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-ink-primary">{item.title}</div>
                          <div className="truncate text-xs text-ink-tertiary">{item.subtitle}</div>
                        </div>
                        {item.meta ? <div className="shrink-0 text-xs text-ink-tertiary">{item.meta}</div> : null}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function groupResults(results: SearchResult[], platform = false) {
  const groups: Record<string, SearchResult[]> = { lead: [], client: [], user: [] };
  for (const r of results) groups[r.type].push(r);
  return [
    { type: "lead" as const, label: "Leads", items: groups.lead },
    { type: "client" as const, label: platform ? "Organisations" : "Clients", items: groups.client },
    { type: "user" as const, label: platform ? "Users" : "Team", items: groups.user },
  ].filter((g) => g.items.length > 0);
}

function GroupIcon({ type }: { type: string }) {
  const className = "h-4 w-4 shrink-0 text-ink-tertiary";
  if (type === "lead") return <Inbox className={className} strokeWidth={1.5} />;
  if (type === "client") return <Building2 className={className} strokeWidth={1.5} />;
  return <Users className={className} strokeWidth={1.5} />;
}
