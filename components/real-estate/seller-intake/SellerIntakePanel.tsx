"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ReSection, ReSheet, ReStatusBadge } from "@/components/real-estate/ui";
import { ContextCompliancePanel } from "@/components/real-estate/compliance/ContextCompliancePanel";
import { OpenMandatePdf, SellerPdf, SoleMandatePdf } from "@/components/real-estate/seller-intake/MandatePaper";
import { emptyMarks, openPaper, paperBrand, signedOnToday, solePaper } from "@/components/real-estate/seller-intake/mandate-paper-data";

type RequestRow = {
  id: string;
  status: string;
  nextAction: string | null;
  kind: string | null;
  templateTitle: string | null;
  opportunityId: string | null;
  publicReference: string;
};

type Review = {
  request: RequestRow;
  fields: Array<{ key: string; label: string; value: string | null; group: string }>;
  restrictedPending: boolean;
  canSeeRestricted: boolean;
  missing: string[];
  duplicates: Array<{ id: string; name: string | null; phone: string | null }>;
  parties: Array<{ role: string; party_kind: string; display_name: string }>;
  documents: Array<{ id: string; signatureState: string; scanStatus: string; countsAsSignature: boolean; downloadable: boolean }>;
  review: { outcome: string | null; error: string | null; mandateId: string | null; complianceCaseId: string | null; contactId: string | null } | null;
  mandateApprovalGranted: boolean;
  submissionVersion: number;
};

export function SellerIntakePanel({
  clientId,
  opportunityId,
  contactId,
  leadId,
  mode = "both",
  createHref = "/sales/listings/mandate",
}: {
  clientId: string;
  opportunityId?: string | null;
  contactId?: string | null;
  leadId?: string | null;
  mode?: "both" | "queue" | "send";
  createHref?: string;
}) {
  const [hidden, setHidden] = useState(true);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [open, setOpen] = useState(false);
  const [review, setReview] = useState<Review | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [differences, setDifferences] = useState<Array<{ field: string; from: string; to: string }>>([]);
  const [duplicates, setDuplicates] = useState<Review["duplicates"]>([]);
  const [instruction, setInstruction] = useState("");
  const [groups, setGroups] = useState<string[]>([]);
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [confirmNew, setConfirmNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [paper, setPaper] = useState(false);

  const query = new URLSearchParams();
  if (opportunityId) query.set("opportunityId", opportunityId);
  if (contactId) query.set("contactId", contactId);
  if (leadId) query.set("leadId", leadId);

  const load = useCallback(async () => {
    const res = await fetch(`/api/clients/${clientId}/seller-intakes?${query.toString()}`, { cache: "no-store" });
    if (res.status === 404) {
      setHidden(true);
      return;
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setHidden(false);
      setError(json.error ?? "Could not load seller forms");
      return;
    }
    setHidden(false);
    setRequests(json.requests ?? []);
    // query is derived from the bound subject and is stable for this panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, opportunityId, contactId, leadId]);

  useEffect(() => { void load(); }, [load]);
  if (hidden) return null;

  async function openReview(requestId: string) {
    const res = await fetch(`/api/clients/${clientId}/seller-intakes/${requestId}`, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? "Could not open the review");
      return;
    }
    setReview(json);
    setDuplicates(json.duplicates ?? []);
    setPaper(false);
    setOpen(true);
  }

  async function act(requestId: string, body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/clients/${clientId}/seller-intakes/${requestId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Could not update the form");
      setDifferences(json.differences ?? []);
      setDuplicates(json.duplicates ?? duplicates);
      return;
    }
    if (json.link) {
      setLink(json.link);
    }
    setDifferences([]);
    await load();
    if (body.action === "accept_intake") await openReview(requestId);
  }

  async function copyLink() {
    if (!link) return;
    await navigator.clipboard?.writeText(link);
    if (navigator.share) {
      try { await navigator.share({ title: "Seller form", url: link }); } catch { /* copy already done */ }
    }
  }

  const outstanding = requests.filter((row) => row.nextAction);
  return (
    <ReSection id="seller-intake" title="Seller form" count={outstanding.length || undefined}>
      {mode !== "queue" ? (
        <div className="space-y-3">
          <p className="text-[13px] leading-5 text-sales-text-secondary">Choose a sole or open mandate, then copy the link and send it to the seller.</p>
          <Link href={createHref} className="inline-flex h-11 items-center justify-center rounded-[10px] bg-sales-brand px-4 text-[14px] font-semibold text-sales-brand-text">Choose a mandate</Link>
        </div>
      ) : null}
      {outstanding.length ? (
        <ul className="mt-3 divide-y divide-sales-border-subtle">
          {outstanding.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <p className="text-[14px] font-semibold text-sales-text-primary">{row.templateTitle ?? "Seller form"} · {row.publicReference}</p>
                <p className="text-[13px] text-sales-text-secondary">{row.nextAction}</p>
              </div>
              <div className="flex items-center gap-2">
                <ReStatusBadge label={row.status.replaceAll("_", " ")} tone={row.status === "accepted" ? "success" : "warning"} />
                <button type="button" className="min-h-11 text-[13px] font-semibold underline" onClick={() => void openReview(row.id)}>Open</button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {link ? (
        <div className="mt-3 space-y-2 rounded-[8px] border border-sales-border p-3">
          <p className="break-all text-[13px] text-sales-text-primary">{link}</p>
          <p className="text-[12px] text-sales-text-secondary">Copy this link and send it to the seller. It stays available here until you create another.</p>
          <button type="button" className="min-h-11 text-[13px] font-semibold underline" onClick={() => void copyLink()}>Copy link</button>
        </div>
      ) : null}
      {error ? <p className="mt-2 text-[12px] text-sales-danger">{error}</p> : null}
      {open && review ? (
        <ReSheet title="Check the seller form" description="Accepting the form opens the seller and the property. A manager still approves the mandate." onClose={() => setOpen(false)}>
          <div className="space-y-4 text-[14px]">
            <section>
              <h3 className="font-semibold">Parties</h3>
              {review.parties.length ? review.parties.map((party) => (
                <p key={`${party.role}-${party.display_name}`}>{party.display_name} · {party.role.replaceAll("_", " ")}</p>
              )) : <p className="text-sales-text-secondary">People are added when the form is accepted.</p>}
            </section>
            <section>
              <h3 className="font-semibold">Details</h3>
              {review.fields.filter((field) => field.value).map((field) => <p key={field.key} className="break-words">{field.label}: {field.value}</p>)}
            </section>
            {review.missing.length ? <section><h3 className="font-semibold">Missing</h3><p>{review.missing.join(", ")}</p></section> : null}
            {duplicates.length ? (
              <section>
                <h3 className="font-semibold">Possible existing contacts</h3>
                {duplicates.map((row) => (
                  <button type="button" key={row.id} className="block min-h-11 text-left underline" onClick={() => { setSelectedContact(row.id); setConfirmNew(false); }}>{selectedContact === row.id ? "Selected · " : ""}{row.name} · {row.phone}</button>
                ))}
                <button type="button" className="min-h-11 text-[13px] font-semibold underline" onClick={() => { setConfirmNew(true); setSelectedContact(null); }}>{confirmNew ? "New contact confirmed" : "Confirm a new contact"}</button>
                <p className="text-[12px] text-sales-text-secondary">Only you can see these matches.</p>
              </section>
            ) : null}
            {differences.length ? (
              <section>
                <h3 className="font-semibold">Changes to the existing record</h3>
                {differences.map((row) => <p key={row.field}>{row.field}: {row.from} → {row.to}</p>)}
              </section>
            ) : null}
            <div>
              <button type="button" className="inline-flex h-11 items-center justify-center rounded-[10px] bg-sales-brand px-4 text-[14px] font-semibold text-sales-brand-text" onClick={() => setPaper((current) => !current)}>{paper ? "Hide PDF" : "Generate PDF"}</button>
              {paper ? (
                <div className="mt-4">
                  <SellerPdf heading={review.request.kind === "sole" ? "Sole mandate" : "Open mandate to sell"} detail="Generated from the answers the seller entered." onBack={() => setPaper(false)}>
                    {review.request.kind === "sole"
                      ? <SoleMandatePdf data={solePaper(Object.fromEntries(review.fields.map((field) => [field.key, field.value ?? ""])), emptyMarks)} brand={paperBrand({ name: null, signedOn: signedOnToday() })} />
                      : <OpenMandatePdf data={openPaper(Object.fromEntries(review.fields.map((field) => [field.key, field.value ?? ""])), emptyMarks)} brand={paperBrand({ name: null, signedOn: signedOnToday() })} />}
                  </SellerPdf>
                </div>
              ) : null}
            </div>
            <section>
              <h3 className="font-semibold">Documents</h3>
              {review.documents.length ? review.documents.map((row) => (
                <p key={row.id}>{row.signatureState === "prepared_unsigned" ? "Prepared, not signed" : row.signatureState.replaceAll("_", " ")} · {row.downloadable ? "Ready to download" : "Waiting for a security check"}</p>
              )) : <p className="text-sales-text-secondary">No prepared document yet.</p>}
            </section>
            {review.restrictedPending && !review.canSeeRestricted ? <p>Identity, source of funds and PEP answers are waiting for a permitted reviewer.</p> : null}
            {review.canSeeRestricted && review.review?.complianceCaseId && review.review.contactId ? (
              <ContextCompliancePanel clientId={clientId} context="seller" title="Seller compliance" contactId={review.review.contactId} customerType={review.parties.some((party) => party.party_kind === "company") ? "company" : "individual"} />
            ) : null}
            <p className="text-[12px] text-sales-text-secondary">A manager approves the mandate after this form is accepted.</p>
            {review.review?.error ? <p className="text-sales-danger">{review.review.error}</p> : null}
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy} className="min-h-11 rounded-[8px] border border-sales-border px-3" onClick={() => void act(review.request.id, { action: "reissue", purpose: "resume" })}>Copy a new link</button>
              <button type="button" disabled={busy} className="min-h-11 rounded-[8px] border border-sales-border px-3" onClick={() => void act(review.request.id, { action: "revoke" })}>Withdraw link</button>
              <button type="button" disabled={busy} className="min-h-11 rounded-[8px] bg-sales-text-primary px-3 font-semibold text-sales-surface" onClick={() => void act(review.request.id, { action: "accept_intake", submissionVersion: review.submissionVersion, confirmNewContact: confirmNew, confirmChanges: differences.length > 0, linkContactId: selectedContact })}>Accept form</button>
            </div>
            <label className="block space-y-1">
              <span className="text-[13px] font-semibold">Ask the seller to correct</span>
              <input className="min-h-11 w-full rounded-[8px] border border-sales-border px-3" value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="What should they correct?" />
            </label>
            <div className="flex flex-wrap gap-2">
              {([
                ["parties", "People"],
                ["property", "Property"],
                ["occupancy", "Who lives there"],
                ["mandate_terms", "Selling instructions"],
                ["owner_identity", "Identity"],
                ["company", "Company"],
              ] as const).map(([group, label]) => (
                <label key={group} className="flex min-h-11 items-center gap-2 text-[13px]">
                  <input type="checkbox" checked={groups.includes(group)} onChange={(event) => setGroups(event.target.checked ? [...groups, group] : groups.filter((item) => item !== group))} />
                  {label}
                </label>
              ))}
            </div>
            <button type="button" disabled={busy} className="min-h-11 text-[13px] font-semibold underline" onClick={() => void act(review.request.id, { action: "corrections", groups, instruction })}>Request corrections</button>
          </div>
        </ReSheet>
      ) : null}
    </ReSection>
  );
}
