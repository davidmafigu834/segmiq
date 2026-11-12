import { STAGE_LABEL, type AcquisitionStage } from "@/lib/real-estate/acquisition-plan";
import {
  isClosedListingStatus,
  LISTING_APPROVAL_LABEL,
  LISTING_STATUS_LABEL,
} from "@/lib/real-estate/listings";
import type { ListingApprovalStatus, ListingStatus } from "@/types";

/** Authorised seller opportunity. Linkage uses only the explicit id fields. */
export type PropertyDraftRecord = {
  id: string;
  stage: string;
  status: string;
  title: string;
  sellerLabel: string | null;
  assignedLabel: string | null;
  reference: string | null;
  convertedListingId: string | null;
  updatedAt: string;
};

/** Authorised listing. Linkage uses only acquisitionOpportunityId. */
export type PropertyListingRecord = {
  id: string;
  status: string;
  approvalStatus: string | null;
  title: string;
  assignedLabel: string | null;
  acquisitionOpportunityId: string | null;
  updatedAt: string;
};

export type PropertyGroup = "all" | "drafts" | "listings" | "inactive";

export type PropertyRegisterEntry = {
  key: string;
  kind: "draft" | "listing";
  title: string;
  stageLabel: string;
  personLabel: string | null;
  href: string;
  historyHref: string | null;
  nextAction: string;
  inactive: boolean;
  updatedAt: string;
};

export type PropertyRegisterSourceState = {
  drafts: PropertyDraftRecord[];
  listings: PropertyListingRecord[];
  draftsAvailable: boolean;
  listingsAvailable: boolean;
  draftsIncomplete: boolean;
  listingsIncomplete: boolean;
};

const DRAFT_NEXT: Record<string, string> = {
  new_opportunity: "Continue the opportunity",
  owner_contacted: "Continue the opportunity",
  owner_interested: "Continue the opportunity",
  inspection_scheduled: "Continue inspection",
  inspection_completed: "Continue inspection",
  pricing_discussion: "Record price",
  mandate_negotiation: "Continue the mandate",
  mandate_secured: "Continue the mandate",
  listing_preparation: "Prepare listing",
  submitted_for_approval: "Prepare listing",
};

const DRAFT_STATUS_LABEL: Record<string, string> = {
  active: "Active",
  on_hold: "On hold",
  nurturing: "Nurturing",
  not_interested: "Not interested",
  lost: "Lost",
  converted: "Converted",
};

function text(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function draftStageLabel(stage: string, status: string): string {
  const known = stage in STAGE_LABEL ? STAGE_LABEL[stage as AcquisitionStage] : stage.replaceAll("_", " ");
  if (status === "active") return known;
  return `${known} · ${DRAFT_STATUS_LABEL[status] ?? status.replaceAll("_", " ")}`;
}

export function listingStageLabel(status: string, approvalStatus: string | null): string {
  const stage = status in LISTING_STATUS_LABEL ? LISTING_STATUS_LABEL[status as ListingStatus] : status.replaceAll("_", " ");
  if (!approvalStatus || approvalStatus === "approved") return stage;
  const approval = approvalStatus in LISTING_APPROVAL_LABEL
    ? LISTING_APPROVAL_LABEL[approvalStatus as ListingApprovalStatus]
    : approvalStatus.replaceAll("_", " ");
  return `${stage} · ${approval}`;
}

export function draftNextAction(stage: string): string {
  return DRAFT_NEXT[stage] ?? "Continue the opportunity";
}

export function listingNextAction(input: {
  status: string;
  approvalStatus: string | null;
  canApprove: boolean;
}): string {
  if (input.approvalStatus === "pending_approval") {
    return input.canApprove ? "Approve listing" : "Waiting for listing approval";
  }
  if (input.approvalStatus === "rejected") return "Open the listing";
  if (input.approvalStatus === "draft") return "Submit for approval";
  if (input.status === "under_offer") return "Open offers";
  return "Open the listing";
}

function draftInactive(status: string): boolean {
  return status !== "active";
}

/** Both explicit ids agree, and both records are in the authorised sets. */
export function recordsAreLinked(draft: PropertyDraftRecord, listing: PropertyListingRecord): boolean {
  return draft.convertedListingId === listing.id && listing.acquisitionOpportunityId === draft.id;
}

export function mergePropertyRecords(input: {
  drafts: readonly PropertyDraftRecord[];
  listings: readonly PropertyListingRecord[];
  draftHref: (id: string) => string;
  listingHref: (id: string) => string;
  canApprove: boolean;
}): PropertyRegisterEntry[] {
  const drafts = new Map(input.drafts.map((row) => [row.id, row]));
  const consumed = new Set<string>();
  const entries: PropertyRegisterEntry[] = [];

  for (const listing of input.listings) {
    const draft = listing.acquisitionOpportunityId ? drafts.get(listing.acquisitionOpportunityId) : undefined;
    const linked = draft != null && recordsAreLinked(draft, listing);
    if (linked && draft) consumed.add(draft.id);
    entries.push({
      key: `listing:${listing.id}`,
      kind: "listing",
      title: listing.title,
      stageLabel: listingStageLabel(listing.status, listing.approvalStatus),
      personLabel: listing.assignedLabel,
      href: input.listingHref(listing.id),
      historyHref: linked && draft ? input.draftHref(draft.id) : null,
      nextAction: listingNextAction({
        status: listing.status,
        approvalStatus: listing.approvalStatus,
        canApprove: input.canApprove,
      }),
      inactive: isClosedListingStatus(listing.status),
      updatedAt: listing.updatedAt,
    });
  }

  for (const draft of input.drafts) {
    if (consumed.has(draft.id)) continue;
    const person = text(draft.sellerLabel) ?? text(draft.assignedLabel);
    entries.push({
      key: `draft:${draft.id}`,
      kind: "draft",
      title: draft.title,
      stageLabel: draftStageLabel(draft.stage, draft.status),
      personLabel: person,
      href: input.draftHref(draft.id),
      historyHref: null,
      nextAction: draftNextAction(draft.stage),
      inactive: draftInactive(draft.status),
      updatedAt: draft.updatedAt,
    });
  }

  return entries.sort((a, b) => {
    const time = b.updatedAt.localeCompare(a.updatedAt);
    return time === 0 ? a.key.localeCompare(b.key) : time;
  });
}

function searchable(entry: PropertyRegisterEntry, extra: string | null | undefined): string {
  return [entry.title, entry.personLabel, entry.stageLabel, extra].filter(Boolean).join(" ").toLowerCase();
}

export function presentPropertyRegister(
  source: PropertyRegisterSourceState,
  options: {
    draftHref: (id: string) => string;
    listingHref: (id: string) => string;
    canApprove: boolean;
    query?: string | null;
    group?: PropertyGroup;
    page?: number;
    pageSize?: number;
  }
): {
  entries: PropertyRegisterEntry[];
  total: number;
  page: number;
  pageSize: number;
  partial: "drafts" | "listings" | "both" | null;
} {
  const pageSize = Math.min(50, Math.max(1, options.pageSize ?? 25));
  const requestedPage = Math.max(1, options.page ?? 1);
  const merged = mergePropertyRecords({
    drafts: source.draftsAvailable ? source.drafts : [],
    listings: source.listingsAvailable ? source.listings : [],
    draftHref: options.draftHref,
    listingHref: options.listingHref,
    canApprove: options.canApprove,
  });
  const draftsById = new Map((source.draftsAvailable ? source.drafts : []).map((row) => [row.id, row]));
  const listingsById = new Map((source.listingsAvailable ? source.listings : []).map((row) => [row.id, row]));
  const query = options.query?.trim().toLowerCase() ?? "";
  const group = options.group ?? "all";
  const filtered = merged.filter((entry) => {
    if (group === "drafts" && entry.kind !== "draft") return false;
    if (group === "listings" && entry.kind !== "listing") return false;
    if (group === "inactive" && !entry.inactive) return false;
    if (!query) return true;
    const draft = entry.kind === "draft" ? draftsById.get(entry.key.slice("draft:".length)) : undefined;
    const listing = entry.kind === "listing" ? listingsById.get(entry.key.slice("listing:".length)) : undefined;
    const linked = listing?.acquisitionOpportunityId ? draftsById.get(listing.acquisitionOpportunityId) : undefined;
    const linkedReference = listing && linked && recordsAreLinked(linked, listing) ? linked.reference : null;
    return searchable(entry, draft?.reference ?? linkedReference).includes(query);
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(requestedPage, pageCount);
  const start = (page - 1) * pageSize;
  const draftProblem = !source.draftsAvailable || source.draftsIncomplete;
  const listingProblem = !source.listingsAvailable || source.listingsIncomplete;
  const partial = draftProblem && listingProblem ? "both" : draftProblem ? "drafts" : listingProblem ? "listings" : null;
  return { entries: filtered.slice(start, start + pageSize), total: filtered.length, page, pageSize, partial };
}

export type PropertyWorkLink = { label: string; href: string };

/** Routes for work that already exists. Omitted ids are not turned into links. */
export function propertyWorkLinks(input: {
  surface: "sales" | "client";
  listingId: string | null;
  opportunityId: string | null;
  sellerContactId?: string | null;
  buyerSearchId?: string | null;
  viewingId?: string | null;
  offerId?: string | null;
  transactionId?: string | null;
  clientId?: string | null;
  documentId?: string | null;
}): PropertyWorkLink[] {
  const root = input.surface === "sales" ? "/sales" : "/client";
  const links: PropertyWorkLink[] = [
    { label: "Buyers", href: `${root}/buyers` },
  ];
  if (input.opportunityId) {
    const file = `${root}/acquisitions/${input.opportunityId}`;
    links.unshift(
      { label: "Inspection", href: `${file}#acq-inspection` },
      { label: "Mandates", href: `${root}/mandates` },
    );
  } else {
    links.push(
      { label: "Mandates", href: `${root}/mandates` },
      { label: "Inspections", href: `${root}/inspections` },
    );
  }
  links.push(
    { label: "Viewings", href: input.viewingId && input.surface === "client" ? `${root}/viewings?viewing=${encodeURIComponent(input.viewingId)}` : `${root}/viewings` },
    { label: "Offers", href: input.listingId ? `${root}/listings/${input.listingId}#property-offers` : `${root}/offers` },
    { label: "Compliance", href: `${root}/compliance` },
    { label: "Transactions", href: input.transactionId ? `${root}/transactions/${input.transactionId}` : `${root}/transactions` },
  );
  if (input.sellerContactId) links.push({ label: "Seller", href: `${root}/owners` });
  if (input.buyerSearchId) links.push({ label: "Buyer", href: `${root}/buyers/${input.buyerSearchId}` });
  if (input.offerId) links.push({ label: "Accepted offer", href: `${root}/offers/${input.offerId}` });
  if (input.clientId && input.documentId) links.push({ label: "Signed form", href: `/api/clients/${input.clientId}/workflow/documents/${input.documentId}` });
  return links;
}

export function propertySurfacesForRole(role: string): Array<"sales" | "client"> {
  if (role === "CLIENT_MANAGER" || role === "SUPER_ADMIN") return ["client", "sales"];
  if (role === "SALESPERSON") return ["sales"];
  return [];
}
