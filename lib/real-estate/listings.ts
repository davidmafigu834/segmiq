import { z } from "zod";
import type { ListingApprovalStatus, ListingStatus, ListingTransactionType } from "@/types";

export const listingTransactionTypeSchema = z.enum([
  "sale",
  "rental",
  "new_development",
  "property_management",
]);

export const listingStatusSchema = z.enum([
  "available",
  "under_offer",
  "reserved",
  "sold",
  "let",
  "rented",
  "under_management",
]);

export const listingApprovalSchema = z.enum([
  "draft",
  "pending_approval",
  "approved",
  "rejected",
]);

export const listingWriteSchema = z.object({
  agent_id: z.string().uuid().nullable().optional(),
  development_id: z.string().uuid().nullable().optional(),
  transaction_type: listingTransactionTypeSchema.optional(),
  status: listingStatusSchema.optional(),
  approval_status: listingApprovalSchema.optional(),
  rejection_reason: z.string().max(1000).nullable().optional(),
  price: z.number().nullable().optional(),
  bedrooms: z.number().int().nullable().optional(),
  bathrooms: z.number().int().nullable().optional(),
  size_sqm: z.number().nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  suburb: z.string().max(200).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  photos: z.array(z.string()).max(50).optional(),
  mandate_type: z.enum(["sole", "joint", "open"]).nullable().optional(),
  mandate_expiry_date: z.string().nullable().optional(),
  lease_term_months: z.number().int().nullable().optional(),
  external_reference: z.string().max(200).nullable().optional(),
});

export const listingCreateSchema = listingWriteSchema.extend({
  transaction_type: listingTransactionTypeSchema,
});

export const LISTING_TRANSACTION_TYPES = [
  "sale",
  "rental",
  "new_development",
  "property_management",
] as const satisfies readonly ListingTransactionType[];

export const LISTING_STATUSES = [
  "available",
  "under_offer",
  "reserved",
  "sold",
  "let",
  "rented",
  "under_management",
] as const satisfies readonly ListingStatus[];

export const LISTING_APPROVAL_STATUSES = [
  "draft",
  "pending_approval",
  "approved",
  "rejected",
] as const satisfies readonly ListingApprovalStatus[];

export const LISTING_TYPE_LABEL: Record<ListingTransactionType, string> = {
  sale: "Sale",
  rental: "Rental",
  new_development: "Development",
  property_management: "Management",
};

export const LISTING_STATUS_LABEL: Record<ListingStatus, string> = {
  available: "Available",
  under_offer: "Under offer",
  reserved: "Reserved",
  sold: "Sold",
  let: "Rented",
  rented: "Rented",
  under_management: "Under management",
};

export const LISTING_APPROVAL_LABEL: Record<ListingApprovalStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  approved: "Approved",
  rejected: "Rejected",
};

export function isClosedListingStatus(status: ListingStatus | string | null | undefined): boolean {
  return status === "sold" || status === "let" || status === "rented";
}

export function isManagedListing(listing: {
  transaction_type?: string | null;
  status?: string | null;
}): boolean {
  return listing.transaction_type === "property_management" || listing.status === "under_management";
}

export function isListingLive(listing: {
  status?: string | null;
  approval_status?: string | null;
}): boolean {
  const approval = listing.approval_status ?? "approved";
  return approval === "approved" && listing.status === "available";
}

export function canApproveListings(role: string | null | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "CLIENT_MANAGER";
}

export function canSubmitListings(role: string | null | undefined): boolean {
  return canApproveListings(role) || role === "SALESPERSON";
}

export function defaultApprovalForCreate(role: string | null | undefined): ListingApprovalStatus {
  return canApproveListings(role) ? "approved" : "pending_approval";
}

export function listingStatusTone(
  status: ListingStatus | string
): "success" | "warning" | "info" | "neutral" | "purple" {
  if (status === "available") return "success";
  if (status === "under_offer") return "warning";
  if (status === "reserved") return "info";
  if (status === "let" || status === "rented") return "purple";
  if (status === "under_management") return "info";
  return "neutral";
}
