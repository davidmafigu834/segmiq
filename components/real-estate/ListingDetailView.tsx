"use client";

import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { listingLabel } from "@/lib/real-estate/helpers";
import type { ListingRow } from "@/types";

type MatchContact = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  buyer_budget_min: number | null;
  buyer_budget_max: number | null;
  buyer_bedrooms_wanted: number | null;
  buyer_area_preference: string | null;
};

export function ListingDetailView({
  clientId,
  listingId,
}: {
  clientId: string;
  listingId: string;
}) {
  const [listing, setListing] = useState<ListingRow | null>(null);
  const [matches, setMatches] = useState<MatchContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/clients/${clientId}/listings/${listingId}`)
      .then((r) => r.json())
      .then((j: { listing?: ListingRow; matches?: MatchContact[] }) => {
        if (cancelled) return;
        setListing(j.listing ?? null);
        setMatches(j.matches ?? []);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, listingId]);

  async function sendMatch(contactId: string) {
    setSendingId(contactId);
    try {
      const res = await fetch(`/api/clients/${clientId}/listings/${listingId}/send-match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact_id: contactId }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setToast(res.ok ? "Match alert sent" : j.error ?? "Send failed");
    } finally {
      setSendingId(null);
    }
  }

  if (loading) return <p className="text-sm text-ink-tertiary">Loading…</p>;
  if (!listing) return <p className="text-sm text-ink-tertiary">Listing not found.</p>;

  return (
    <div className="space-y-8">
      {toast ? (
        <p className="rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-4 py-2 text-sm">
          {toast}
        </p>
      ) : null}

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5">
        <h2 className="font-display text-3xl">{listingLabel(listing)}</h2>
        <p className="mt-2 text-sm text-ink-secondary">
          {[listing.transaction_type, listing.status].join(" · ")}
          {listing.price != null ? ` · $${Number(listing.price).toLocaleString()}` : ""}
          {listing.bedrooms != null ? ` · ${listing.bedrooms} bed` : ""}
          {listing.bathrooms != null ? ` · ${listing.bathrooms} bath` : ""}
          {listing.size_sqm != null ? ` · ${listing.size_sqm} m²` : ""}
        </p>
        {listing.description ? (
          <p className="mt-4 text-sm text-ink-secondary whitespace-pre-wrap">{listing.description}</p>
        ) : null}
      </div>

      <div className="space-y-3">
        <h3 className="font-display text-2xl">Matches</h3>
        <p className="text-sm text-ink-secondary">
          Contacts whose budget, bedrooms, and area preferences overlap this listing.
        </p>
        {matches.length === 0 ? (
          <p className="text-sm text-ink-tertiary">No matching buyers yet.</p>
        ) : (
          matches.map((m) => (
            <div
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-4"
            >
              <div>
                <p className="font-medium">{m.name || "Unnamed"}</p>
                <p className="text-sm text-ink-secondary">
                  {[m.phone, m.email].filter(Boolean).join(" · ")}
                </p>
                <p className="mt-1 text-xs text-ink-tertiary">
                  Budget{" "}
                  {m.buyer_budget_min != null || m.buyer_budget_max != null
                    ? `${m.buyer_budget_min ?? "—"}–${m.buyer_budget_max ?? "—"}`
                    : "—"}
                  {m.buyer_bedrooms_wanted != null ? ` · ${m.buyer_bedrooms_wanted}+ beds` : ""}
                  {m.buyer_area_preference ? ` · ${m.buyer_area_preference}` : ""}
                </p>
              </div>
              <button
                type="button"
                className="btn-primary inline-flex items-center gap-1.5"
                disabled={!m.phone || sendingId === m.id}
                onClick={() => void sendMatch(m.id)}
              >
                <Send className="h-3.5 w-3.5" />
                {sendingId === m.id ? "Sending…" : "Send"}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
