import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { listAcquisitionOpportunities, getAcquisitionBundle, type AcquisitionActor } from "@/lib/real-estate/acquisition-service";
import { canReadListing, type ListingActor } from "@/lib/real-estate/listing-access";
import { loadListingPage } from "@/lib/real-estate/listing-read-service";
import { canApproveListings } from "@/lib/real-estate/listings";
import { journeyFileRelations } from "@/lib/real-estate/workflow/journey-links";
import {
  draftNextAction,
  draftStageLabel,
  listingNextAction,
  listingStageLabel,
  presentPropertyRegister,
  propertyWorkLinks,
  recordsAreLinked,
  type PropertyDraftRecord,
  type PropertyGroup,
  type PropertyListingRecord,
  type PropertyRegisterEntry,
} from "@/lib/real-estate/property-register";

type Actor = { userId: string; role: string; clientId: string | null; name?: string | null };

const LISTING_PAGE = 200;
const LISTING_PAGE_CAP = 25;

async function relatedJourney(clientId: string, actor: Actor, listingId: string) {
  try {
    return await journeyFileRelations({ clientId, actor, listingId });
  } catch {
    return { viewingId: null, buyerSearchId: null, offerId: null, transactionId: null, documentId: null };
  }
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function listingActor(actor: Actor): ListingActor {
  return { userId: actor.userId, role: actor.role, clientId: actor.clientId };
}

function acquisitionActor(actor: Actor): AcquisitionActor {
  return { id: actor.userId, name: actor.name?.trim() || "Agent", role: actor.role, clientId: actor.clientId };
}

function agentName(value: unknown): string | null {
  if (Array.isArray(value)) return agentName(value[0]);
  if (value && typeof value === "object" && "name" in value) return text((value as { name?: unknown }).name);
  return null;
}

async function loadListings(supabase: SupabaseClient, actor: Actor, clientId: string): Promise<{
  available: boolean;
  incomplete: boolean;
  rows: PropertyListingRecord[];
}> {
  const rows: PropertyListingRecord[] = [];
  const url = new URL("https://segmiq.local/listings");
  for (let page = 1; page <= LISTING_PAGE_CAP; page += 1) {
    const result = await loadListingPage(supabase, listingActor(actor), clientId, url, page, LISTING_PAGE);
    if (result.error) return { available: rows.length > 0, incomplete: true, rows };
    const batch = (result.data ?? []).filter((row) => canReadListing(listingActor(actor), row));
    for (const row of batch) {
      const id = text(row.id);
      if (!id) continue;
      rows.push({
        id,
        status: text(row.status) ?? "available",
        approvalStatus: text(row.approval_status),
        title: text(row.address) ?? text(row.suburb) ?? "Listing",
        assignedLabel: agentName(row.agent),
        acquisitionOpportunityId: text(row.acquisition_opportunity_id),
        updatedAt: text(row.updated_at) ?? text(row.created_at) ?? "",
      });
    }
    if ((result.data ?? []).length < LISTING_PAGE) return { available: true, incomplete: false, rows };
  }
  return { available: true, incomplete: true, rows };
}

async function agentLabels(supabase: SupabaseClient, clientId: string, ids: string[]): Promise<Map<string, string>> {
  const labels = new Map<string, string>();
  if (ids.length === 0) return labels;
  const { data, error } = await supabase.from("users").select("id, name").eq("client_id", clientId).in("id", ids);
  if (error || !data) return labels;
  for (const row of data) {
    const id = text(row.id);
    const name = text(row.name);
    if (id && name) labels.set(id, name);
  }
  return labels;
}

async function loadDrafts(actor: Actor, clientId: string): Promise<{
  available: boolean;
  incomplete: boolean;
  rows: PropertyDraftRecord[];
}> {
  const listed = await listAcquisitionOpportunities({ clientId, actor: acquisitionActor(actor) });
  if (!listed.ok) return { available: false, incomplete: true, rows: [] };
  const supabase = createAdminClient();
  const agentIds = [...new Set(listed.opportunities.map((row) => text(row.assigned_agent_id)).filter((id): id is string => Boolean(id)))];
  const names = await agentLabels(supabase, clientId, agentIds);
  const rows = listed.opportunities.flatMap((row) => {
    const id = text(row.id);
    if (!id) return [];
    const assignedId = text(row.assigned_agent_id);
    return [{
      id,
      stage: text(row.stage) ?? "new_opportunity",
      status: text(row.status) ?? "active",
      title: text(row.address) ?? text(row.suburb) ?? text(row.city) ?? text(row.reference_number) ?? "Seller opportunity",
      sellerLabel: text(row.owner_name),
      assignedLabel: assignedId ? names.get(assignedId) ?? null : null,
      reference: text(row.reference_number),
      convertedListingId: text(row.converted_listing_id),
      updatedAt: text(row.updated_at) ?? text(row.created_at) ?? "",
    }];
  });
  return { available: true, incomplete: listed.incomplete, rows };
}

export async function readPropertyRegister(input: {
  clientId: string;
  actor: Actor;
  surface: "sales" | "client";
  query?: string | null;
  group?: PropertyGroup;
  page?: number;
  pageSize?: number;
}): Promise<{ entries: PropertyRegisterEntry[]; total: number; page: number; pageSize: number; partial: "drafts" | "listings" | "both" | null }> {
  const supabase = createAdminClient();
  const [drafts, listings] = await Promise.all([
    loadDrafts(input.actor, input.clientId),
    loadListings(supabase, input.actor, input.clientId),
  ]);
  const root = input.surface === "sales" ? "/sales" : "/client";
  const canApprove = canApproveListings(input.actor.role);
  return presentPropertyRegister(
    {
      drafts: drafts.rows,
      listings: listings.rows,
      draftsAvailable: drafts.available,
      listingsAvailable: listings.available,
      draftsIncomplete: drafts.incomplete,
      listingsIncomplete: listings.incomplete,
    },
    {
      draftHref: (id) => `${root}/acquisitions/${id}`,
      listingHref: (id) => `${root}/listings/${id}`,
      canApprove,
      query: input.query,
      group: input.group,
      page: input.page,
      pageSize: input.pageSize,
    }
  );
}

async function readListing(supabase: SupabaseClient, actor: Actor, clientId: string, listingId: string) {
  const { data, error } = await supabase
    .from("listings")
    .select("id, client_id, agent_id, status, approval_status, address, suburb, acquisition_opportunity_id, updated_at")
    .eq("id", listingId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) return { error: true as const };
  if (!data || !canReadListing(listingActor(actor), data)) return { error: false as const, listing: null };
  const agentId = text(data.agent_id);
  const names = agentId ? await agentLabels(supabase, clientId, [agentId]) : new Map<string, string>();
  const listing: PropertyListingRecord = {
    id: String(data.id),
    status: text(data.status) ?? "available",
    approvalStatus: text(data.approval_status),
    title: text(data.address) ?? text(data.suburb) ?? "Listing",
    assignedLabel: agentId ? names.get(agentId) ?? null : null,
    acquisitionOpportunityId: text(data.acquisition_opportunity_id),
    updatedAt: text(data.updated_at) ?? "",
  };
  return { error: false as const, listing };
}

function draftFromBundle(opportunity: Record<string, unknown>, assignedLabel: string | null): PropertyDraftRecord {
  return {
    id: String(opportunity.id),
    stage: text(opportunity.stage) ?? "new_opportunity",
    status: text(opportunity.status) ?? "active",
    title: text(opportunity.address) ?? text(opportunity.suburb) ?? text(opportunity.city) ?? text(opportunity.reference_number) ?? "Seller opportunity",
    sellerLabel: text(opportunity.owner_name),
    assignedLabel,
    reference: text(opportunity.reference_number),
    convertedListingId: text(opportunity.converted_listing_id),
    updatedAt: text(opportunity.updated_at) ?? "",
  };
}

export async function readPropertyFile(input: {
  clientId: string;
  actor: Actor;
  surface: "sales" | "client";
  listingId?: string | null;
  opportunityId?: string | null;
}): Promise<
  | { ok: false; error: string; status: number }
  | {
      ok: true;
      title: string;
      stageLabel: string;
      personLabel: string | null;
      nextAction: string;
      href: string;
      historyHref: string | null;
      listingHref: string | null;
      links: Array<{ label: string; href: string }>;
    }
> {
  const supabase = createAdminClient();
  const root = input.surface === "sales" ? "/sales" : "/client";
  const canApprove = canApproveListings(input.actor.role);

  if (input.listingId) {
    const loaded = await readListing(supabase, input.actor, input.clientId, input.listingId);
    if (loaded.error) return { ok: false, error: "Could not load the listing", status: 503 };
    if (!loaded.listing) return { ok: false, error: "Not found", status: 404 };
    const listing = loaded.listing;
    let historyHref: string | null = null;
    let opportunityId: string | null = null;
    let sellerContactId: string | null = null;
    if (listing.acquisitionOpportunityId) {
      const bundle = await getAcquisitionBundle(input.clientId, listing.acquisitionOpportunityId, acquisitionActor(input.actor));
      if (bundle.ok) {
        const draft = draftFromBundle(bundle.opportunity, null);
        if (recordsAreLinked(draft, listing)) {
          opportunityId = draft.id;
          historyHref = `${root}/acquisitions/${draft.id}`;
          sellerContactId = text(bundle.opportunity.contact_id);
        }
      }
    }
    return {
      ok: true,
      title: listing.title,
      stageLabel: listingStageLabel(listing.status, listing.approvalStatus),
      personLabel: listing.assignedLabel,
      nextAction: listingNextAction({ status: listing.status, approvalStatus: listing.approvalStatus, canApprove }),
      href: `${root}/listings/${listing.id}`,
      historyHref,
      listingHref: `${root}/listings/${listing.id}`,
      links: propertyWorkLinks({
        surface: input.surface,
        listingId: listing.id,
        opportunityId,
        sellerContactId,
        clientId: input.clientId,
        ...(await relatedJourney(input.clientId, input.actor, listing.id)),
      }),
    };
  }

  if (!input.opportunityId) return { ok: false, error: "Not found", status: 404 };
  const bundle = await getAcquisitionBundle(input.clientId, input.opportunityId, acquisitionActor(input.actor));
  if (!bundle.ok) return { ok: false, error: bundle.error, status: bundle.status };
  const assignedId = text(bundle.opportunity.assigned_agent_id);
  const names = assignedId ? await agentLabels(supabase, input.clientId, [assignedId]) : new Map<string, string>();
  const draft = draftFromBundle(bundle.opportunity, assignedId ? names.get(assignedId) ?? null : null);
  let listingHref: string | null = null;
  if (draft.convertedListingId) {
    const loaded = await readListing(supabase, input.actor, input.clientId, draft.convertedListingId);
    if (!loaded.error && loaded.listing && recordsAreLinked(draft, loaded.listing)) {
      listingHref = `${root}/listings/${loaded.listing.id}`;
    }
  }
  return {
    ok: true,
    title: draft.title,
    stageLabel: draftStageLabel(draft.stage, draft.status),
    personLabel: draft.sellerLabel ?? draft.assignedLabel,
    nextAction: listingHref ? "Open the listing" : draftNextAction(draft.stage),
    href: `${root}/acquisitions/${draft.id}`,
    historyHref: `${root}/acquisitions/${draft.id}`,
    listingHref,
    links: propertyWorkLinks({
      surface: input.surface,
      listingId: listingHref ? draft.convertedListingId : null,
      opportunityId: draft.id,
      sellerContactId: text(bundle.opportunity.contact_id),
      clientId: input.clientId,
      ...(listingHref && draft.convertedListingId ? await relatedJourney(input.clientId, input.actor, draft.convertedListingId) : {}),
    }),
  };
}
