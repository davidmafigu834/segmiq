import { canApproveListings, canSubmitListings } from "./listings";
export type ListingActor = { userId: string; role: string; clientId: string | null };
export type ListingAccessRow = { client_id: string; agent_id?: string | null; approval_status?: string | null };
export function canReadListing(a: ListingActor, r: ListingAccessRow): boolean {
  if (a.role !== "SUPER_ADMIN" && a.clientId !== r.client_id) return false;
  return canSubmitListings(a.role) && (canApproveListings(a.role) || r.agent_id === a.userId || r.approval_status == null || r.approval_status === "approved");
}
export function listingVisibilityFilter(a: ListingActor): string | null {
  return canApproveListings(a.role) ? null : `agent_id.eq.${a.userId},approval_status.eq.approved,approval_status.is.null`;
}
export function canAssignListingAgent(a: ListingActor, id: string | null | undefined): boolean {
  return canApproveListings(a.role) || id === undefined || id === a.userId;
}
export function listingActions(a: ListingActor, r: ListingAccessRow) {
  const read = canReadListing(a, r), manager = canApproveListings(a.role);
  return { read, edit: read && (manager || (r.agent_id === a.userId && ["draft", "pending_approval"].includes(r.approval_status ?? ""))), approve: read && manager, delete: read && manager };
}

/** Only dedicated private image keys may be signed; never owner documents or arbitrary URLs. */
export function privateListingImageKey(value: unknown, clientId: string, listingId: string): string | null {
  if (typeof value !== "string") return null;
  const prefix = `clients/${clientId}/listings/${listingId}/photos/`;
  if (!value.startsWith(prefix)) return null;
  const name = value.slice(prefix.length);
  return /^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp|avif)$/i.test(name) ? value : null;
}

/** Public property DTO: never serialize owner identities, acquisition records or document fields. */
export function listingReadDto(a: ListingActor, row: Record<string, unknown>, mobile = false) {
  const fields = ["id", "client_id", "agent_id", "development_id", "transaction_type", "status", "approval_status", "price", "bedrooms", "bathrooms", "size_sqm", "address", "suburb", "description", "photos", "property_category", "created_at", "updated_at", "agent", "development", "lease_term_months"];
  if (canApproveListings(a.role) || row.agent_id === a.userId) fields.push("mandate_type", "mandate_expiry_date", "external_reference", "rejection_reason");
  const dto: Record<string, unknown> = Object.fromEntries(fields.filter(k => k in row).map(k => [k, row[k]]));
  if (mobile) {
    dto.photos = [];
    dto.images = (Array.isArray(row.photos) ? row.photos : []).flatMap((value, index) =>
      privateListingImageKey(value, String(row.client_id), String(row.id)) ? [{ index, cover: index === 0, endpoint: `/api/clients/${row.client_id}/listings/${row.id}/images/${index}` }] : []);
    dto.legacyImagesGated = Array.isArray(row.photos) && row.photos.some(v => !privateListingImageKey(v, String(row.client_id), String(row.id)));
  }
  dto.permittedActions = listingActions(a, row as ListingAccessRow);
  return dto;
}
