"use client";

import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { asPropertyCategory, PROPERTY_CATEGORY_LABEL } from "@/lib/real-estate/buyer-match";
import { listingLabel } from "@/lib/real-estate/helpers";
import { LISTING_APPROVAL_LABEL, LISTING_STATUS_LABEL, LISTING_TYPE_LABEL } from "@/lib/real-estate/listings";
import type { ListingRow } from "@/types";
import { CreateOfferSheet, type CreateOfferPrefill } from "@/components/real-estate/offers/CreateOfferSheet";
import { ListingOffersSection, OfferDetailPanel } from "@/components/real-estate/offers/OfferDetailPanel";
import { ListingMarketingSection } from "@/components/real-estate/marketing/ListingMarketingSection";
import { MarketThisProperty } from "@/components/real-estate/listing-pages/MarketThisProperty";
import { ContextCompliancePanel } from "@/components/real-estate/compliance/ContextCompliancePanel";
import { PropertyFileLinks } from "@/components/real-estate/properties/PropertyFileLinks";
import { JourneySharePanel } from "@/components/real-estate/workflow/JourneySharePanel";

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
  analyticsBase = "/client/listing-pages",
  surface = "client",
}: {
  clientId: string;
  listingId: string;
  analyticsBase?: string;
  surface?: "sales" | "client";
}) {
  const [listing, setListing] = useState<ListingRow | null>(null);
  const [matches, setMatches] = useState<MatchContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [createPrefill, setCreatePrefill] = useState<CreateOfferPrefill | null>(null);
  const [openOfferId, setOpenOfferId] = useState<string | null>(null);
  const [offersKey, setOffersKey] = useState(0);
  const [photo, setPhoto] = useState(0);

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

  if (loading) return <p className="text-[13px] text-sales-text-muted">Loading the property…</p>;
  if (!listing) return <p className="text-[13px] text-sales-text-muted">This property could not be opened.</p>;

  const photos = (listing.photos ?? []).filter((src) => typeof src === "string" && src.length > 0);
  const currentPhoto = photos[photo] ?? photos[0];
  const category = asPropertyCategory(listing.property_category);
  const place = [listing.suburb].filter(Boolean).join(", ");
  const deal = listing.transaction_type === "sale" ? "For sale" : listing.transaction_type === "rental" ? "To rent" : LISTING_TYPE_LABEL[listing.transaction_type];
  const statusLabel = listing.status === "available" ? "On the market" : LISTING_STATUS_LABEL[listing.status];
  const facts: Array<[string, string]> = [
    ["Address", listingLabel(listing)],
    ["Type", category ? PROPERTY_CATEGORY_LABEL[category] : deal],
    ["Bedrooms", listing.bedrooms != null ? String(listing.bedrooms) : ""],
    ["Bathrooms", listing.bathrooms != null ? String(listing.bathrooms) : ""],
    ["Size", listing.size_sqm != null ? `${listing.size_sqm} m²` : ""],
    ["Asking price", listing.price != null ? `US$${Number(listing.price).toLocaleString()}` : ""],
  ].filter((item): item is [string, string] => item[1].length > 0);

  return (
    <div className="space-y-5">
      {toast ? (
        <p className="rounded-[12px] border border-sales-border bg-sales-surface px-4 py-2 text-[13px] text-sales-text-primary">
          {toast}
        </p>
      ) : null}

      <header>
        <h1 className="font-display text-[32px] font-semibold leading-none tracking-[-0.03em] text-sales-text-primary">{listing.address?.trim() || listingLabel(listing)}</h1>
        <p className="mt-2 text-[14px] text-sales-text-secondary">{[place, category ? PROPERTY_CATEGORY_LABEL[category] : null, deal].filter(Boolean).join(" · ")}</p>
        <p className="mt-1 text-[13px] text-sales-text-muted">
          {[
            statusLabel,
            listing.approval_status && listing.approval_status !== "approved" ? LISTING_APPROVAL_LABEL[listing.approval_status] : null,
            listing.price != null ? `US$${Number(listing.price).toLocaleString()}` : null,
            listing.bedrooms != null ? `${listing.bedrooms} bed` : null,
            listing.bathrooms != null ? `${listing.bathrooms} bath` : null,
            listing.size_sqm != null ? `${listing.size_sqm} m²` : null,
          ].filter(Boolean).join(" · ")}
        </p>
        {listing.approval_status === "pending_approval" ? (
          <button
            type="button"
            className="mt-3 inline-flex h-10 items-center rounded-[10px] bg-sales-brand px-4 text-[13px] font-semibold text-sales-brand-text"
            onClick={async () => {
              const res = await fetch(`/api/clients/${clientId}/listings/${listingId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ approval_status: "approved" }),
              });
              if (!res.ok) {
                const j = (await res.json().catch(() => ({}))) as { error?: string };
                setToast(j.error ?? "Approval failed");
                return;
              }
              const j = (await res.json()) as { listing?: ListingRow };
              if (j.listing) setListing(j.listing);
              setToast("Listing approved");
            }}
          >
            Approve listing
          </button>
        ) : null}
      </header>

      {currentPhoto ? (
        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Photographs</h2>
            <p className="text-[13px] tabular-nums text-sales-text-muted">{Math.min(photo + 1, photos.length)} / {photos.length}</p>
          </div>
          <div className="relative mt-3 overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface">
            <img src={currentPhoto} alt="" className="aspect-[16/10] w-full object-cover" />
            {photos.length > 1 ? (
              <div className="absolute bottom-3 right-3 flex gap-2">
                <button type="button" aria-label="Previous photograph" onClick={() => setPhoto((value) => (value + photos.length - 1) % photos.length)} className="h-9 rounded-[8px] border border-sales-border bg-sales-surface px-3 text-[13px] font-semibold">Previous</button>
                <button type="button" aria-label="Next photograph" onClick={() => setPhoto((value) => (value + 1) % photos.length)} className="h-9 rounded-[8px] border border-sales-border bg-sales-surface px-3 text-[13px] font-semibold">Next</button>
              </div>
            ) : null}
          </div>
          {photos.length > 1 ? (
            <div className="mt-2 grid grid-cols-3 gap-2">
              {photos.map((src, index) => (
                <button key={`${src}-${index}`} type="button" aria-label={`Photograph ${index + 1}`} aria-current={index === photo ? "true" : undefined} onClick={() => setPhoto(index)} className={`overflow-hidden rounded-[8px] border-2 ${index === photo ? "border-sales-text-primary" : "border-sales-border"}`}>
                  <img src={src} alt="" className="aspect-[16/10] w-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <JourneySharePanel clientId={clientId} listingId={listingId} />

      <PropertyFileLinks clientId={clientId} surface={surface} listingId={listingId} />

      <div id="property-offers" className="rounded-[12px] border border-sales-border bg-sales-surface px-4 py-4">
      <ListingOffersSection
        key={offersKey}
        clientId={clientId}
        listingId={listingId}
        listingStatus={listing.status}
        onCreate={() => setCreatePrefill({ listingId })}
        onOpen={setOpenOfferId}
      />
      </div>

      <section className="overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface">
        <div className="px-4 pb-2 pt-4">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Property</h2>
          {listing.description ? <p className="mt-2 text-[14px] leading-relaxed text-sales-text-secondary whitespace-pre-wrap">{listing.description}</p> : null}
        </div>
        <dl className="grid gap-x-6 gap-y-3 border-t border-sales-border-subtle px-4 py-3 sm:grid-cols-2">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt className="text-[12px] text-sales-text-muted">{label}</dt>
              <dd className="text-[14px] font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="border-t border-sales-border-subtle px-4 py-3">
          <ContextCompliancePanel clientId={clientId} context="property" title="Documents" listingId={listingId} />
        </div>
      </section>

      <section className="overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface">
        <div className="flex items-baseline justify-between px-4 pb-2 pt-4">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Buyers</h2>
          <span className="text-[13px] text-sales-text-muted">{matches.length}</span>
        </div>
        {matches.length === 0 ? (
          <p className="border-t border-sales-border-subtle px-4 py-3 text-[13px] text-sales-text-muted">No matching buyers yet.</p>
        ) : matches.map((m) => (
            <div
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-3 border-t border-sales-border-subtle px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-sales-text-primary">{m.name || "Unnamed"}</p>
                <p className="mt-0.5 text-[13px] text-sales-text-secondary">
                  {[
                    m.phone,
                    m.buyer_budget_min != null || m.buyer_budget_max != null ? `Budget ${m.buyer_budget_min ?? "—"}–${m.buyer_budget_max ?? "—"}` : null,
                    m.buyer_bedrooms_wanted != null ? `${m.buyer_bedrooms_wanted}+ beds` : null,
                    m.buyer_area_preference,
                  ].filter(Boolean).join(" · ")}
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
      </section>

      <MarketThisProperty clientId={clientId} listingId={listingId} analyticsBase={analyticsBase} presentation="record" />
      <ListingMarketingSection clientId={clientId} listingId={listingId} />

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
