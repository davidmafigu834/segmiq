import { createAdminClient } from "@/lib/supabase/admin";
import {
  decideReservationRelease,
  decideTransactionCompletion,
  isClosedListingStatusValue,
  offerStillReserves,
  type CompletionDecision,
} from "@/lib/real-estate/listing-availability";
import type { ReTransactionType } from "@/lib/real-estate/transactions";

type OfferHoldRow = {
  id: string;
  status: string;
  reserves_listing?: boolean | null;
};

type TxnHoldRow = {
  id: string;
  offer_id: string | null;
  status: string;
};

function missingColumn(error: { message?: string } | null, column: string): boolean {
  const message = error?.message ?? "";
  return message.includes(column) || message.includes("schema cache");
}

export async function listReservingOfferIds(
  clientId: string,
  listingId: string,
  exceptOfferId?: string | null
): Promise<string[]> {
  const supabase = createAdminClient();
  const flagged = await supabase
    .from("real_estate_offers")
    .select("id, status, reserves_listing")
    .eq("client_id", clientId)
    .eq("listing_id", listingId)
    .eq("reserves_listing", true);

  let offers: OfferHoldRow[] = [];
  if (!flagged.error) {
    offers = (flagged.data ?? []) as OfferHoldRow[];
  } else if (missingColumn(flagged.error, "reserves_listing")) {
    const accepted = await supabase
      .from("real_estate_offers")
      .select("id, status")
      .eq("client_id", clientId)
      .eq("listing_id", listingId)
      .eq("status", "accepted");
    offers = (accepted.data ?? []) as OfferHoldRow[];
  } else {
    throw new Error(flagged.error.message);
  }

  const ids = offers.map((o) => o.id).filter((id) => id !== exceptOfferId);
  if (!ids.length) return [];

  const { data: txns } = await supabase
    .from("real_estate_transactions")
    .select("id, offer_id, status")
    .eq("client_id", clientId)
    .eq("listing_id", listingId)
    .in("offer_id", ids);

  const txnByOffer = new Map<string, string>();
  for (const txn of (txns ?? []) as TxnHoldRow[]) {
    if (txn.offer_id) txnByOffer.set(txn.offer_id, txn.status);
  }

  return offers
    .filter((offer) => offer.id !== exceptOfferId)
    .filter((offer) =>
      offerStillReserves({
        offerStatus: offer.status,
        reservesListing: offer.reserves_listing,
        transactionStatus: txnByOffer.get(offer.id) ?? null,
      })
    )
    .map((offer) => offer.id);
}

export async function countActiveTransactions(
  clientId: string,
  listingId: string,
  exceptTransactionId?: string | null
): Promise<number> {
  const supabase = createAdminClient();
  let q = supabase
    .from("real_estate_transactions")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("listing_id", listingId)
    .in("status", ["draft", "pending_compliance", "in_progress"]);
  if (exceptTransactionId) q = q.neq("id", exceptTransactionId);
  const { count, error } = await q;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function setReservesListing(offerId: string, clientId: string, reserves: boolean): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("real_estate_offers")
    .update({ reserves_listing: reserves })
    .eq("id", offerId)
    .eq("client_id", clientId);
  if (error && !missingColumn(error, "reserves_listing")) {
    throw new Error(error.message);
  }
}

async function recordStatusEvent(input: {
  clientId: string;
  listingId: string;
  fromStatus: string | null;
  toStatus: string;
  reason: string;
  actorId: string | null;
  offerId?: string | null;
  transactionId?: string | null;
}): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("real_estate_listing_status_events").insert({
    client_id: input.clientId,
    listing_id: input.listingId,
    from_status: input.fromStatus,
    to_status: input.toStatus,
    reason: input.reason,
    actor_id: input.actorId,
    offer_id: input.offerId ?? null,
    transaction_id: input.transactionId ?? null,
  });
  if (error && !missingColumn(error, "real_estate_listing_status_events")) {
    console.error("[listing-status-event]", error.message);
  }
}

async function lastHoldFromStatus(clientId: string, listingId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("real_estate_listing_status_events")
    .select("from_status, to_status, reason")
    .eq("client_id", clientId)
    .eq("listing_id", listingId)
    .eq("to_status", "under_offer")
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) return null;
  const row = data?.[0];
  return (row?.from_status as string | null) ?? null;
}

export async function applyListingStatus(input: {
  clientId: string;
  listingId: string;
  expectedStatus: string | null;
  nextStatus: string;
  reason: string;
  actorId: string | null;
  offerId?: string | null;
  transactionId?: string | null;
}): Promise<boolean> {
  const supabase = createAdminClient();
  let q = supabase
    .from("listings")
    .update({ status: input.nextStatus, updated_at: new Date().toISOString() })
    .eq("id", input.listingId)
    .eq("client_id", input.clientId);
  if (input.expectedStatus) q = q.eq("status", input.expectedStatus);
  const { data, error } = await q.select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) return false;
  await recordStatusEvent({
    clientId: input.clientId,
    listingId: input.listingId,
    fromStatus: input.expectedStatus,
    toStatus: input.nextStatus,
    reason: input.reason,
    actorId: input.actorId,
    offerId: input.offerId,
    transactionId: input.transactionId,
  });
  return true;
}

export async function syncListingAfterReservationChange(input: {
  clientId: string;
  listingId: string;
  actorId: string | null;
  reason: string;
  offerId?: string | null;
  transactionId?: string | null;
  exceptOfferId?: string | null;
  exceptTransactionId?: string | null;
}): Promise<void> {
  const supabase = createAdminClient();
  const { data: listing } = await supabase
    .from("listings")
    .select("id, status, approval_status")
    .eq("id", input.listingId)
    .eq("client_id", input.clientId)
    .maybeSingle();
  if (!listing) return;
  if (isClosedListingStatusValue(listing.status as string)) return;

  const [reserving, active, heldFrom] = await Promise.all([
    listReservingOfferIds(input.clientId, input.listingId, input.exceptOfferId),
    countActiveTransactions(input.clientId, input.listingId, input.exceptTransactionId),
    lastHoldFromStatus(input.clientId, input.listingId),
  ]);
  const decision = decideReservationRelease({
    listingStatus: listing.status as string,
    approvalStatus: (listing.approval_status as string | null) ?? "approved",
    remainingReservingOffers: reserving.length,
    remainingActiveTransactions: active,
    heldFromStatus: heldFrom,
  });
  if (!decision.nextStatus || decision.nextStatus === listing.status) return;
  const applied = await applyListingStatus({
    clientId: input.clientId,
    listingId: input.listingId,
    expectedStatus: listing.status as string,
    nextStatus: decision.nextStatus,
    reason: input.reason,
    actorId: input.actorId,
    offerId: input.offerId,
    transactionId: input.transactionId,
  });
  if (!applied) {
    const { data: again } = await supabase
      .from("listings")
      .select("status, approval_status")
      .eq("id", input.listingId)
      .eq("client_id", input.clientId)
      .maybeSingle();
    if (!again || again.status === decision.nextStatus) return;
    const retry = decideReservationRelease({
      listingStatus: again.status as string,
      approvalStatus: (again.approval_status as string | null) ?? "approved",
      remainingReservingOffers: reserving.length,
      remainingActiveTransactions: active,
      heldFromStatus: heldFrom,
    });
    if (!retry.nextStatus || retry.nextStatus === again.status) return;
    await applyListingStatus({
      clientId: input.clientId,
      listingId: input.listingId,
      expectedStatus: again.status as string,
      nextStatus: retry.nextStatus,
      reason: input.reason,
      actorId: input.actorId,
      offerId: input.offerId,
      transactionId: input.transactionId,
    });
  }
}

export async function markOfferReservation(
  offerId: string,
  clientId: string,
  reserves: boolean
): Promise<void> {
  await setReservesListing(offerId, clientId, reserves);
}

/** Re-applies the closed listing status. Safe to call again after a completed transaction. */
export async function closeListingForCompletedTransaction(input: {
  clientId: string;
  listingId: string;
  transactionType: ReTransactionType;
  actorId: string | null;
  transactionId: string;
  offerId?: string | null;
}): Promise<void> {
  const supabase = createAdminClient();
  const { data: listingRow } = await supabase
    .from("listings")
    .select("status")
    .eq("id", input.listingId)
    .eq("client_id", input.clientId)
    .maybeSingle();
  if (!listingRow) return;
  const completion = decideTransactionCompletion({
    transactionType: input.transactionType,
    listingStatus: (listingRow.status as string | null) ?? null,
    otherActiveTransactionCount: 0,
    agreementRecorded: true,
    alreadyCompleted: true,
  });
  if (!completion.ok || listingRow.status === completion.nextListingStatus) return;
  await applyListingStatus({
    clientId: input.clientId,
    listingId: input.listingId,
    expectedStatus: listingRow.status as string,
    nextStatus: completion.nextListingStatus,
    reason: "transaction_completed",
    actorId: input.actorId,
    transactionId: input.transactionId,
    offerId: input.offerId ?? null,
  });
}

export function completionDecisionFor(input: {
  transactionType: ReTransactionType;
  listingStatus: string | null | undefined;
  otherActiveTransactionCount: number;
  agreementRecorded: boolean;
  alreadyCompleted: boolean;
}): CompletionDecision {
  return decideTransactionCompletion(input);
}
