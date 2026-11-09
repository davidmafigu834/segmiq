"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { acqFieldClass, acqLabelClass, formatWhen } from "@/components/real-estate/acquisition/acquisition-ui";
import { OfferDetailPanel } from "@/components/real-estate/offers/OfferDetailPanel";
import { ReErrorState, ReSection, ReSheet, ReSkeletonRows, ReStatusBadge } from "@/components/real-estate/ui";
import { JourneySharePanel } from "@/components/real-estate/workflow/JourneySharePanel";
import { salesMenuTriggerClass } from "@/components/sales/ui/Button";
import { listingLabel } from "@/lib/real-estate/helpers";
import { listingAsksForRooms, listingFinishGaps, type ListingHouseContext } from "@/lib/real-estate/listing-house";
import { LISTING_STATUS_LABEL, LISTING_TYPE_LABEL } from "@/lib/real-estate/listings";
import { PROPERTY_CATEGORY_LABEL } from "@/lib/real-estate/buyer-match";
import { cn } from "@/lib/ui/cn";
import { reEmbeddedShell, reSalesShell } from "@/components/real-estate/ui/workspace-shell";
import type { ListingRow } from "@/types";

type OfferRow = {
  id: string;
  buyerName: string | null;
  buyerSearchId?: string | null;
  currentAmountLabel: string;
  sellerLetter?: string;
};

type ListingDetail = ListingRow & { permittedActions?: { edit?: boolean } };
type ViewingRow = {
  id: string;
  scheduled_at?: string | null;
  buyer_search_id?: string | null;
  contact?: { name?: string | null } | null;
};
const shellClass = reSalesShell;

function categoryLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return (PROPERTY_CATEGORY_LABEL as Record<string, string>)[value] ?? null;
}

function photoSrc(value: string): string | null {
  if (value.startsWith("https://") || value.startsWith("http://") || value.startsWith("/")) return value;
  return null;
}

function money(value: number | null): string {
  return value == null ? "" : String(value);
}

export function ListingDetailView({
  clientId,
  listingId,
  surface = "client",
  framed = false,
}: {
  clientId: string;
  listingId: string;
  surface?: "sales" | "client";
  framed?: boolean;
}) {
  const root = surface === "sales" ? "/sales" : "/client";
  const rootClass = framed ? reEmbeddedShell : shellClass;
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [house, setHouse] = useState<ListingHouseContext | null>(null);
  const [viewings, setViewings] = useState<ViewingRow[]>([]);
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openOfferId, setOpenOfferId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [listingRes, viewingRes, offerRes] = await Promise.all([
        fetch(`/api/clients/${clientId}/listings/${listingId}`, { cache: "no-store" }),
        fetch(`/api/clients/${clientId}/viewings?listing_id=${encodeURIComponent(listingId)}`, { cache: "no-store" }),
        fetch(`/api/clients/${clientId}/offers?listing_id=${encodeURIComponent(listingId)}&tab=all`, { cache: "no-store" }),
      ]);
      const listingJson = await listingRes.json().catch(() => ({}));
      const viewingJson = await viewingRes.json().catch(() => ({}));
      const offerJson = await offerRes.json().catch(() => ({}));
      if (cancelled) return;
      if (!listingRes.ok || !listingJson.listing) {
        setListing(null);
        setError(listingJson.error ?? "This listing didn't load");
        setLoading(false);
        return;
      }
      setListing(listingJson.listing as ListingDetail);
      setHouse((listingJson.house as ListingHouseContext | undefined) ?? { seller: null, opportunityId: null });
      setViewings(viewingRes.ok ? ((viewingJson.viewings as ViewingRow[] | undefined) ?? []) : []);
      setOffers(offerRes.ok ? ((offerJson.offers as OfferRow[] | undefined) ?? []) : []);
      setError(null);
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [clientId, listingId, reloadKey]);

  const opportunityId = house?.opportunityId ?? null;

  if (loading) {
    return (
      <div className={rootClass}>
        <ReSkeletonRows rows={6} label="Loading this listing" />
      </div>
    );
  }
  if (!listing) {
    return (
      <div className={rootClass}>
        <ReErrorState title="This listing didn't load" description={error ?? "Try again."} onRetry={() => setReloadKey((value) => value + 1)} />
      </div>
    );
  }

  const title = listingLabel(listing);
  const gaps = listingFinishGaps(listing);
  const seller = house?.seller ?? null;
  const sellerId = seller?.contactId ?? opportunityId;
  const sellerHref = seller && sellerId ? `${root}/owners/${sellerId}` : null;
  const inspectionHref = opportunityId ? `${root}/acquisitions/${opportunityId}#acq-inspection` : null;
  const facts = [
    LISTING_TYPE_LABEL[listing.transaction_type],
    LISTING_STATUS_LABEL[listing.status],
    categoryLabel(listing.property_category),
    listing.price != null ? `$${Number(listing.price).toLocaleString()}` : null,
    listing.bedrooms != null ? `${listing.bedrooms} bed` : null,
    listing.bathrooms != null ? `${listing.bathrooms} bath` : null,
    listing.size_sqm != null ? `${listing.size_sqm} m²` : null,
  ].filter(Boolean);

  return (
    <div className={rootClass}>
      <div>
        <Link href={`${root}/listings`} className="re-focus inline-flex min-h-11 items-center gap-1.5 text-[13px] font-semibold text-sales-text-secondary">
          <ArrowLeft size={16} strokeWidth={1.8} aria-hidden />
          Listings
        </Link>
        <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-[24px] font-semibold leading-[1.15] tracking-[-0.02em] text-sales-text-primary [overflow-wrap:anywhere] layout:text-[28px]">{title}</h1>
            <p className="mt-2 text-[13px] text-sales-text-secondary">{facts.join(" · ")}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <ReStatusBadge label={gaps.length ? "Still to finish" : "Ready"} tone={gaps.length ? "warning" : "success"} />
              {sellerHref ? <Link href={sellerHref} className="re-focus text-[13px] font-semibold text-sales-text-secondary">{seller?.name || "Seller"}</Link> : <span className="text-[13px] text-sales-text-muted">{seller?.name || "Seller not linked yet"}</span>}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {sellerHref ? <Link href={sellerHref} className={cn(salesMenuTriggerClass({ variant: "secondary", size: "md" }), "min-h-11")}>Open seller</Link> : null}
            {inspectionHref ? <Link href={inspectionHref} className={cn(salesMenuTriggerClass({ variant: "secondary", size: "md" }), "min-h-11")}>Open inspection</Link> : null}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-[var(--re-section-gap,16px)] layout:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-[var(--re-section-gap,16px)] layout:col-span-8">
          <FinishForm
            key={listing.updated_at}
            clientId={clientId}
            listing={listing}
            onSaved={() => setReloadKey((value) => value + 1)}
          />
          <ViewingsSection viewings={viewings} buyersRoot={`${root}/buyers`} />
          <OffersSection offers={offers} buyersRoot={`${root}/buyers`} onOpen={setOpenOfferId} />
        </div>
        <aside className="flex min-w-0 flex-col gap-[var(--re-section-gap,16px)] layout:col-span-4">
          <ReSection id="listing-gaps" title="Still to add">
            {gaps.length ? (
              <ul className="space-y-1.5 text-[13px] text-sales-text-secondary">
                {gaps.map((item) => <li key={item}>{item}</li>)}
              </ul>
            ) : (
              <p className="text-[13px] text-sales-text-secondary">The details and photos are on the listing.</p>
            )}
            {!listing.permittedActions?.edit ? <p className="mt-3 text-[13px] text-sales-text-muted">A manager can still change a published listing.</p> : null}
          </ReSection>
          <ReSection id="listing-viewing-form" title="Viewing form">
            <JourneySharePanel clientId={clientId} listingId={listingId} />
          </ReSection>
        </aside>
      </div>

      {openOfferId ? (
        <OfferDetailPanel
          clientId={clientId}
          offerId={openOfferId}
          complianceHref={`${root}/compliance`}
          onClose={() => setOpenOfferId(null)}
          onChanged={() => setReloadKey((value) => value + 1)}
        />
      ) : null}
    </div>
  );
}

function Field({ label, name, children }: { label: string; name: string; children: ReactNode }) {
  return (
    <label htmlFor={name}>
      <span className={acqLabelClass}>{label}</span>
      {children}
    </label>
  );
}

function ListingPhotoTile({
  clientId,
  listingId,
  src,
  serverIndex,
  onOpen,
}: {
  clientId: string;
  listingId: string;
  src: string;
  serverIndex: number;
  onOpen: (src: string) => void;
}) {
  const direct = photoSrc(src);
  const [signed, setSigned] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (direct || serverIndex < 0) return;
    let cancelled = false;
    fetch(`/api/clients/${clientId}/listings/${listingId}/images/${serverIndex}`, { cache: "no-store" })
      .then(async (response) => {
        const json = (await response.json().catch(() => ({}))) as { url?: string };
        if (cancelled) return;
        if (response.ok && json.url) setSigned(json.url);
        else setFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, listingId, serverIndex, direct]);
  const shown = direct ?? signed;
  if (!shown) {
    return <p className="rounded-[10px] border border-sales-border-subtle px-2 py-3 text-[12px] text-sales-text-muted">{failed || serverIndex < 0 ? "Photo unavailable" : "Loading photo"}</p>;
  }
  return (
    <button type="button" className="re-focus block w-full overflow-hidden rounded-[10px] border border-sales-border-subtle" onClick={() => onOpen(shown)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={shown} alt="" className="aspect-[4/3] w-full object-cover" />
    </button>
  );
}

function FinishForm({
  clientId,
  listing,
  onSaved,
}: {
  clientId: string;
  listing: ListingDetail;
  onSaved: () => void;
}) {
  const editable = Boolean(listing.permittedActions?.edit);
  const askRooms = listingAsksForRooms(listing.property_category);
  const [photos, setPhotos] = useState<string[]>(Array.isArray(listing.photos) ? listing.photos : []);
  const [pending, setPending] = useState<Array<{ id: string; file: File; previewUrl: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ src: string; caption: string } | null>(null);
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  useEffect(() => () => {
    pendingRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
  }, []);

  async function save(form: HTMLFormElement) {
    setBusy(true);
    setNotice(null);
    const data = new FormData(form);
    let nextPhotos = photos;
    const storedIds: string[] = [];
    const alreadySaved = new Set((Array.isArray(listing.photos) ? listing.photos : []).filter((value): value is string => typeof value === "string"));
    try {
      for (const item of pending) {
        const body = new FormData();
        body.set("file", item.file);
        const uploaded = await fetch(`/api/clients/${clientId}/listings/${listing.id}/images`, { method: "POST", body });
        const uploadedJson = (await uploaded.json().catch(() => ({}))) as { error?: string; listing?: { photos?: unknown } };
        if (!uploaded.ok) throw new Error(uploadedJson.error ?? "The photo could not be stored.");
        const serverPhotos = Array.isArray(uploadedJson.listing?.photos)
          ? uploadedJson.listing.photos.filter((value): value is string => typeof value === "string")
          : [];
        const fresh = serverPhotos.filter((value) => !alreadySaved.has(value));
        if (!fresh.length) throw new Error("The photo was stored. Reload this page to see it.");
        fresh.forEach((value) => alreadySaved.add(value));
        nextPhotos = [...nextPhotos, ...fresh];
        storedIds.push(item.id);
      }
      const body: Record<string, unknown> = {
        address: String(data.get("address") ?? "").trim() || null,
        suburb: String(data.get("suburb") ?? "").trim() || null,
        price: data.get("price") ? Number(data.get("price")) : null,
        size_sqm: data.get("size_sqm") ? Number(data.get("size_sqm")) : null,
        description: String(data.get("description") ?? "").trim() || null,
        photos: nextPhotos,
      };
      if (askRooms) {
        body.bedrooms = data.get("bedrooms") ? Number(data.get("bedrooms")) : null;
        body.bathrooms = data.get("bathrooms") ? Number(data.get("bathrooms")) : null;
      }
      const response = await fetch(`/api/clients/${clientId}/listings/${listing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "The listing could not be saved.");
      onSaved();
    } catch (error) {
      if (storedIds.length) {
        setPhotos(nextPhotos);
        setPending((current) => {
          current.filter((item) => storedIds.includes(item.id)).forEach((item) => URL.revokeObjectURL(item.previewUrl));
          return current.filter((item) => !storedIds.includes(item.id));
        });
      }
      setNotice(error instanceof Error ? error.message : "The listing could not be saved.");
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!editable || busy) return;
        void save(event.currentTarget);
      }}
    >
      <ReSection id="listing-details" title="Listing details" description="These came from the seller's mandate. Add the description, photos, and anything the form left blank.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Address" name="address"><input id="address" name="address" defaultValue={listing.address ?? ""} disabled={!editable} className={acqFieldClass} /></Field>
          <Field label="Suburb" name="suburb"><input id="suburb" name="suburb" defaultValue={listing.suburb ?? ""} disabled={!editable} className={acqFieldClass} /></Field>
          <Field label="Price" name="price"><input id="price" name="price" type="number" inputMode="decimal" min="0" step="0.01" defaultValue={money(listing.price)} disabled={!editable} className={acqFieldClass} /></Field>
          <Field label="Size (m²)" name="size_sqm"><input id="size_sqm" name="size_sqm" type="number" inputMode="decimal" min="0" step="0.01" defaultValue={money(listing.size_sqm)} disabled={!editable} className={acqFieldClass} /></Field>
          {askRooms ? (
            <>
              <Field label="Bedrooms" name="bedrooms"><input id="bedrooms" name="bedrooms" type="number" inputMode="numeric" min="0" defaultValue={money(listing.bedrooms)} disabled={!editable} className={acqFieldClass} /></Field>
              <Field label="Bathrooms" name="bathrooms"><input id="bathrooms" name="bathrooms" type="number" inputMode="numeric" min="0" defaultValue={money(listing.bathrooms)} disabled={!editable} className={acqFieldClass} /></Field>
            </>
          ) : null}
          <label className="sm:col-span-2" htmlFor="description">
            <span className={acqLabelClass}>Description</span>
            <textarea id="description" name="description" rows={4} defaultValue={listing.description ?? ""} disabled={!editable} className={acqFieldClass} />
          </label>
        </div>

        <div className="mt-4 border-t border-sales-border-subtle pt-4">
          <h3 className="text-[14px] font-semibold">Photos</h3>
          <p className="mt-1 text-[13px] text-sales-text-secondary">Photographs from the inspection and photographs added here are one set. They appear on the viewing form.</p>
          {photos.length || pending.length ? (
            <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {photos.map((src, index) => {
                const saved = Array.isArray(listing.photos) ? listing.photos : [];
                return (
                  <li key={`${src}-${index}`} className="min-w-0">
                    <ListingPhotoTile
                      clientId={clientId}
                      listingId={listing.id}
                      src={src}
                      serverIndex={saved.indexOf(src)}
                      onOpen={(shown) => setPreview({ src: shown, caption: "Listing photo" })}
                    />
                    {editable ? <button type="button" className="mt-1 min-h-11 text-[12px] font-semibold text-sales-text-secondary" onClick={() => setPhotos((current) => current.filter((item) => item !== src))}>Remove</button> : null}
                  </li>
                );
              })}
              {pending.map((item) => (
                <li key={item.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.previewUrl} alt="" className="aspect-[4/3] w-full rounded-[10px] object-cover" />
                  <button type="button" className="mt-1 min-h-11 text-[12px] font-semibold text-sales-text-secondary" onClick={() => {
                    URL.revokeObjectURL(item.previewUrl);
                    setPending((current) => current.filter((photo) => photo.id !== item.id));
                  }}>Remove</button>
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-[13px] text-sales-text-muted">No photos yet.</p>}
          {editable ? (
            <label className="mt-3 inline-flex min-h-11 cursor-pointer items-center rounded-[var(--re-radius-control,8px)] border border-sales-border px-3 text-[14px] font-semibold">
              Add photos
              <input
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                multiple
                disabled={busy}
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  event.target.value = "";
                  setPending((current) => [...current, ...files.map((file) => ({ id: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file) }))]);
                }}
              />
            </label>
          ) : null}
        </div>

        {editable ? <button type="submit" disabled={busy} className="mt-4 min-h-11 rounded-[var(--re-radius-control,8px)] border border-sales-border px-3 text-[14px] font-semibold">{busy ? "Saving…" : "Save listing"}</button> : null}
        {notice ? <p className="mt-2 text-[13px] text-sales-danger-fg" role="alert">{notice}</p> : null}
      </ReSection>
      {preview ? (
        <ReSheet title={preview.caption} onClose={() => setPreview(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview.src} alt={preview.caption} className="max-h-[70vh] w-full object-contain" />
        </ReSheet>
      ) : null}
    </form>
  );
}

function ViewingsSection({ viewings, buyersRoot }: { viewings: ViewingRow[]; buyersRoot: string }) {
  return (
    <ReSection id="listing-viewings" title="Viewings" count={viewings.length} description="Signed viewing forms for this house.">
      {viewings.length ? (
        <ul className="divide-y divide-sales-border-subtle">
          {viewings.map((viewing) => {
            const name = viewing.contact?.name?.trim() || "Buyer";
            const href = viewing.buyer_search_id ? `${buyersRoot}/${viewing.buyer_search_id}` : null;
            return (
              <li key={viewing.id} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                {href ? <Link href={href} className="re-focus font-semibold">{name}</Link> : <span className="font-semibold">{name}</span>}
                <span className="text-sales-text-muted">{formatWhen(viewing.scheduled_at) ?? "Time not recorded"}</span>
              </li>
            );
          })}
        </ul>
      ) : <p className="text-[13px] text-sales-text-muted">No viewing has been signed for this house yet.</p>}
    </ReSection>
  );
}

function OffersSection({
  offers,
  buyersRoot,
  onOpen,
}: {
  offers: OfferRow[];
  buyersRoot: string;
  onOpen: (id: string) => void;
}) {
  return (
    <ReSection id="property-offers" title="Offers" count={offers.length} description="Letters already raised for this house. A new letter is created on the buyer after a viewing.">
      {offers.length ? (
        <ul className="space-y-2">
          {offers.map((offer) => {
            const href = offer.buyerSearchId ? `${buyersRoot}/${offer.buyerSearchId}` : null;
            return (
              <li key={offer.id} className="flex items-center justify-between gap-3 rounded-[10px] border border-sales-border-subtle px-3 py-2">
                <div className="min-w-0">
                  {href ? <Link href={href} className="re-focus truncate text-[13px] font-semibold">{offer.buyerName || "Buyer"}</Link> : <p className="truncate text-[13px] font-semibold">{offer.buyerName || "Buyer"}</p>}
                  <p className="text-[12px] text-sales-text-secondary">{offer.currentAmountLabel} · {offer.sellerLetter || "The letter has not been sent to the seller"}</p>
                </div>
                <button type="button" className="min-h-11 shrink-0 text-[13px] font-semibold" onClick={() => onOpen(offer.id)}>Open offer</button>
              </li>
            );
          })}
        </ul>
      ) : <p className="text-[13px] text-sales-text-muted">No offers on this house yet.</p>}
    </ReSection>
  );
}
