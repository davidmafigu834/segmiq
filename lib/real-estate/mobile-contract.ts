import { allowedOfferActions, canWriteOffer, type ReOfferStatus } from "./offers";
export const REAL_ESTATE_MOBILE_CONTRACT_VERSION = 1;
export function mobileReleaseEvidence() {
  return { contractVersion: REAL_ESTATE_MOBILE_CONTRACT_VERSION, revision: process.env.VERCEL_GIT_COMMIT_SHA || process.env.SEGMIQ_RELEASE_REVISION || null, deployedVerification: "NOT_ATTESTED" as const };
}
/** Commission is manager-only across transaction reads AND mutation responses. */
export function transactionMobileDto(value: unknown, role: string): unknown {
  if (role === "CLIENT_MANAGER" || role === "SUPER_ADMIN") return value;
  if (Array.isArray(value)) return value.filter(v => !(v && typeof v === "object" && /commission/i.test(String(v.eventType ?? v.event_type ?? v.milestone_key ?? v.key ?? "")))).map(v => transactionMobileDto(v, role));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => !/commission/i.test(key)).map(([key,v]) => [key,transactionMobileDto(v,role)]));
  return value;
}
export function offerPermittedActions(actor: { id: string; role: string; clientId: string | null }, row: Record<string, unknown>, listingAgentId?: string | null) {
  if (!canWriteOffer({ role:actor.role, userId:actor.id, userClientId:actor.clientId, offerClientId:String(row.client_id), buyerAgentId:row.buyer_agent_id as string | null, listingAgentId:(row.listing_agent_id as string | null) ?? listingAgentId ?? null })) return [];
  return allowedOfferActions(row.status as ReOfferStatus);
}
