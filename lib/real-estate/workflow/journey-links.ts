import { createAdminClient } from "@/lib/supabase/admin";
import { hashSecret, newInvitationToken } from "@/lib/real-estate/compliance-management/engine";
import { intakePepper } from "@/lib/real-estate/seller-intake/flag";
import { canReadListing, privateListingImageKey, type ListingActor } from "@/lib/real-estate/listing-access";
import { renderPlainPdf } from "@/lib/real-estate/seller-intake/pdf";
import { isPrivateDocumentStorageConfigured, putPrivateDocument } from "@/lib/real-estate/private-document-storage";
import { createScheduledViewing } from "@/lib/real-estate/viewing-service";
import { viewingOverlapWarning } from "@/lib/real-estate/buyer-match";
import { createRealEstateOffer, mutateRealEstateOffer } from "@/lib/real-estate/offer-service";
import { buyerRecordIsOpenable } from "@/lib/real-estate/viewing-calendar";
import { offerExpiryInstant, offerRevisionAfterTermChange, secureLinkAccess, claimViewingSubmission, issuanceTemplateDecision, transactionStartRecovery, SYNTHETIC_OFFER_TEMPLATE, SYNTHETIC_VIEWING_TEMPLATE, type SecureLinkScope } from "@/lib/real-estate/workflow/journey";
import { readPrivateListingImage } from "@/lib/real-estate/private-listing-images";
import { viewingFormPhotoSources, viewingPropertyCard } from "@/lib/real-estate/workflow/viewing-form";

const LINK_TTL_MS = 14 * 24 * 60 * 60 * 1000;

type Actor = { userId: string; role: string; clientId: string | null; name?: string | null };

function fail(status: number, error: string) {
  return { ok: false as const, status, error };
}

function pepper() {
  const value = intakePepper();
  return value ? { ok: true as const, pepper: value } : fail(503, "Journey links are not configured.");
}

function syntheticEnabled() {
  return process.env.RE_WORKFLOW_SYNTHETIC === "1";
}

function builtInForm(templateKey: string) {
  return templateKey === SYNTHETIC_VIEWING_TEMPLATE || templateKey === SYNTHETIC_OFFER_TEMPLATE;
}

async function agencyCard(clientId: string, agentId: string | null) {
  const supabase = createAdminClient();
  const [{ data: client }, { data: agent }] = await Promise.all([
    supabase.from("clients").select("name, logo_url, primary_color").eq("id", clientId).maybeSingle(),
    agentId ? supabase.from("users").select("name, email, phone").eq("id", agentId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return {
    agencyName: (client?.name as string | null) ?? "Agency",
    logoUrl: typeof client?.logo_url === "string" && client.logo_url.startsWith("https://") ? client.logo_url : null,
    contactName: (agent?.name as string | null) ?? null,
    contactEmail: (agent?.email as string | null) ?? null,
    contactPhone: (agent?.phone as string | null) ?? null,
    accent: typeof client?.primary_color === "string" && /^#[0-9a-fA-F]{6}$/.test(client.primary_color) ? client.primary_color : null,
  };
}

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

async function quotationCurrency(clientId: string): Promise<{ currency: string | null; configured: boolean }> {
  const { data, error } = await createAdminClient().from("quotation_settings").select("default_currency").eq("client_id", clientId).maybeSingle();
  const code = textOrNull((data as { default_currency?: string | null } | null)?.default_currency)?.toUpperCase() ?? "";
  if (error || !/^[A-Z]{3}$/.test(code)) return { currency: null, configured: false };
  return { currency: code, configured: true };
}

export async function issueViewingLink(input: {
  clientId: string;
  actor: Actor;
  listingId: string;
  slots: string[];
  buyerSearchId?: string | null;
  templateKey: string;
}) {
  const secret = pepper();
  if (!secret.ok) return secret;
  const template = issuanceTemplateDecision({
    templateKey: input.templateKey,
    approvedAgencyTemplate: builtInForm(input.templateKey),
    syntheticIssuanceEnabled: syntheticEnabled(),
  });
  if (!template.ok) return fail(409, template.error);
  if (input.actor.role !== "SUPER_ADMIN" && input.actor.clientId !== input.clientId) return fail(403, "Forbidden");
  const slots = [...new Set(input.slots.map((slot) => new Date(slot).toISOString()).filter((slot) => Number.isFinite(Date.parse(slot))))].slice(0, 8);
  if (!slots.length) return fail(400, "Choose at least one proposed time.");
  const supabase = createAdminClient();
  const { data: listing } = await supabase.from("listings").select("id, client_id, agent_id, approval_status, address, suburb").eq("id", input.listingId).eq("client_id", input.clientId).maybeSingle();
  if (!listing || !canReadListing(input.actor as ListingActor, listing)) return fail(404, "Listing not found.");
  const token = newInvitationToken();
  const expires = new Date(Date.now() + LINK_TTL_MS).toISOString();
  const inserted = await supabase.from("re_journey_links").insert({
    client_id: input.clientId,
    purpose: "viewing_acknowledgement",
    listing_id: input.listingId,
    buyer_search_id: input.buyerSearchId ?? null,
    agent_id: input.actor.userId,
    revision: "1",
    token_hash: hashSecret(token, secret.pepper),
    expires_at: expires,
    authorised_slots: slots,
    template_key: input.templateKey,
    synthetic: template.synthetic,
    created_by: input.actor.userId,
  }).select("id").maybeSingle();
  if (inserted.error || !inserted.data) return fail(503, "Viewing links need the journey migration before they can be issued.");
  return { ok: true as const, linkId: inserted.data.id as string, path: `/journey/${token}`, expiresAt: expires, synthetic: template.synthetic };
}

export async function revokeJourneyLink(input: { clientId: string; actor: Actor; linkId: string }) {
  if (input.actor.role !== "SUPER_ADMIN" && input.actor.clientId !== input.clientId) return fail(403, "Forbidden");
  const supabase = createAdminClient();
  const updated = await supabase.from("re_journey_links").update({ revoked_at: new Date().toISOString(), status: "revoked" }).eq("id", input.linkId).eq("client_id", input.clientId).is("revoked_at", null).select("id").maybeSingle();
  if (!updated.data) return fail(404, "Link not found.");
  return { ok: true as const };
}

async function loadLink(token: string) {
  const secret = pepper();
  if (!secret.ok) return secret;
  const supabase = createAdminClient();
  const { data } = await supabase.from("re_journey_links").select("*").eq("token_hash", hashSecret(token, secret.pepper)).maybeSingle();
  if (!data) return fail(404, "This link is not available.");
  return { ok: true as const, link: data as Record<string, unknown>, pepper: secret.pepper };
}

function scopeOf(link: Record<string, unknown>): SecureLinkScope {
  return {
    clientId: String(link.client_id),
    purpose: link.purpose as SecureLinkScope["purpose"],
    recordId: String(link.id),
    revision: String(link.revision ?? "1"),
    recipientId: (link.recipient_id as string | null) ?? null,
    expiresAt: String(link.expires_at),
    revokedAt: (link.revoked_at as string | null) ?? null,
  };
}

export async function previewJourneyLink(token: string) {
  const loaded = await loadLink(token);
  if (!loaded.ok) return loaded;
  const link = loaded.link;
  const access = secureLinkAccess({
    link: scopeOf(link),
    clientId: String(link.client_id),
    purpose: link.purpose as SecureLinkScope["purpose"],
    recordId: String(link.id),
    revision: String(link.revision ?? "1"),
    recipientId: (link.recipient_id as string | null) ?? null,
    nowMs: Date.now(),
  });
  if (!access.ok) return fail(410, access.error);
  const supabase = createAdminClient();
  const clientId = String(link.client_id);
  const listingId = String(link.listing_id);
  const [{ data: listing }, money, brand] = await Promise.all([
    supabase.from("listings").select("address, suburb, price, bedrooms, bathrooms, description, photos, property_category, transaction_type").eq("id", listingId).eq("client_id", clientId).maybeSingle(),
    quotationCurrency(clientId),
    agencyCard(clientId, (link.agent_id as string | null) ?? null),
  ]);
  const row = (listing ?? {}) as Record<string, unknown>;
  const property = viewingPropertyCard({
    address: textOrNull(row.address),
    suburb: textOrNull(row.suburb),
    price: numberOrNull(row.price),
    currency: money.currency,
    currencyConfigured: money.configured,
    transactionType: textOrNull(row.transaction_type),
    propertyCategory: textOrNull(row.property_category),
    bedrooms: numberOrNull(row.bedrooms),
    bathrooms: numberOrNull(row.bathrooms),
    description: textOrNull(row.description),
    photoUrls: listing ? viewingFormPhotoSources(row.photos, clientId, listingId, token, process.env.CLOUDFLARE_R2_PUBLIC_URL) : [],
  });
  return {
    ok: true as const,
    purpose: link.purpose,
    synthetic: Boolean(link.synthetic),
    brand,
    property,
    propertyLabel: [property.heading, property.place].filter(Boolean).join(", ") || "Property",
    slots: Array.isArray(link.authorised_slots) ? link.authorised_slots : [],
    revision: String(link.revision ?? "1"),
    savedProfile: null,
  };
}

const PRIVATE_PHOTO_FILE = /^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp|avif)$/i;

export async function journeyListingPhoto(token: string, fileId: string) {
  if (!PRIVATE_PHOTO_FILE.test(fileId)) return fail(404, "This photograph was removed.");
  const loaded = await loadLink(token);
  if (!loaded.ok) return loaded;
  const link = loaded.link;
  if (link.purpose !== "viewing_acknowledgement") return fail(404, "This link is not a viewing form.");
  const access = secureLinkAccess({
    link: scopeOf(link),
    clientId: String(link.client_id),
    purpose: "viewing_acknowledgement",
    recordId: String(link.id),
    revision: String(link.revision ?? "1"),
    recipientId: (link.recipient_id as string | null) ?? null,
    nowMs: Date.now(),
  });
  if (!access.ok) return fail(410, access.error);
  const clientId = String(link.client_id);
  const listingId = String(link.listing_id);
  const { data: listing } = await createAdminClient().from("listings").select("photos").eq("id", listingId).eq("client_id", clientId).maybeSingle();
  const photos = (listing as { photos?: unknown } | null)?.photos;
  const key = privateListingImageKey(`clients/${clientId}/listings/${listingId}/photos/${fileId}`, clientId, listingId);
  if (!key || !Array.isArray(photos) || !photos.includes(key)) return fail(404, "This photograph was removed.");
  const image = await readPrivateListingImage(key);
  if (!image) return fail(404, "This house has no photograph yet.");
  return { ok: true as const, bytes: image.bytes, contentType: image.contentType };
}

export async function submitViewingLink(input: { token: string; slot: string; name: string; phone: string; signature: string }) {
  const loaded = await loadLink(input.token);
  if (!loaded.ok) return loaded;
  const link = loaded.link;
  if (link.purpose !== "viewing_acknowledgement") return fail(404, "This link is not a viewing form.");
  const access = secureLinkAccess({
    link: scopeOf(link),
    clientId: String(link.client_id),
    purpose: "viewing_acknowledgement",
    recordId: String(link.id),
    revision: String(link.revision ?? "1"),
    recipientId: (link.recipient_id as string | null) ?? null,
    nowMs: Date.now(),
  });
  if (!access.ok) return fail(410, access.error);
  if (!input.name.trim() || !input.phone.trim() || input.signature.trim().length < 2) return fail(400, "Enter your name, phone, and signature.");
  const supabase = createAdminClient();
  const { data: existingRows } = await supabase.from("viewings").select("id, agent_id, scheduled_at").eq("client_id", link.client_id as string).eq("agent_id", link.agent_id as string).gte("scheduled_at", new Date(Date.parse(input.slot) - 3 * 3600_000).toISOString()).lte("scheduled_at", new Date(Date.parse(input.slot) + 3 * 3600_000).toISOString());
  const availabilityOk = !viewingOverlapWarning(
    (existingRows ?? []).map((row) => ({ id: row.id as string, agentId: row.agent_id as string | null, scheduledAt: row.scheduled_at as string })),
    { agentId: (link.agent_id as string | null) ?? null, scheduledAt: input.slot }
  );
  const claim = claimViewingSubmission({
    linkId: String(link.id),
    existingViewingId: (link.viewing_id as string | null) ?? null,
    requestedAt: input.slot,
    authorisedSlots: Array.isArray(link.authorised_slots) ? (link.authorised_slots as string[]) : [],
    availabilityOk,
  });
  let viewingId = claim.outcome === "existing" ? claim.viewingId : null;
  if (claim.outcome === "book") {
    const buyer = await reuseOrCreateBuyer({
      clientId: String(link.client_id),
      agentId: String(link.agent_id),
      buyerSearchId: (link.buyer_search_id as string | null) ?? null,
      name: input.name.trim(),
      phone: input.phone.trim(),
    });
    if (!buyer.ok) return buyer;
    const booked = await createScheduledViewing({
      clientId: String(link.client_id),
      contactId: buyer.contactId,
      listingId: String(link.listing_id),
      agentId: String(link.agent_id),
      scheduledAt: input.slot,
      buyerSearchId: buyer.searchId,
      confirmationStatus: "confirmed",
      idempotencyKey: claim.idempotencyKey,
      actor: { id: String(link.agent_id), name: input.name.trim(), role: "SALESPERSON" },
      notifyCustomer: false,
    });
    if (!booked.ok) return fail(409, booked.error);
    viewingId = String(booked.viewing.id);
    const confirmedAt = String(booked.viewing.scheduled_at ?? input.slot);
    if (Date.parse(confirmedAt) !== Date.parse(input.slot)) {
      claim.copy = `This link already has a confirmed appointment at ${confirmedAt}.`;
    }
    await supabase.from("re_journey_links").update({ viewing_id: viewingId, buyer_search_id: buyer.searchId, status: "booked" }).eq("id", link.id as string).is("viewing_id", null);
  }
  const pdf = await storeJourneyPdf({
    clientId: String(link.client_id),
    linkId: String(link.id),
    title: "Viewing acknowledgement",
    lines: [claim.outcome === "book" || claim.outcome === "existing" ? "Confirmed booking" : "Viewing request", `Signer: ${input.name.trim()}`, `Signed: ${new Date().toISOString()}`, claim.copy],
  });
  await supabase.from("re_journey_submissions").insert({
    client_id: link.client_id,
    link_id: link.id,
    kind: claim.outcome === "book" || claim.outcome === "existing" ? "booking" : "request",
    revision: String(link.revision ?? "1"),
    signer_name: input.name.trim(),
    signed_at: new Date().toISOString(),
    answers: { slot: input.slot },
    storage_key: pdf.key,
    content_sha256: pdf.sha256,
    idempotency_key: `viewing-link:${String(link.id)}:${claim.outcome}:${input.slot}`,
  });
  return { ok: true as const, outcome: claim.outcome === "book" || claim.outcome === "existing" ? "booking" as const : claim.outcome, copy: claim.copy, viewingId };
}

async function reuseOrCreateBuyer(input: { clientId: string; agentId: string; buyerSearchId: string | null; name: string; phone: string }) {
  const supabase = createAdminClient();
  if (input.buyerSearchId) {
    const { data: search } = await supabase.from("real_estate_buyer_searches").select("id, contact_id, assigned_agent_id, client_id").eq("id", input.buyerSearchId).eq("client_id", input.clientId).maybeSingle();
    const { data: contact } = search?.contact_id
      ? await supabase.from("contacts").select("id, phone").eq("id", search.contact_id as string).eq("client_id", input.clientId).maybeSingle()
      : { data: null };
    const samePhone = (contact?.phone as string | null)?.replace(/\D/g, "").endsWith(input.phone.replace(/\D/g, "").slice(-8));
    if (!search || !samePhone) return fail(403, "These details do not match the person this form was prepared for.");
    return { ok: true as const, contactId: contact!.id as string, searchId: search.id as string };
  }
  const { createBuyerSearch } = await import("@/lib/real-estate/buyer-sales-service");
  const created = await createBuyerSearch({
    clientId: input.clientId,
    actor: { id: input.agentId, name: "Viewing form", role: "SALESPERSON", clientId: input.clientId },
    name: input.name,
    phone: input.phone,
    confirmNewContact: true,
    intent: "purchase",
    notes: "Created from a viewing acknowledgement.",
  });
  if (!created.ok) return fail(created.status, created.error);
  return { ok: true as const, contactId: String(created.search.contact_id), searchId: String(created.search.id) };
}

async function storeJourneyPdf(input: { clientId: string; linkId: string; title: string; lines: string[] }) {
  const rendered = renderPlainPdf([[input.title, ...input.lines]]);
  const key = `clients/${input.clientId}/transactions/journey/${input.linkId}/${rendered.sha256}.pdf`;
  if (!isPrivateDocumentStorageConfigured()) return { key: null as string | null, sha256: rendered.sha256 };
  try {
    await putPrivateDocument(key, rendered.bytes, "application/pdf");
    return { key, sha256: rendered.sha256 };
  } catch {
    return { key: null as string | null, sha256: rendered.sha256 };
  }
}

export async function issueOfferLink(input: {
  clientId: string;
  actor: Actor;
  listingId: string;
  contactId: string;
  buyerSearchId?: string | null;
  amount: number;
  conditions?: string | null;
  templateKey: string;
  templateValidityDays?: number | null;
}) {
  const template = issuanceTemplateDecision({
    templateKey: input.templateKey,
    approvedAgencyTemplate: builtInForm(input.templateKey),
    syntheticIssuanceEnabled: syntheticEnabled(),
  });
  if (!template.ok) return fail(409, template.error);
  const secret = pepper();
  if (!secret.ok) return secret;
  const created = await createRealEstateOffer({
    clientId: input.clientId,
    actor: { id: input.actor.userId, name: input.actor.name ?? "Agent", role: input.actor.role, clientId: input.actor.clientId },
    listingId: input.listingId,
    contactId: input.contactId,
    buyerSearchId: input.buyerSearchId,
    amount: input.amount,
    conditions: input.conditions,
    acceptanceChannel: "seller_link",
  });
  if (!created.ok) return created;
  const token = newInvitationToken();
  const supabase = createAdminClient();
  const inserted = await supabase.from("re_journey_links").insert({
    client_id: input.clientId,
    purpose: "offer_buyer",
    listing_id: input.listingId,
    buyer_search_id: input.buyerSearchId ?? null,
    offer_id: created.offer.id,
    agent_id: input.actor.userId,
    revision: "1",
    token_hash: hashSecret(token, secret.pepper),
    expires_at: new Date(Date.now() + LINK_TTL_MS).toISOString(),
    template_key: input.templateKey,
    synthetic: template.synthetic,
    created_by: input.actor.userId,
    authorised_slots: [],
  }).select("id").maybeSingle();
  if (inserted.error || !inserted.data) return fail(503, "The offer was not issued because the link could not be saved.");
  await supabase.from("real_estate_offers").update({ internal_notes: `validity-days:${input.templateValidityDays ?? 7}` }).eq("id", created.offer.id as string).eq("client_id", input.clientId);
  return { ok: true as const, offerId: created.offer.id as string, path: `/journey/${token}`, synthetic: template.synthetic };
}

export async function signBuyerOffer(input: { token: string; name: string; signature: string; amount: number; conditions: string }) {
  const loaded = await loadLink(input.token);
  if (!loaded.ok) return loaded;
  const link = loaded.link;
  if (link.purpose !== "offer_buyer") return fail(404, "This link is not an offer form.");
  const access = secureLinkAccess({
    link: scopeOf(link),
    clientId: String(link.client_id),
    purpose: "offer_buyer",
    recordId: String(link.id),
    revision: String(link.revision ?? "1"),
    recipientId: (link.recipient_id as string | null) ?? null,
    nowMs: Date.now(),
  });
  if (!access.ok) return fail(410, access.error);
  if (input.signature.trim().length < 2) return fail(400, "Sign the offer before sending it.");
  const supabase = createAdminClient();
  const { data: offer } = await supabase.from("real_estate_offers").select("*").eq("id", link.offer_id as string).eq("client_id", link.client_id as string).maybeSingle();
  if (!offer) return fail(404, "Offer not found.");
  const currentRevision = String(offer.revision ?? link.revision ?? "1");
  const changed = Number(offer.current_offer_amount) !== input.amount || String(offer.conditions ?? "") !== input.conditions;
  const next = offerRevisionAfterTermChange({ revision: currentRevision, termsChanged: changed && offer.revision_status === "buyer_signed" });
  if (next.requiresBuyerSignature && offer.revision_status === "buyer_signed" && String(link.revision) !== next.revision) {
    return fail(409, "These terms differ from the signed revision. Ask the agent for a new offer link.");
  }
  const signedAt = new Date().toISOString();
  const note = String(offer.internal_notes ?? "");
  const templateDays = /validity-days:(\d+)/.exec(note)?.[1];
  const expiresAt = offerExpiryInstant(signedAt, templateDays ? Number(templateDays) : null);
  const pdf = await storeJourneyPdf({
    clientId: String(link.client_id),
    linkId: String(link.id),
    title: "Offer to purchase",
    lines: [`Revision ${currentRevision}`, `Amount: ${input.amount}`, `Conditions: ${input.conditions}`, `Valid until: ${expiresAt}`, `Signer: ${input.name}`, `Signed: ${signedAt}`],
  });
  await supabase.from("real_estate_offers").update({
    current_offer_amount: input.amount,
    original_offer_amount: offer.revision_status === "buyer_signed" ? offer.original_offer_amount : input.amount,
    conditions: input.conditions,
    expires_at: expiresAt,
    expiry_date: expiresAt.slice(0, 10),
    revision_status: "buyer_signed",
    status: "submitted",
    submitted_at: signedAt,
  }).eq("id", offer.id as string).eq("client_id", link.client_id as string);
  await supabase.from("re_journey_submissions").insert({
    client_id: link.client_id,
    link_id: link.id,
    kind: "buyer_signed",
    revision: currentRevision,
    signer_name: input.name.trim(),
    signed_at: signedAt,
    answers: { amount: input.amount, conditions: input.conditions, expiresAt },
    storage_key: pdf.key,
    content_sha256: pdf.sha256,
    idempotency_key: `offer-buyer:${String(offer.id)}:${currentRevision}`,
  });
  const sellerToken = newInvitationToken();
  const secret = pepper();
  if (!secret.ok) return secret;
  await supabase.from("re_journey_links").insert({
    client_id: link.client_id,
    purpose: "offer_seller",
    listing_id: link.listing_id,
    offer_id: offer.id,
    agent_id: link.agent_id,
    revision: currentRevision,
    token_hash: hashSecret(sellerToken, secret.pepper),
    expires_at: expiresAt,
    template_key: link.template_key,
    synthetic: link.synthetic,
    created_by: link.created_by,
    authorised_slots: [],
  });
  return { ok: true as const, revision: currentRevision, expiresAt, sellerPath: `/journey/${sellerToken}`, pdfReady: Boolean(pdf.key) || Boolean(pdf.sha256) };
}

export async function sellerOfferDecision(input: { token: string; name: string; signature: string; decision: "accept" | "decline" }) {
  const loaded = await loadLink(input.token);
  if (!loaded.ok) return loaded;
  const link = loaded.link;
  if (link.purpose !== "offer_seller") return fail(404, "This link is not the seller copy.");
  const access = secureLinkAccess({
    link: scopeOf(link),
    clientId: String(link.client_id),
    purpose: "offer_seller",
    recordId: String(link.id),
    revision: String(link.revision ?? "1"),
    recipientId: (link.recipient_id as string | null) ?? null,
    nowMs: Date.now(),
  });
  if (!access.ok) return fail(410, access.error);
  if (input.decision === "decline") {
    const declined = await mutateRealEstateOffer({
      clientId: String(link.client_id),
      offerId: String(link.offer_id),
      actor: { id: String(link.agent_id), name: input.name, role: "CLIENT_MANAGER", clientId: String(link.client_id) },
      action: "reject",
      reason: "Seller declined on the issued link.",
    });
    if (!declined.ok) return declined;
    return { ok: true as const, decision: "declined" as const, transactionStart: null };
  }
  if (input.signature.trim().length < 2) return fail(400, "Sign to accept the offer.");
  const accepted = await mutateRealEstateOffer({
    clientId: String(link.client_id),
    offerId: String(link.offer_id),
    actor: { id: String(link.agent_id), name: input.name, role: "CLIENT_MANAGER", clientId: String(link.client_id) },
    action: "accept",
    acceptanceChannel: "seller_link",
  });
  if (!accepted.ok) return accepted;
  const { startOrGetTransactionFromOffer } = await import("@/lib/real-estate/transaction-service");
  let transactionStart: { state: "started" } | { state: "recovery"; error: string };
  try {
    const started = await startOrGetTransactionFromOffer({
      clientId: String(link.client_id),
      offerId: String(link.offer_id),
      actor: { id: String(link.agent_id), name: input.name, role: "CLIENT_MANAGER", clientId: String(link.client_id) },
    });
    transactionStart = transactionStartRecovery(started);
  } catch (error) {
    transactionStart = transactionStartRecovery({ ok: false, error: error instanceof Error ? error.message : "The transaction did not start." });
  }
  const pdf = await storeJourneyPdf({
    clientId: String(link.client_id),
    linkId: String(link.id),
    title: "Offer accepted",
    lines: [`Revision ${String(link.revision)}`, `Seller: ${input.name}`, `Signed: ${new Date().toISOString()}`],
  });
  await createAdminClient().from("re_journey_submissions").insert({
    client_id: link.client_id,
    link_id: link.id,
    kind: "seller_accepted",
    revision: String(link.revision ?? "1"),
    signer_name: input.name.trim(),
    signed_at: new Date().toISOString(),
    answers: {},
    storage_key: pdf.key,
    content_sha256: pdf.sha256,
    idempotency_key: `offer-seller:${String(link.offer_id)}:${String(link.revision)}`,
  });
  return { ok: true as const, decision: "accepted" as const, transactionStart, revision: String(link.revision ?? "1") };
}

export async function journeyFileRelations(input: { clientId: string; actor: Actor; listingId: string }) {
  const supabase = createAdminClient();
  const [{ data: viewing }, { data: offer }, { data: links }] = await Promise.all([
    supabase.from("viewings").select("id, buyer_search_id, agent_id").eq("client_id", input.clientId).eq("listing_id", input.listingId).order("scheduled_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("real_estate_offers").select("id, status, contact_id").eq("client_id", input.clientId).eq("listing_id", input.listingId).eq("status", "accepted").limit(1).maybeSingle(),
    supabase.from("re_journey_links").select("id").eq("client_id", input.clientId).eq("listing_id", input.listingId).limit(8),
  ]);
  const linkIds = (links ?? []).map((row) => row.id as string);
  const submission = linkIds.length
    ? await supabase.from("re_journey_submissions").select("id").eq("client_id", input.clientId).in("link_id", linkIds).order("created_at", { ascending: false }).limit(1).maybeSingle()
    : { data: null };
  const transaction = offer?.id
    ? await supabase.from("real_estate_transactions").select("id").eq("client_id", input.clientId).eq("offer_id", offer.id as string).maybeSingle()
    : { data: null };
  let buyerSearchId: string | null = null;
  if (viewing?.buyer_search_id) {
    const { data: search } = await supabase.from("real_estate_buyer_searches").select("id, client_id, assigned_agent_id").eq("id", viewing.buyer_search_id as string).eq("client_id", input.clientId).maybeSingle();
    if (search && buyerRecordIsOpenable({
      actorRole: input.actor.role,
      actorId: input.actor.userId,
      actorClientId: input.actor.clientId,
      searchClientId: search.client_id as string,
      assignedAgentId: (search.assigned_agent_id as string | null) ?? null,
    })) buyerSearchId = search.id as string;
  }
  return {
    viewingId: (viewing?.id as string | null) ?? null,
    buyerSearchId,
    offerId: offer?.status === "accepted" ? (offer.id as string) : null,
    transactionId: (transaction.data?.id as string | null) ?? null,
    documentId: (submission.data?.id as string | null) ?? null,
  };
}
