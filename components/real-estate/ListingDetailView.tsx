"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Phone } from "lucide-react";
import { acqFieldClass, acqLabelClass, formatWhen } from "@/components/real-estate/acquisition/acquisition-ui";
import { MarketThisProperty } from "@/components/real-estate/listing-pages/MarketThisProperty";
import { OfferDetailPanel } from "@/components/real-estate/offers/OfferDetailPanel";
import { ReErrorState, ReSkeletonRows } from "@/components/real-estate/ui";
import { JourneySharePanel } from "@/components/real-estate/workflow/JourneySharePanel";
import { listingLabel } from "@/lib/real-estate/helpers";
import { listingAsksForRooms, listingFinishGaps, type ListingHouseContext } from "@/lib/real-estate/listing-house";
import { LISTING_STATUS_LABEL, LISTING_TYPE_LABEL } from "@/lib/real-estate/listings";
import { PROPERTY_CATEGORY_LABEL } from "@/lib/real-estate/buyer-match";
import { reEmbeddedShell, reSalesShell } from "@/components/real-estate/ui/workspace-shell";
import type { ListingRow, ListingStatus, ListingTransactionType } from "@/types";

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

function usd(value: number | null): string {
  return value == null ? "" : `US$${Number(value).toLocaleString()}`;
}

function dealLabel(type: ListingTransactionType): string {
  if (type === "sale") return "For sale";
  if (type === "rental") return "To rent";
  return LISTING_TYPE_LABEL[type];
}

function marketStatus(status: ListingStatus): string {
  if (status === "available") return "On the market";
  return LISTING_STATUS_LABEL[status];
}

function whatsAppHref(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  const normalized = digits.startsWith("0") ? `263${digits.slice(1)}` : digits;
  return normalized.length >= 9 ? `https://wa.me/${normalized}` : null;
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
  const rootClass = framed ? reEmbeddedShell : reSalesShell;
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

  const seller = house?.seller ?? null;
  const sellerId = seller?.contactId ?? house?.opportunityId ?? null;
  const sellerHref = seller && sellerId ? `${root}/owners/${sellerId}` : null;
  const inspectionHref = house?.opportunityId ? `${root}/acquisitions/${house.opportunityId}#acq-inspection` : null;
  const category = categoryLabel(listing.property_category);
  const place = [listing.suburb, category, dealLabel(listing.transaction_type)].filter(Boolean).join(" · ");
  const statusLine = [
    marketStatus(listing.status),
    usd(listing.price),
    listing.bedrooms != null ? `${listing.bedrooms} bed` : null,
    listing.bathrooms != null ? `${listing.bathrooms} bath` : null,
    listing.size_sqm != null ? `${listing.size_sqm} m²` : null,
  ].filter(Boolean).join(" · ");
  const gaps = listingFinishGaps(listing);
  const phone = seller?.phone ?? null;
  const whatsApp = phone ? whatsAppHref(phone) : null;

  return (
    <div className={rootClass}>
      <header>
        <Link href={`${root}/listings`} className="re-focus inline-flex min-h-11 items-center gap-1.5 text-[13px] font-semibold text-sales-text-secondary">
          <ArrowLeft size={16} strokeWidth={1.8} aria-hidden />
          Properties
        </Link>
        <p className="mt-2 text-[13px] font-medium text-sales-text-muted">{seller?.name || "Seller not linked yet"}</p>
        <h1 className="mt-1 font-display text-[32px] font-semibold leading-none tracking-[-0.03em] text-sales-text-primary [overflow-wrap:anywhere]">{listing.address?.trim() || listingLabel(listing)}</h1>
        {place ? <p className="mt-2 text-[14px] text-sales-text-secondary">{place}</p> : null}
        {statusLine ? <p className="mt-1 text-[13px] text-sales-text-muted">{statusLine}</p> : null}
        {gaps.length ? <p className="mt-2 text-[13px] text-sales-text-secondary">{gaps.join(" ")}</p> : null}
      </header>

      <FinishForm key={listing.updated_at} clientId={clientId} listing={listing} onSaved={() => setReloadKey((value) => value + 1)}>
        <section className="rounded-[12px] border border-sales-border bg-sales-surface px-4 py-4">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Viewing form</h2>
          <div className="mt-3">
            <JourneySharePanel clientId={clientId} listingId={listingId} />
          </div>
        </section>

        <section className="overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface">
          <div className="px-4 pb-2 pt-4">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Seller</h2>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-sales-border-subtle px-4 py-3">
            <div className="min-w-0">
              <p className="text-[14px] font-semibold">{seller?.name || "Seller not linked yet"}</p>
              {phone ? <p className="mt-0.5 text-[13px] text-sales-text-secondary">{phone}</p> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {phone ? <RowLink href={`tel:${phone}`} label="Call" icon /> : null}
              {whatsApp ? <RowLink href={whatsApp} label="WhatsApp" external /> : null}
              {sellerHref ? <RowLink href={sellerHref} label="Open seller" /> : null}
              {inspectionHref ? <RowLink href={inspectionHref} label="Open inspection" /> : null}
            </div>
          </div>
        </section>

        <OffersSection offers={offers} buyersRoot={`${root}/buyers`} onOpen={setOpenOfferId} />
        <ViewingsSection viewings={viewings} buyersRoot={`${root}/buyers`} />
      </FinishForm>

      <MarketThisProperty
        clientId={clientId}
        listingId={listingId}
        analyticsBase={surface === "sales" ? "/sales/shared-listings" : "/client/listing-pages"}
        presentation="record"
      />

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

function RowLink({ href, label, icon = false, external = false }: { href: string; label: string; icon?: boolean; external?: boolean }) {
  const className = "inline-flex h-11 items-center gap-2 rounded-[8px] border border-sales-border bg-sales-bg px-3 text-[13px] font-semibold transition-colors hover:bg-sales-surface-hover min-[480px]:h-9";
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {label}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {icon ? <Phone size={16} strokeWidth={1.75} aria-hidden /> : null}
      {label}
    </Link>
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

function ShownPhoto({
  clientId,
  listingId,
  src,
  serverIndex,
  preview,
  className,
}: {
  clientId: string;
  listingId: string;
  src: string;
  serverIndex: number;
  preview?: string;
  className: string;
}) {
  const direct = photoSrc(src) ?? preview ?? null;
  const [signed, setSigned] = useState<string | null>(direct);
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
  if (!signed) {
    return (
      <div className={`${className} grid place-items-center bg-sales-surface-subtle text-[12px] text-sales-text-muted`}>
        {failed ? "Photo unavailable" : ""}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={signed} alt="" className={className} />
  );
}

const MAX_LISTING_PHOTOS = 50;

type PhotoUpload = {
  id: string;
  file: File;
  preview: string;
  state: "waiting" | "uploading" | "failed";
  progress: number;
  error?: string;
};

/** XHR rather than fetch so the tray can show upload progress for each photograph. */
function sendListingPhoto(url: string, upload: PhotoUpload, onProgress: (fraction: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", url);
    request.responseType = "json";
    request.setRequestHeader("Idempotency-Key", upload.id);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    request.onload = () => {
      const json = (request.response ?? {}) as { error?: string; image?: { key?: unknown } };
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(json.error ?? "The photo could not be stored."));
      } else if (typeof json.image?.key !== "string") {
        reject(new Error("The photo was stored. Reload this page to see it."));
      } else {
        resolve(json.image.key);
      }
    };
    request.onerror = () => reject(new Error("The connection dropped before the photo was stored."));
    const body = new FormData();
    body.set("file", upload.file);
    request.send(body);
  });
}

function UploadTile({
  upload,
  onRetry,
  onDismiss,
}: {
  upload: PhotoUpload;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  const percent = Math.round(upload.progress * 100);
  return (
    <div className="min-w-0">
      <div className="relative overflow-hidden rounded-[8px] border-2 border-sales-border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={upload.preview}
          alt=""
          className={`aspect-[16/10] w-full object-cover ${upload.state === "uploading" ? "" : "opacity-60"}`}
        />
        {upload.state === "uploading" ? (
          <>
            <div className="absolute inset-0 grid place-items-center bg-black/35 text-white">
              <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold tabular-nums">
                <Loader2 size={14} className="motion-safe:animate-spin" aria-hidden />
                {percent < 100 ? `${percent}%` : "Saving"}
              </span>
            </div>
            <div className="absolute inset-x-0 bottom-0 h-1 bg-black/30">
              <div className="h-full bg-white transition-[width] duration-200" style={{ width: `${percent}%` }} />
            </div>
          </>
        ) : null}
        {upload.state === "waiting" ? (
          <span className="absolute bottom-1.5 left-1.5 rounded-[6px] bg-sales-surface px-1.5 py-0.5 text-[11px] font-semibold text-sales-text-secondary">
            Waiting
          </span>
        ) : null}
        {upload.state === "failed" ? (
          <div className="absolute inset-0 flex items-end justify-between gap-1 bg-black/45 p-1.5">
            <button type="button" onClick={onRetry} className="h-8 rounded-[6px] bg-sales-surface px-2 text-[12px] font-semibold text-sales-text-primary">
              Retry
            </button>
            <button type="button" onClick={onDismiss} className="h-8 rounded-[6px] px-2 text-[12px] font-semibold text-white">
              Remove
            </button>
          </div>
        ) : null}
      </div>
      {upload.state === "failed" && upload.error ? (
        <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-sales-danger-fg">{upload.error}</p>
      ) : null}
    </div>
  );
}

function FinishForm({
  clientId,
  listing,
  onSaved,
  children,
}: {
  clientId: string;
  listing: ListingDetail;
  onSaved: () => void;
  children: ReactNode;
}) {
  const editable = Boolean(listing.permittedActions?.edit);
  const askRooms = listingAsksForRooms(listing.property_category);
  const initialPhotos = Array.isArray(listing.photos) ? listing.photos.filter((value): value is string => typeof value === "string") : [];
  const [photos, setPhotos] = useState<string[]>(initialPhotos);
  const [savedPhotos, setSavedPhotos] = useState<string[]>(initialPhotos);
  const photosRef = useRef(photos);
  photosRef.current = photos;
  const removeChain = useRef(Promise.resolve());
  const [photo, setPhoto] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [uploads, setUploads] = useState<PhotoUpload[]>([]);
  const uploadsRef = useRef<PhotoUpload[]>([]);
  const uploadRunning = useRef(false);
  const [batchDone, setBatchDone] = useState(0);
  const previews = useRef(new Map<string, string>());
  const index = photos.length ? Math.min(photo, photos.length - 1) : 0;
  const queued = uploads.filter((item) => item.state !== "failed");
  const failedCount = uploads.length - queued.length;
  const uploading = queued.length > 0;
  const batchTotal = batchDone + queued.length;
  const batchFraction = batchTotal
    ? (batchDone + (queued.find((item) => item.state === "uploading")?.progress ?? 0)) / batchTotal
    : 0;

  useEffect(() => {
    const stored = previews.current;
    return () => {
      uploadsRef.current.forEach((item) => URL.revokeObjectURL(item.preview));
      stored.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  async function save(form: HTMLFormElement) {
    setBusy(true);
    setNotice(null);
    const data = new FormData(form);
    const body: Record<string, unknown> = {
      address: String(data.get("address") ?? "").trim() || null,
      suburb: String(data.get("suburb") ?? "").trim() || null,
      price: data.get("price") ? Number(data.get("price")) : null,
      size_sqm: data.get("size_sqm") ? Number(data.get("size_sqm")) : null,
      description: String(data.get("description") ?? "").trim() || null,
      photos: photosRef.current,
    };
    if (askRooms) {
      body.bedrooms = data.get("bedrooms") ? Number(data.get("bedrooms")) : null;
      body.bathrooms = data.get("bathrooms") ? Number(data.get("bathrooms")) : null;
    }
    try {
      const response = await fetch(`/api/clients/${clientId}/listings/${listing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "The listing could not be saved.");
      onSaved();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The listing could not be saved.");
      setBusy(false);
    }
  }

  function removePhoto(src: string) {
    const next = photosRef.current.filter((item) => item !== src);
    photosRef.current = next;
    setPhotos(next);
    setNotice(null);
    removeChain.current = removeChain.current.then(async () => {
      setBusy(true);
      try {
        const response = await fetch(`/api/clients/${clientId}/listings/${listing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photos: photosRef.current }),
        });
        const json = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) throw new Error(json.error ?? "The photo could not be removed.");
        setSavedPhotos(photosRef.current);
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "The photo could not be removed.");
        onSaved();
      } finally {
        setBusy(false);
      }
    });
  }

  function setUploadList(next: PhotoUpload[]) {
    uploadsRef.current = next;
    setUploads(next);
  }

  function patchUpload(id: string, patch: Partial<PhotoUpload>) {
    setUploadList(uploadsRef.current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function addPhotos(files: File[]) {
    if (!files.length) return;
    setNotice(null);
    const room = Math.max(0, MAX_LISTING_PHOTOS - photosRef.current.length - uploadsRef.current.length);
    if (!room) {
      setNotice(`A listing can have up to ${MAX_LISTING_PHOTOS} photographs.`);
      return;
    }
    if (files.length > room) setNotice(`Only ${room} more photograph${room === 1 ? "" : "s"} fit on this listing.`);
    const added: PhotoUpload[] = files.slice(0, room).map((file) => ({
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
      state: "waiting",
      progress: 0,
    }));
    if (!uploadsRef.current.some((item) => item.state !== "failed")) setBatchDone(0);
    setUploadList([...uploadsRef.current, ...added]);
    void runUploads();
  }

  // One photograph at a time: the server appends to the listing's photo list, so parallel posts would race.
  async function runUploads() {
    if (uploadRunning.current) return;
    uploadRunning.current = true;
    try {
      for (;;) {
        const next = uploadsRef.current.find((item) => item.state === "waiting");
        if (!next) break;
        patchUpload(next.id, { state: "uploading", progress: 0, error: undefined });
        try {
          const key = await sendListingPhoto(
            `/api/clients/${clientId}/listings/${listing.id}/images`,
            next,
            (progress) => patchUpload(next.id, { progress })
          );
          previews.current.set(key, next.preview);
          if (!photosRef.current.includes(key)) {
            const nextPhotos = [...photosRef.current, key];
            photosRef.current = nextPhotos;
            setPhotos(nextPhotos);
          }
          setSavedPhotos((current) => (current.includes(key) ? current : [...current, key]));
          setUploadList(uploadsRef.current.filter((item) => item.id !== next.id));
          setBatchDone((count) => count + 1);
        } catch (error) {
          patchUpload(next.id, {
            state: "failed",
            error: error instanceof Error ? error.message : "The photo could not be stored.",
          });
        }
      }
    } finally {
      uploadRunning.current = false;
    }
  }

  function retryUpload(id: string) {
    if (!uploadsRef.current.some((item) => item.state !== "failed")) setBatchDone(0);
    patchUpload(id, { state: "waiting", progress: 0, error: undefined });
    void runUploads();
  }

  function dismissUpload(id: string) {
    const item = uploadsRef.current.find((upload) => upload.id === id);
    if (item) URL.revokeObjectURL(item.preview);
    setUploadList(uploadsRef.current.filter((upload) => upload.id !== id));
  }

  const current = photos[index];

  return (
    <>
      <section>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Photographs</h2>
          <div className="flex items-center gap-3">
            {photos.length ? <p className="text-[13px] tabular-nums text-sales-text-muted">{index + 1} / {photos.length}</p> : null}
            {editable ? (
              <label className="inline-flex h-9 cursor-pointer items-center text-[13px] font-semibold text-sales-text-secondary">
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
                    void addPhotos(files);
                  }}
                />
              </label>
            ) : null}
          </div>
        </div>
        {uploads.length ? (
          <div className="mt-3 rounded-[12px] border border-sales-border bg-sales-surface p-3">
            <div className="flex items-baseline justify-between gap-3" aria-live="polite">
              <p className="text-[13px] font-semibold">
                {uploading
                  ? `Uploading photo ${Math.min(batchDone + 1, batchTotal)} of ${batchTotal}`
                  : `${failedCount} photo${failedCount === 1 ? "" : "s"} did not upload`}
              </p>
              {uploading ? (
                <p className="text-[12px] tabular-nums text-sales-text-muted">{Math.round(batchFraction * 100)}%</p>
              ) : null}
            </div>
            {uploading ? (
              <div
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-sales-surface-subtle"
                role="progressbar"
                aria-label="Photo upload progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(batchFraction * 100)}
              >
                <div className="h-full rounded-full bg-sales-brand transition-[width] duration-200" style={{ width: `${batchFraction * 100}%` }} />
              </div>
            ) : null}
            <div className="mt-3 grid grid-cols-3 gap-2">
              {uploads.map((upload) => (
                <UploadTile
                  key={upload.id}
                  upload={upload}
                  onRetry={() => retryUpload(upload.id)}
                  onDismiss={() => dismissUpload(upload.id)}
                />
              ))}
            </div>
          </div>
        ) : null}
        {current ? (
          <>
            <div className="relative mt-3 overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface">
              <ShownPhoto key={current} clientId={clientId} listingId={listing.id} src={current} serverIndex={savedPhotos.indexOf(current)} preview={previews.current.get(current)} className="aspect-[16/10] w-full object-cover" />
              {photos.length > 1 ? (
                <div className="absolute bottom-3 right-3 hidden gap-2 min-[480px]:flex">
                  <button type="button" aria-label="Previous photograph" onClick={() => setPhoto((value) => (value + photos.length - 1) % photos.length)} className="h-9 rounded-[8px] border border-sales-border bg-sales-surface px-3 text-[13px] font-semibold">Previous</button>
                  <button type="button" aria-label="Next photograph" onClick={() => setPhoto((value) => (value + 1) % photos.length)} className="h-9 rounded-[8px] border border-sales-border bg-sales-surface px-3 text-[13px] font-semibold">Next</button>
                </div>
              ) : null}
            </div>
            {photos.length > 1 ? (
              <div className="mt-2 flex gap-2 min-[480px]:hidden">
                <button type="button" aria-label="Previous photograph" onClick={() => setPhoto((value) => (value + photos.length - 1) % photos.length)} className="h-11 flex-1 rounded-[8px] border border-sales-border bg-sales-surface px-3 text-[13px] font-semibold">Previous</button>
                <button type="button" aria-label="Next photograph" onClick={() => setPhoto((value) => (value + 1) % photos.length)} className="h-11 flex-1 rounded-[8px] border border-sales-border bg-sales-surface px-3 text-[13px] font-semibold">Next</button>
              </div>
            ) : null}
            <div className="mt-2 grid grid-cols-3 gap-2">
              {photos.map((src, itemIndex) => (
                <button key={`${src}-${itemIndex}`} type="button" aria-label={`Photograph ${itemIndex + 1}`} aria-current={itemIndex === index ? "true" : undefined} onClick={() => setPhoto(itemIndex)} className={`overflow-hidden rounded-[8px] border-2 ${itemIndex === index ? "border-sales-text-primary" : "border-sales-border"}`}>
                  <ShownPhoto clientId={clientId} listingId={listing.id} src={src} serverIndex={savedPhotos.indexOf(src)} preview={previews.current.get(src)} className="aspect-[16/10] w-full object-cover" />
                </button>
              ))}
            </div>
            {editable ? (
              <button type="button" className="mt-2 min-h-11 text-[13px] font-semibold text-sales-text-secondary" disabled={busy || uploading} onClick={() => removePhoto(current)}>
                Remove this photograph
              </button>
            ) : null}
          </>
        ) : uploads.length ? null : <p className="mt-3 text-[13px] text-sales-text-muted">No photographs yet. They appear here and on the viewing form.</p>}
        {notice ? <p className="mt-2 text-[13px] text-sales-danger-fg" role="alert">{notice}</p> : null}
      </section>

      {children}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!editable || busy || uploading) return;
          void save(event.currentTarget);
        }}
      >
        <section className="overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface">
          <div className="px-4 pb-2 pt-4">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Property</h2>
          </div>
          <div className="grid gap-3 border-t border-sales-border-subtle px-4 py-3 sm:grid-cols-2">
            <label className="sm:col-span-2" htmlFor="description">
              <span className={acqLabelClass}>Description</span>
              <textarea id="description" name="description" rows={4} defaultValue={listing.description ?? ""} disabled={!editable} className={acqFieldClass} />
            </label>
            <Field label="Address" name="address"><input id="address" name="address" defaultValue={listing.address ?? ""} disabled={!editable} className={acqFieldClass} /></Field>
            <Field label="Suburb" name="suburb"><input id="suburb" name="suburb" defaultValue={listing.suburb ?? ""} disabled={!editable} className={acqFieldClass} /></Field>
            <Field label="Type" name="type"><input id="type" value={categoryLabel(listing.property_category) ?? dealLabel(listing.transaction_type)} readOnly className={acqFieldClass} /></Field>
            <Field label="Asking price" name="price"><input id="price" name="price" type="number" inputMode="decimal" min="0" step="0.01" defaultValue={money(listing.price)} disabled={!editable} className={acqFieldClass} /></Field>
            {askRooms ? (
              <>
                <Field label="Bedrooms" name="bedrooms"><input id="bedrooms" name="bedrooms" type="number" inputMode="numeric" min="0" defaultValue={money(listing.bedrooms)} disabled={!editable} className={acqFieldClass} /></Field>
                <Field label="Bathrooms" name="bathrooms"><input id="bathrooms" name="bathrooms" type="number" inputMode="numeric" min="0" defaultValue={money(listing.bathrooms)} disabled={!editable} className={acqFieldClass} /></Field>
              </>
            ) : null}
            <Field label="Size (m²)" name="size_sqm"><input id="size_sqm" name="size_sqm" type="number" inputMode="decimal" min="0" step="0.01" defaultValue={money(listing.size_sqm)} disabled={!editable} className={acqFieldClass} /></Field>
          </div>
          {editable ? <div className="border-t border-sales-border-subtle px-4 py-3"><button type="submit" disabled={busy || uploading} className="inline-flex h-11 items-center rounded-[10px] bg-sales-brand px-4 text-[14px] font-semibold text-sales-brand-text disabled:opacity-60">{busy ? "Saving" : uploading ? "Uploading photos" : "Save listing"}</button></div> : null}
        </section>
      </form>
    </>
  );
}

function ViewingsSection({ viewings, buyersRoot }: { viewings: ViewingRow[]; buyersRoot: string }) {
  return (
    <section className="overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface">
      <div className="flex items-baseline justify-between px-4 pb-2 pt-4">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Viewings</h2>
        <span className="text-[13px] text-sales-text-muted">{viewings.length}</span>
      </div>
      {viewings.length ? (
        viewings.map((viewing) => {
          const name = viewing.contact?.name?.trim() || "Buyer";
          const href = viewing.buyer_search_id ? `${buyersRoot}/${viewing.buyer_search_id}` : null;
          return (
            <div key={viewing.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-sales-border-subtle px-4 py-3">
              <div className="min-w-0">
                {href ? <Link href={href} className="text-[14px] font-semibold">{name}</Link> : <p className="text-[14px] font-semibold">{name}</p>}
                <p className="mt-0.5 text-[13px] text-sales-text-secondary">{formatWhen(viewing.scheduled_at) ?? "Time not recorded"}</p>
              </div>
            </div>
          );
        })
      ) : <p className="border-t border-sales-border-subtle px-4 py-3 text-[13px] text-sales-text-muted">No viewing has been signed for this house yet.</p>}
    </section>
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
    <section className="overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface">
      <div className="flex items-baseline justify-between px-4 pb-2 pt-4">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Offers</h2>
        <span className="text-[13px] text-sales-text-muted">{offers.length}</span>
      </div>
      {offers.length ? (
        offers.map((offer) => {
          const href = offer.buyerSearchId ? `${buyersRoot}/${offer.buyerSearchId}` : null;
          return (
            <div key={offer.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-sales-border-subtle px-4 py-3">
              <div className="min-w-0">
                {href ? <Link href={href} className="text-[14px] font-semibold">{offer.buyerName || "Buyer"}</Link> : <p className="text-[14px] font-semibold">{offer.buyerName || "Buyer"}</p>}
                <p className="mt-0.5 text-[13px] text-sales-text-secondary">{offer.currentAmountLabel} · {offer.sellerLetter || "The letter has not been sent to the seller"}</p>
              </div>
              <button type="button" className="h-11 shrink-0 rounded-[8px] bg-sales-text-primary px-3 text-[13px] font-semibold text-sales-surface min-[480px]:h-9" onClick={() => onOpen(offer.id)}>
                Open offer
              </button>
            </div>
          );
        })
      ) : <p className="border-t border-sales-border-subtle px-4 py-3 text-[13px] text-sales-text-muted">No offers on this house yet.</p>}
    </section>
  );
}
