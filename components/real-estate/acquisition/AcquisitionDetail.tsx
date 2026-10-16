"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ACQUISITION_STAGES, PRICE_TYPES, STAGE_LABEL } from "@/lib/real-estate/acquisition-plan";
import { PROPERTY_CATEGORIES, PROPERTY_CATEGORY_LABEL } from "@/lib/real-estate/buyer-match";
import { MandateActions, uploadEvidence } from "./MandateActions";

type Bundle = {
  opportunity: Record<string, unknown>;
  contact: { id: string; name: string | null; phone: string | null; email: string | null } | null;
  events: Array<Record<string, unknown>>;
  inspections: Array<Record<string, unknown>>;
  photos: Array<Record<string, unknown>>;
  prices: Array<Record<string, unknown>>;
  mandates: Array<Record<string, unknown>>;
};

const fieldClass =
  "min-h-11 w-full rounded-md border border-sales-border bg-sales-surface px-3 text-sm text-sales-text-primary";

export function AcquisitionDetail({
  clientId,
  opportunityId,
  basePath,
  ownersPath,
  canReview,
}: {
  clientId: string;
  opportunityId: string;
  basePath: string;
  ownersPath: string;
  canReview: boolean;
}) {
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [priceType, setPriceType] = useState<string>(PRICE_TYPES[0]);

  async function load() {
    const res = await fetch(`/api/clients/${clientId}/acquisitions/${opportunityId}`, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) setError(json.error ?? "Could not load");
    else {
      setBundle(json);
      setError(null);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, opportunityId]);

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/clients/${clientId}/acquisitions/${opportunityId}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Action failed");
      return json;
    }
    if (json.listingId) {
      window.location.href = basePath.includes("/sales") ? `/sales/listings` : `/client/listings/${json.listingId}`;
      return json;
    }
    await load();
    return json;
  }

  if (!bundle && !error) return <p className="px-4 py-6 text-sm text-sales-text-muted">Loading opportunity…</p>;
  if (!bundle) return <p className="px-4 py-6 text-sm text-red-600">{error}</p>;
  const opp = bundle.opportunity;
  const phone = bundle.contact?.phone || (opp.owner_phone as string | null);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-4">
      <Link href={basePath} className="text-xs text-sales-text-secondary">Back to opportunities</Link>
      <div>
        <h1 className="text-xl font-semibold text-sales-text-primary">{(opp.owner_name as string) || bundle.contact?.name || "Property opportunity"}</h1>
        <p className="text-sm text-sales-text-secondary">
          {(opp.suburb as string) || "Location pending"} · {String(opp.property_intent)} · {STAGE_LABEL[opp.stage as keyof typeof STAGE_LABEL] ?? String(opp.stage)}
        </p>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <section className="rounded-md border border-sales-border-subtle p-3">
        <h2 className="text-sm font-medium">Owner</h2>
        <p className="text-sm text-sales-text-primary">{bundle.contact?.name || (opp.owner_name as string) || "Not linked"}</p>
        {phone ? (
          <p className="mt-1 flex gap-3 text-sm">
            <a className="underline" href={`tel:${phone}`}>Call</a>
            <a className="underline" href={`https://wa.me/${phone.replace(/\D/g, "")}`}>WhatsApp</a>
          </p>
        ) : <p className="text-xs text-sales-text-muted">No phone yet</p>}
        {bundle.contact ? <Link className="text-xs underline" href={`${ownersPath}?contactId=${bundle.contact.id}`}>Owner portfolio</Link> : null}
      </section>

      <section className="rounded-md border border-sales-border-subtle p-3">
        <h2 className="mb-2 text-sm font-medium">Stage</h2>
        <div className="flex flex-wrap gap-2">
          {ACQUISITION_STAGES.map((stage) => (
            <button key={stage} type="button" disabled={busy} className="min-h-11 rounded-md border border-sales-border px-2 text-xs" onClick={() => void act({ action: "stage", stage })}>
              {STAGE_LABEL[stage]}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="min-h-11 text-xs underline" onClick={() => void act({ action: "contact", note: "Owner contacted" })}>Record contact</button>
          <button type="button" className="min-h-11 text-xs underline" onClick={() => {
            const reason = window.prompt("Why is this opportunity lost?");
            if (reason?.trim()) void act({ action: "outcome", status: "lost", reason });
          }}>Mark lost</button>
          <button type="button" className="min-h-11 text-xs underline" onClick={() => void act({ action: "outcome", status: "on_hold", reason: "Paused" })}>Hold</button>
          <button type="button" className="min-h-11 text-xs underline" onClick={() => void act({ action: "outcome", status: "active" })}>Reopen</button>
        </div>
      </section>

      <form className="rounded-md border border-sales-border-subtle p-3" onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        void act({
          action: "inspection",
          inspection: {
            status: form.get("status"),
            scheduled_at: form.get("scheduled_at") || null,
            property_type: form.get("property_type") || null,
            ...(form.get("property_category") ? { property_category: form.get("property_category") } : {}),
            address: form.get("address") || null,
            suburb: form.get("suburb") || null,
            city: form.get("city") || null,
            bedrooms: form.get("bedrooms") ? Number(form.get("bedrooms")) : null,
            bathrooms: form.get("bathrooms") ? Number(form.get("bathrooms")) : null,
            notes: form.get("notes") || null,
            utilities: { water: form.get("water") || null, electricity: form.get("electricity") || null },
            condition: { general: form.get("condition") || null },
            documentation: { title_deeds: form.get("title") || "not_provided" },
          },
        });
      }}>
        <h2 className="mb-2 text-sm font-medium">Inspection</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <select name="status" className={fieldClass} defaultValue="scheduled">
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="incomplete">Incomplete</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <input name="scheduled_at" type="datetime-local" className={fieldClass} />
          <select name="property_category" className={fieldClass} defaultValue={(opp.property_category as string) ?? ""} aria-label="Property type">
            <option value="">Property type not set</option>
            {PROPERTY_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {PROPERTY_CATEGORY_LABEL[category]}
              </option>
            ))}
          </select>
          <input name="property_type" className={fieldClass} placeholder="Other property details" />
          <input name="suburb" className={fieldClass} placeholder="Suburb" defaultValue={(opp.suburb as string) ?? ""} />
          <input name="city" className={fieldClass} placeholder="City" />
          <input name="address" className={fieldClass} placeholder="Address" />
          <input name="bedrooms" type="number" className={fieldClass} placeholder="Bedrooms" />
          <input name="bathrooms" type="number" className={fieldClass} placeholder="Bathrooms" />
          <input name="water" className={fieldClass} placeholder="Water supply" />
          <input name="electricity" className={fieldClass} placeholder="Electricity" />
          <input name="condition" className={fieldClass} placeholder="General condition" />
          <select name="title" className={fieldClass} defaultValue="not_provided">
            <option value="not_provided">Title deeds not provided</option>
            <option value="reported">Reported by owner</option>
            <option value="provided">Provided</option>
            <option value="under_review">Under review</option>
          </select>
          <textarea name="notes" className={`${fieldClass} sm:col-span-2`} rows={3} placeholder="Observations and open questions" />
        </div>
        <button type="submit" disabled={busy} className="mt-2 min-h-11 rounded-md border border-sales-border px-3 text-sm">Save inspection</button>
        <ul className="mt-2 space-y-1 text-xs text-sales-text-secondary">
          {bundle.inspections.map((item) => <li key={String(item.id)}>{String(item.status)} {item.scheduled_at ? `· ${new Date(String(item.scheduled_at)).toLocaleString()}` : ""}</li>)}
        </ul>
        {bundle.inspections[0] ? (
          <label className="mt-2 block text-xs">
            Add photo
            <input className="mt-1 block text-sm" type="file" accept="image/*" capture="environment" onChange={(event) => {
              const file = event.target.files?.[0];
              const inspectionId = String(bundle.inspections[0]?.id ?? "");
              if (!file || !inspectionId) return;
              void (async () => {
                const presign = await fetch(`/api/clients/${clientId}/company-documents/presign`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ filename: file.name, contentType: file.type || "image/jpeg", sizeBytes: file.size, title: file.name }),
                });
                const json = await presign.json();
                if (!presign.ok) {
                  setError(json.error ?? "Photo upload is not available");
                  return;
                }
                const put = await fetch(json.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type || "image/jpeg" }, body: file });
                if (!put.ok) {
                  setError("The photo could not be stored.");
                  return;
                }
                await act({ action: "photo", inspectionId, documentId: json.documentId, caption: file.name });
              })();
            }} />
          </label>
        ) : null}
        <ul className="mt-2 text-xs text-sales-text-muted">
          {bundle.photos.map((photo) => <li key={String(photo.id)}>{String(photo.caption || "Photo")}</li>)}
        </ul>
      </form>

      <form className="rounded-md border border-sales-border-subtle p-3" onSubmit={(event) => {
        event.preventDefault();
        const formEl = event.currentTarget;
        const form = new FormData(formEl);
        void (async () => {
          const file = form.get("evidence");
          let documentId: string | null = null;
          if (file instanceof File && file.size > 0) {
            const uploaded = await uploadEvidence(clientId, file);
            if (!uploaded.ok) {
              setError(uploaded.error);
              return;
            }
            documentId = uploaded.documentId;
          }
          const json = await act({
            action: "price",
            amount: Number(form.get("amount")),
            priceType: form.get("priceType"),
            note: form.get("note") || null,
            currency: "USD",
            documentId,
            verificationReference: String(form.get("verificationReference") ?? "").trim() || null,
          });
          if (!json?.error) formEl.reset();
        })();
      }}>
        <h2 className="mb-2 text-sm font-medium">Pricing history</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          <input name="amount" type="number" step="0.01" min="0" required className={fieldClass} placeholder="Amount" />
          <select name="priceType" className={fieldClass} value={priceType} onChange={(event) => setPriceType(event.target.value)}>
            {PRICE_TYPES.map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}
          </select>
          <input name="note" className={fieldClass} placeholder="Note" />
        </div>
        {priceType === "professional_valuation" ? (
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label className="text-xs">
              Valuation report
              <input name="evidence" type="file" accept=".pdf,image/*" className="mt-1 block text-sm" />
            </label>
            <label className="text-xs">
              Or valuer reference
              <input name="verificationReference" className={`${fieldClass} mt-1`} placeholder="Valuer and report number" />
            </label>
            <p className="text-xs text-sales-text-muted sm:col-span-2">A professional valuation needs the report or a reference that can be checked.</p>
          </div>
        ) : null}
        <button type="submit" disabled={busy} className="mt-2 min-h-11 rounded-md border border-sales-border px-3 text-sm">Record price</button>
        <ul className="mt-2 space-y-1 text-xs">
          {bundle.prices.map((price) => (
            <li key={String(price.id)}>
              {String(price.price_type).replaceAll("_", " ")} · {String(price.currency)} {String(price.amount)} · {new Date(String(price.recorded_at)).toLocaleDateString()}
              {price.price_type === "professional_valuation"
                ? price.document_id || price.verification_reference
                  ? ` · evidence ${price.verification_reference ? String(price.verification_reference) : "attached"}`
                  : " · no evidence recorded"
                : ""}
            </li>
          ))}
        </ul>
      </form>

      <form className="rounded-md border border-sales-border-subtle p-3" onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        void (async () => {
          const file = form.get("evidence");
          let documentId: string | null = null;
          if (file instanceof File && file.size > 0) {
            const uploaded = await uploadEvidence(clientId, file);
            if (!uploaded.ok) {
              setError(uploaded.error);
              return;
            }
            documentId = uploaded.documentId;
          }
          await act({
            action: "mandate",
            mandateType: form.get("mandateType"),
            startDate: form.get("startDate") || null,
            expiryDate: form.get("expiryDate") || null,
            documentId,
            submit: form.get("submit") === "on",
          });
        })();
      }}>
        <h2 className="mb-2 text-sm font-medium">Mandate</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          <select name="mandateType" className={fieldClass} defaultValue="sole">
            <option value="sole">Sole</option>
            <option value="joint">Joint</option>
            <option value="open">Open</option>
          </select>
          <input name="startDate" type="date" aria-label="Start date" className={fieldClass} />
          <input name="expiryDate" type="date" aria-label="Expiry date" className={fieldClass} />
        </div>
        <label className="mt-2 block text-xs">
          Signed mandate
          <input name="evidence" type="file" accept=".pdf,image/*" className="mt-1 block text-sm" />
        </label>
        <label className="mt-2 flex items-center gap-2 text-xs"><input name="submit" type="checkbox" /> Submit for manager review</label>
        <button type="submit" disabled={busy} className="mt-2 min-h-11 rounded-md border border-sales-border px-3 text-sm">Save mandate</button>
      </form>
      {bundle.mandates.length ? (
        <ul className="space-y-3 rounded-md border border-sales-border-subtle p-3 text-xs">
          {bundle.mandates.map((mandate) => (
            <li key={String(mandate.id)} className="space-y-1">
              <p>
                {String(mandate.status).replaceAll("_", " ")} · {String(mandate.mandate_type || "type pending")} · evidence {String(mandate.evidence_status).replaceAll("_", " ")}
                {mandate.expiry_date ? ` · expires ${String(mandate.expiry_date)}` : ""}
                {mandate.previous_mandate_id ? " · renewal" : ""}
              </p>
              <MandateActions
                clientId={clientId}
                mandate={{ ...mandate, id: String(mandate.id), status: String(mandate.status) }}
                canReview={canReview}
                onChanged={() => void load()}
              />
            </li>
          ))}
        </ul>
      ) : null}

      <section className="rounded-md border border-sales-border-subtle p-3">
        <h2 className="mb-2 text-sm font-medium">Listing</h2>
        {opp.converted_listing_id ? (
          <Link className="text-sm underline" href={basePath.includes("/sales") ? "/sales/listings" : `/client/listings/${String(opp.converted_listing_id)}`}>
            Open listing draft
          </Link>
        ) : (
          <button type="button" disabled={busy} className="min-h-11 rounded-md bg-sales-text-primary px-3 text-sm text-white" onClick={() => void act({ action: "prepare_listing", managerOverride: canReview })}>
            Prepare listing
          </button>
        )}
        <p className="mt-2 text-xs text-sales-text-muted">A draft stays off the buyer match list until a manager approves it.</p>
      </section>

      <section className="rounded-md border border-sales-border-subtle p-3">
        <h2 className="mb-2 text-sm font-medium">History</h2>
        <ul className="space-y-1 text-xs text-sales-text-secondary">
          {bundle.events.map((item) => (
            <li key={String(item.id)}>{String(item.event_type)}{item.to_value ? ` · ${String(item.to_value)}` : ""} · {new Date(String(item.created_at)).toLocaleString()}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
