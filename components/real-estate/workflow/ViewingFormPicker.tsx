"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { PropertyRegisterEntry } from "@/lib/real-estate/property-register";

type Payload = {
  entries: PropertyRegisterEntry[];
  total: number;
  page: number;
  pageSize: number;
  partial: "drafts" | "listings" | "both" | null;
};

type Selected = {
  key: string;
  address: string;
  listingId: string | null;
};

function listingIdOf(entry: PropertyRegisterEntry): string | null {
  return entry.kind === "listing" && entry.key.startsWith("listing:") ? entry.key.slice("listing:".length) : null;
}

function statusOf(entry: PropertyRegisterEntry): string {
  if (entry.kind === "draft") return "In preparation";
  if (entry.inactive) return "Closed";
  return entry.stageLabel;
}

export function ViewingFormPicker({ clientId, backHref }: { clientId: string; backHref: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<Selected | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    const params = new URLSearchParams({ surface: "sales", group: "all", page: String(page), pageSize: "25" });
    if (query.trim()) params.set("q", query.trim());
    try {
      const response = await fetch(`/api/clients/${clientId}/properties/register?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) {
        setFailed(true);
        setPayload(null);
        return;
      }
      setPayload((await response.json()) as Payload);
    } catch {
      setFailed(true);
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [clientId, page, query]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, query.trim() ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [load, query]);

  const entries = payload?.entries ?? [];
  const total = payload?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / (payload?.pageSize || 25)));
  const notice = failed
    ? "Properties could not be loaded."
    : payload?.partial === "both"
      ? "Properties could not be fully loaded."
      : payload?.partial === "drafts"
        ? "Seller opportunities could not be fully loaded. Listings that did load are shown."
        : payload?.partial === "listings"
          ? "Listings could not be fully loaded. Seller opportunities that did load are shown."
          : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-sales-text-muted">Stock</p>
          <h1 className="mt-1 break-words font-display text-[32px] font-semibold leading-none tracking-[-0.03em] text-sales-text-primary">Properties</h1>
          <p className="mt-2 text-[14px] text-sales-text-secondary">Search for the property, then select it. The viewing form is for that address.</p>
        </div>
        <button
          type="button"
          onClick={() => router.push(backHref)}
          className="inline-flex h-11 items-center justify-center rounded-[10px] border border-sales-border bg-sales-surface px-4 text-[14px] font-semibold text-sales-text-primary transition-colors hover:bg-sales-surface-hover focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]"
        >
          Back
        </button>
      </div>

      <label className="block">
        <span className="text-[13px] font-medium text-sales-text-primary">Search properties</span>
        <input
          value={query}
          onChange={(event) => { setQuery(event.target.value); setPage(1); }}
          placeholder="Address or seller"
          className="mt-1.5 h-11 w-full min-w-0 rounded-[10px] border border-sales-border bg-sales-bg px-3 text-[14px] text-sales-text-primary placeholder:text-sales-text-muted focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]"
        />
      </label>

      {selected ? <ViewingFormLink key={selected.key} clientId={clientId} address={selected.address} listingId={selected.listingId} /> : null}

      <section className="overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface" aria-label="Properties">
        <div className="flex items-baseline justify-between px-4 pb-2 pt-4">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-sales-text-primary">Properties</h2>
          {loading && !payload ? null : <span className="text-[13px] tabular-nums text-sales-text-muted">{total}</span>}
        </div>
        {notice ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-sales-border-subtle px-4 py-3">
            <p className="text-[13px] text-sales-text-secondary">{notice}</p>
            <button type="button" onClick={() => void load()} className="h-11 text-[13px] font-semibold text-sales-text-primary underline focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]">
              Retry
            </button>
          </div>
        ) : null}
        {loading && !payload ? (
          <p className="border-t border-sales-border-subtle px-4 py-6 text-[13px] text-sales-text-muted">Loading properties…</p>
        ) : entries.length === 0 ? (
          failed ? null : (
          <div className="border-t border-sales-border-subtle px-4 py-10 text-center">
            <p className="text-[15px] font-semibold text-sales-text-primary">{query.trim() ? "No property matches" : "No properties yet"}</p>
            <p className="mx-auto mt-1 max-w-[36ch] text-[13px] text-sales-text-secondary">
              {query.trim() ? "Try another address or seller name." : "A viewing form needs a property on the register."}
            </p>
          </div>
          )
        ) : (
          <>
            <ul className="min-[480px]:hidden">
              {entries.map((entry) => (
                <PropertyRow key={entry.key} entry={entry} selected={selected?.key === entry.key} onSelect={setSelected} stacked />
              ))}
            </ul>
            <table className="hidden w-full text-left min-[480px]:table">
              <thead>
                <tr className="border-y border-sales-border-subtle text-[12px] text-sales-text-muted">
                  <th className="px-4 py-2 font-medium">Property</th>
                  <th className="px-3 py-2 font-medium">Seller</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium"><span className="sr-only">Action</span></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <PropertyRow key={entry.key} entry={entry} selected={selected?.key === entry.key} onSelect={setSelected} />
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>

      {total > (payload?.pageSize || 25) ? (
        <div className="flex items-center justify-between gap-2">
          <button type="button" className="h-11 px-2 text-[13px] font-semibold text-sales-text-primary disabled:opacity-40 focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
            Previous
          </button>
          <p className="text-[12px] text-sales-text-muted">Page {payload?.page ?? page} of {pageCount}</p>
          <button type="button" className="h-11 px-2 text-[13px] font-semibold text-sales-text-primary disabled:opacity-40 focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)}>
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}

function PropertyRow({
  entry,
  selected,
  stacked = false,
  onSelect,
}: {
  entry: PropertyRegisterEntry;
  selected: boolean;
  stacked?: boolean;
  onSelect: (property: Selected) => void;
}) {
  const listingId = listingIdOf(entry);
  const status = statusOf(entry);
  const person = entry.personLabel;
  const button = (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect({ key: entry.key, address: entry.title, listingId })}
      className={stacked
        ? `mt-3 h-11 w-full rounded-[10px] border text-[14px] font-semibold transition-colors focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)] ${selected ? "border-sales-text-primary bg-sales-surface-active text-sales-text-primary" : "border-sales-border bg-sales-bg text-sales-text-primary hover:bg-sales-surface-hover"}`
        : `h-9 rounded-[8px] border px-3 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)] ${selected ? "border-sales-text-primary bg-sales-surface-active text-sales-text-primary" : "border-sales-border bg-sales-bg text-sales-text-primary hover:bg-sales-surface-hover"}`}
    >
      {selected ? "Selected" : "Create viewing form"}
    </button>
  );

  if (stacked) {
    return (
      <li className="border-t border-sales-border-subtle px-4 py-3">
        <p className="text-[14px] font-semibold text-sales-text-primary">{entry.title}</p>
        <p className="mt-0.5 text-[13px] text-sales-text-secondary">{person ? `${person} · ${status}` : status}</p>
        {button}
      </li>
    );
  }

  return (
    <tr className="border-b border-sales-border-subtle last:border-0">
      <td className="px-4 py-3 text-[14px] font-semibold text-sales-text-primary">{entry.title}</td>
      <td className="px-3 py-3 text-[13px] text-sales-text-secondary">{person ?? "—"}</td>
      <td className="px-3 py-3 text-[13px] text-sales-text-secondary">{status}</td>
      <td className="px-3 py-3 text-right">{button}</td>
    </tr>
  );
}

function ViewingFormLink({ clientId, address, listingId }: { clientId: string; address: string; listingId: string | null }) {
  const [link, setLink] = useState("");
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (!listingId) {
      setError("This property is still in preparation. A viewing form needs a listing.");
      return;
    }
    setError(null);
    setCopied(false);
    setGenerating(true);
    try {
      const response = await fetch(`/api/clients/${clientId}/workflow/viewing-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, slots: [], templateKey: "synthetic-viewing-acknowledgement" }),
      });
      const json = await response.json().catch(() => ({})) as { path?: string; error?: string };
      if (!response.ok || !json.path) {
        setError(json.error ?? "The viewing form was not created.");
        return;
      }
      setLink(`${window.location.origin}${json.path}`);
    } catch {
      setError("The viewing form was not created.");
    } finally {
      setGenerating(false);
    }
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setError(null);
    } catch {
      setCopied(false);
      setError("Select the link and copy it.");
    }
  }

  return (
    <section className="rounded-[12px] border border-sales-border bg-sales-surface px-4 py-4" aria-label="Viewing form">
      <h2 className="font-display text-[22px] font-semibold leading-none tracking-[-0.03em] text-sales-text-primary">Viewing form</h2>
      <p className="mt-2 max-w-[52ch] text-[14px] text-sales-text-secondary">For {address}. The buyer chooses a time and signs. A signed form opens the buyer.</p>
      {listingId ? (
        <button type="button" disabled={generating} onClick={() => void generate()} className="mt-4 inline-flex h-11 items-center justify-center rounded-[10px] bg-sales-brand px-4 text-[14px] font-semibold text-sales-brand-text transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)] disabled:opacity-60">
          {generating ? "Generating" : "Generate link"}
        </button>
      ) : (
        <p className="mt-4 text-[13px] font-medium text-sales-text-secondary">This property is still in preparation. A viewing form is available once it is a listing.</p>
      )}
      {error ? <p className="mt-3 text-[13px] font-medium text-sales-danger-fg">{error}</p> : null}
      {link ? (
        <div className="mt-4 flex flex-col gap-2 border-t border-sales-border-subtle pt-4 sm:flex-row sm:items-center">
          <input
            readOnly
            value={link}
            aria-label="Viewing form link"
            onFocus={(event) => event.currentTarget.select()}
            className="h-11 min-w-0 flex-1 rounded-[10px] border border-sales-border bg-sales-bg px-3 text-[13px] text-sales-text-primary focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]"
          />
          <button type="button" onClick={() => void copy()} className="inline-flex h-11 items-center justify-center rounded-[10px] bg-sales-brand px-4 text-[14px] font-semibold text-sales-brand-text transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]">
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
