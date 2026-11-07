import { GET as readViewings } from "@/app/api/clients/[clientId]/viewings/route";
import { createAdminClient } from "@/lib/supabase/admin";
import { canReadListing, type ListingActor } from "@/lib/real-estate/listing-access";
import type { CompanyCalendarEvent } from "@/lib/sales/company-calendar/types";
import type { CalendarEvent } from "@/lib/sales/calendar/types";
import {
  buyerRecordIsOpenable,
  presentViewingOnCalendar,
  viewingInHalfOpenWindow,
  type ViewingCalendarRecord,
  type ViewingCalendarSurface,
} from "@/lib/real-estate/viewing-calendar";

export type RealEstateCalendarViewings = {
  failed: boolean;
  incomplete: boolean;
  salesEvents: CalendarEvent[];
  companyEvents: CompanyCalendarEvent[];
};

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asRecord(value: unknown): ViewingCalendarRecord | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const id = text(row.id);
  if (!id) return null;
  const listing = row.listing && typeof row.listing === "object" ? (row.listing as Record<string, unknown>) : null;
  const contact = row.contact && typeof row.contact === "object" ? (row.contact as Record<string, unknown>) : null;
  const address = text(listing?.address);
  const suburb = text(listing?.suburb);
  const property = [address, suburb].filter(Boolean).join(", ");
  return {
    id,
    scheduledAt: text(row.scheduled_at),
    status: text(row.status),
    confirmationStatus: text(row.confirmation_status),
    access: text(row.access),
    listingId: text(row.listing_id) ?? text(listing?.id),
    propertyLabel: property || null,
    addressAuthorised: Boolean(address || suburb),
    agentId: text(row.agent_id),
    buyerSearchId: text(row.buyer_search_id),
    buyerName: text(contact?.name),
    buyerPhone: text(contact?.phone),
  };
}

/**
 * Reads the same authorised viewing route the viewing pages use.
 * A failed or incomplete read does not invent rows. The caller keeps the other calendar events.
 */
async function readableListingIds(clientId: string, actor: ListingActor, listingIds: string[]): Promise<Set<string> | null> {
  if (!listingIds.length) return new Set();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("listings")
    .select("id, client_id, agent_id, approval_status")
    .eq("client_id", clientId)
    .in("id", listingIds);
  if (error) return null;
  const readable = new Set<string>();
  for (const row of data ?? []) {
    if (canReadListing(actor, row as { client_id: string; agent_id?: string | null; approval_status?: string | null })) {
      readable.add(row.id as string);
    }
  }
  return readable;
}

async function openableSearchIds(
  clientId: string,
  actor: { userId: string; role: string; clientId: string | null },
  searchIds: string[]
): Promise<Set<string> | null> {
  if (!searchIds.length) return new Set();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("real_estate_buyer_searches")
    .select("id, client_id, assigned_agent_id")
    .eq("client_id", clientId)
    .in("id", searchIds);
  if (error) return null;
  const openable = new Set<string>();
  for (const row of data ?? []) {
    if (
      buyerRecordIsOpenable({
        actorRole: actor.role,
        actorId: actor.userId,
        actorClientId: actor.clientId,
        searchClientId: (row.client_id as string | null) ?? null,
        assignedAgentId: (row.assigned_agent_id as string | null) ?? null,
      })
    ) {
      openable.add(row.id as string);
    }
  }
  return openable;
}

/**
 * Reads the same authorised viewing route the viewing pages use, limited to [from, to).
 * The viewing API treats `to` as inclusive, so a row exactly at the exclusive end is dropped here.
 */
export async function loadRealEstateCalendarViewings(input: {
  requestHeaders: { get(name: string): string | null };
  clientId: string;
  actor: ListingActor;
  surface: ViewingCalendarSurface;
  timezone: string;
  fromIso: string;
  toIsoExclusive: string;
  nowMs?: number;
}): Promise<RealEstateCalendarViewings> {
  const empty = { failed: true, incomplete: false, salesEvents: [], companyEvents: [] };
  if (!(Date.parse(input.toIsoExclusive) > Date.parse(input.fromIso))) return empty;
  try {
    const headers = new Headers();
    const cookie = input.requestHeaders.get("cookie");
    if (cookie) headers.set("cookie", cookie);
    const url = new URL(`http://internal/api/clients/${input.clientId}/viewings`);
    url.searchParams.set("from", input.fromIso);
    url.searchParams.set("to", input.toIsoExclusive);
    const response = await readViewings(new Request(url, { headers }), { params: { clientId: input.clientId } });
    if (!response.ok) return empty;
    const body = (await response.json()) as { viewings?: unknown; incomplete?: boolean };
    const rows = Array.isArray(body.viewings) ? body.viewings : [];
    const records: ViewingCalendarRecord[] = [];
    let unusable = false;
    for (const row of rows) {
      const record = asRecord(row);
      if (!record || !record.scheduledAt || !Number.isFinite(Date.parse(record.scheduledAt))) {
        unusable = true;
        continue;
      }
      if (!viewingInHalfOpenWindow(record.scheduledAt, input.fromIso, input.toIsoExclusive)) continue;
      records.push(record);
    }
    const listingIds = [...new Set(records.map((record) => record.listingId).filter((id): id is string => Boolean(id)))];
    const searchIds = [...new Set(records.filter((record) => record.access === "full" && record.buyerSearchId).map((record) => record.buyerSearchId as string))];
    const [readable, openable] = await Promise.all([
      readableListingIds(input.clientId, input.actor, listingIds),
      openableSearchIds(input.clientId, input.actor, searchIds),
    ]);
    const salesEvents: CalendarEvent[] = [];
    const companyEvents: CompanyCalendarEvent[] = [];
    for (const record of records) {
      const presented = presentViewingOnCalendar(record, {
        surface: input.surface,
        timezone: input.timezone,
        nowMs: input.nowMs,
        propertyReadable: Boolean(record.listingId && readable?.has(record.listingId)),
        buyerOpenable: Boolean(record.buyerSearchId && openable?.has(record.buyerSearchId)),
      });
      if (!presented) {
        unusable = true;
        continue;
      }
      salesEvents.push(presented.sales);
      companyEvents.push(presented.company);
    }
    return {
      failed: false,
      incomplete: Boolean(body.incomplete) || unusable,
      salesEvents,
      companyEvents,
    };
  } catch {
    return empty;
  }
}
