"use client";

import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { listingLabel } from "@/lib/real-estate/helpers";
import type { ListingRow } from "@/types";
import { CreateOfferSheet, type CreateOfferPrefill } from "@/components/real-estate/offers/CreateOfferSheet";
import { ListingOffersSection, OfferDetailPanel } from "@/components/real-estate/offers/OfferDetailPanel";
import { ListingMarketingSection } from "@/components/real-estate/marketing/ListingMarketingSection";

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
  const [createPrefill, setCreatePrefill] = useState<CreateOfferPrefill | null>(null);
  const [openOfferId, setOpenOfferId] = useState<string | null>(null);
  const [offersKey, setOffersKey] = useState(0);

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

  if (loading) return <p className="text-[13px] text-sales-text-muted">Loading…</p>;
  if (!listing) return <p className="text-[13px] text-sales-text-muted">Listing not found.</p>;

  return (
    <div className="space-y-3">
      {toast ? (
        <p className="workspace-card rounded-[14px] border border-sales-border bg-sales-surface px-4 py-2 text-[13px] text-sales-text-primary">
          {toast}
        </p>
      ) : null}

      <div className="workspace-card rounded-[14px] border border-sales-border bg-sales-surface p-5">
        <h2 className="text-[22px] font-semibold tracking-[-0.03em] text-sales-text-primary">{listingLabel(listing)}</h2>
        <p className="mt-2 text-[13px] text-sales-text-secondary">
          {[listing.transaction_type, listing.status].join(" · ")}
          {listing.price != null ? ` · $${Number(listing.price).toLocaleString()}` : ""}
          {listing.bedrooms != null ? ` · ${listing.bedrooms} bed` : ""}
          {listing.bathrooms != null ? ` · ${listing.bathrooms} bath` : ""}
          {listing.size_sqm != null ? ` · ${listing.size_sqm} m²` : ""}
        </p>
        {listing.status === "under_offer" ? (
          <p className="mt-2 text-sm font-medium text-amber-800">Under offer</p>
        ) : null}
        {listing.description ? (
          <p className="mt-4 text-[13px] text-sales-text-secondary whitespace-pre-wrap">{listing.description}</p>
        ) : null}
      </div>

      <ListingMarketingSection clientId={clientId} listingId={listingId} />

      <ListingOffersSection
        key={offersKey}
        clientId={clientId}
        listingId={listingId}
        listingStatus={listing.status}
        onCreate={() => setCreatePrefill({ listingId })}
        onOpen={setOpenOfferId}
      />

      <div className="space-y-3">
        <h3 className="text-[16px] font-semibold text-sales-text-primary">Matches</h3>
        <p className="text-[13px] text-sales-text-secondary">
          Contacts whose budget, bedrooms, and area preferences overlap this listing.
        </p>
        {matches.length === 0 ? (
          <p className="text-[13px] text-sales-text-muted">No matching buyers yet.</p>
        ) : (
          matches.map((m) => (
            <div
              key={m.id}
              className="workspace-card flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-sales-border bg-sales-surface p-4"
            >
              <div>
                <p className="font-medium text-sales-text-primary">{m.name || "Unnamed"}</p>
                <p className="text-[13px] text-sales-text-secondary">
                  {[m.phone, m.email].filter(Boolean).join(" · ")}
                </p>
                <p className="mt-1 text-[12px] text-sales-text-muted">
                  Budget{" "}
                  {m.buyer_budget_min != null || m.buyer_budget_max != null
                    ? `${m.buyer_budget_min ?? "—"}–${m.buyer_budget_max ?? "—"}`
                    : "—"}
                  {m.buyer_bedrooms_wanted != null ? ` · ${m.buyer_bedrooms_wanted}+ beds` : ""}
                  {m.buyer_area_preference ? ` · ${m.buyer_area_preference}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-[10px] border border-sales-border px-3 py-1.5 text-[13px] text-sales-text-secondary"
                  onClick={() =>
                    setCreatePrefill({ listingId, contactId: m.id, contactName: m.name })
                  }
                >
                  Create offer
                </button>
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
            </div>
          ))
        )}
      </div>

      {createPrefill ? (
        <CreateOfferSheet
          clientId={clientId}
          prefill={createPrefill}
          onClose={() => setCreatePrefill(null)}
          onCreated={(id) => {
            setCreatePrefill(null);
            setOpenOfferId(id);
            setOffersKey((k) => k + 1);
          }}
        />
      ) : null}

      {openOfferId ? (
        <OfferDetailPanel
          clientId={clientId}
          offerId={openOfferId}
          complianceHref="/client/compliance"
          onClose={() => setOpenOfferId(null)}
          onChanged={() => setOffersKey((k) => k + 1)}
        />
      ) : null}
    </div>
  );
}
