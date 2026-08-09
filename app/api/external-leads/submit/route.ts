import { NextResponse } from "next/server";
import { createLead } from "@/lib/leads/createLead";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  appendInterestedListingIds,
  phonesMatchLoose,
} from "@/lib/real-estate/helpers";
import { fetchRoundRobinEligibleUsers } from "@/lib/auth/sales-capabilities";
import { processLeadIntelligence } from "@/lib/lead-intelligence";
import { background } from "@/lib/background";
import type { DealSide, LeadSource } from "@/types";

export const dynamic = "force-dynamic";

type SoftResult = {
  ok: boolean;
  status: number;
  body: Record<string, unknown>;
};

function softFail(message: string, extra?: Record<string, unknown>): SoftResult {
  console.warn("[external-leads]", message, extra ?? {});
  return {
    ok: false,
    status: 200,
    body: { ok: false, soft_fail: true, error: message, ...extra },
  };
}

function mapSource(raw: unknown): LeadSource {
  const s = String(raw ?? "").toLowerCase().trim();
  if (s === "facebook_ad" || s === "facebook") return "FACEBOOK_AD";
  if (s === "website") return "WEBSITE";
  return "WEBSITE";
}

/** Map estate-agency website enquiry types → RE deal_side. */
function mapDealSide(raw: unknown): DealSide | null {
  const s = String(raw ?? "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");

  if (
    s === "buy_side" ||
    s === "sell_side" ||
    s === "landlord_side" ||
    s === "tenant_side"
  ) {
    return s;
  }

  if (s === "property" || s === "buy" || s === "buyer") return "buy_side";
  if (s === "sell" || s === "seller") return "sell_side";
  if (s === "landlord" || s === "let_out") return "landlord_side";
  if (s === "tenant" || s === "to_let" || s === "rent") return "tenant_side";
  if (s === "general") return null;
  return null;
}

function extractApiKey(req: Request, body: Record<string, unknown>): string {
  const fromBody = typeof body.api_key === "string" ? body.api_key.trim() : "";
  if (fromBody) return fromBody;
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.match(/^Bearer\s+(.+)$/i);
  if (bearer?.[1]) return bearer[1].trim();
  const headerKey = req.headers.get("x-api-key");
  if (headerKey) return headerKey.trim();
  return "";
}

/**
 * POST /api/external-leads/submit
 * Third-party website / ad form ingestion (e.g. Landlords Junction Properties).
 * Auth: `api_key` in JSON body, or `Authorization: Bearer sk_live_…`, or `x-api-key`.
 * Never 500 on partial payloads (soft_fail JSON with HTTP 200).
 */
export async function POST(req: Request) {
  try {
    let body: Record<string, unknown> = {};
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json(softFail("Malformed JSON body").body, { status: 200 });
    }

    const apiKey = extractApiKey(req, body);
    if (!apiKey) {
      return NextResponse.json(softFail("Missing api_key").body, { status: 200 });
    }

    const supabase = createAdminClient();
    const { data: client, error: clientErr } = await supabase
      .from("clients")
      .select(
        "id, name, dial_code, assignment_mode, is_active, is_archived, business_type, website_integration_api_key, send_prospect_confirmation"
      )
      .eq("website_integration_api_key", apiKey)
      .maybeSingle();

    if (clientErr || !client) {
      return NextResponse.json(softFail("Invalid api_key").body, { status: 200 });
    }
    if (client.is_active === false || client.is_archived === true) {
      return NextResponse.json(softFail("Client inactive").body, { status: 200 });
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const phoneRaw = typeof body.phone === "string" ? body.phone.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const listingReference =
      typeof body.listing_reference === "string" ? body.listing_reference.trim() : "";
    const agentReference =
      typeof body.agent_reference === "string" ? body.agent_reference.trim() : "";
    const enquiryTypeRaw =
      typeof body.enquiry_type === "string"
        ? body.enquiry_type.trim()
        : typeof body.type === "string"
          ? body.type.trim()
          : "";
    const dealSide =
      mapDealSide(body.deal_side) ?? mapDealSide(enquiryTypeRaw);

    if (!phoneRaw && !email && !name) {
      return NextResponse.json(
        softFail("Need at least name, phone, or email").body,
        { status: 200 }
      );
    }

    // Resolve listing by external_reference (e.g. LJP property slug) or address
    let listingId: string | null = null;
    if (listingReference) {
      const { data: byRef } = await supabase
        .from("listings")
        .select("id")
        .eq("client_id", client.id)
        .ilike("external_reference", listingReference)
        .limit(1)
        .maybeSingle();
      if (byRef) {
        listingId = byRef.id as string;
      } else {
        const { data: byAddr } = await supabase
          .from("listings")
          .select("id")
          .eq("client_id", client.id)
          .ilike("address", `%${listingReference}%`)
          .limit(1)
          .maybeSingle();
        if (byAddr) listingId = byAddr.id as string;
      }
    }

    // Match agent by phone (LJP agent_reference)
    let overrideAssigneeId: string | null = null;
    if (agentReference) {
      const { data: agents } = await fetchRoundRobinEligibleUsers(supabase, client.id as string, {
        activeOnly: true,
        select: "id, name, phone, role, also_sells, is_active",
      });
      const agentRows = (agents ?? []) as unknown as Array<{ id: string; phone: string | null }>;
      const match = agentRows.find((a) => phonesMatchLoose(a.phone, agentReference));
      if (match) overrideAssigneeId = match.id;
    }

    const source = mapSource(body.source);
    const formData: Record<string, unknown> = {
      name: name || "Website lead",
      phone: phoneRaw || undefined,
      email: email || undefined,
      message: message || undefined,
      listing_reference: listingReference || undefined,
      agent_reference: agentReference || undefined,
      enquiry_type: enquiryTypeRaw || undefined,
      deal_side: dealSide || undefined,
      website_origin: "external",
    };

    const result = await createLead({
      clientId: client.id as string,
      source,
      formData,
      overrideAssigneeId,
    });

    if (!result.ok) {
      return NextResponse.json(
        softFail(result.error || "Lead create failed", { code: result.code }).body,
        { status: 200 }
      );
    }

    const { data: leadRow } = await supabase
      .from("leads")
      .select("id, contact_id, assigned_to_id")
      .eq("id", result.leadId)
      .maybeSingle();

    const contactId = (leadRow?.contact_id as string | null) ?? null;

    // Link listing + deal_side on the lead
    const leadPatch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (listingId) leadPatch.linked_listing_id = listingId;
    if (dealSide) leadPatch.deal_side = dealSide;

    if (Object.keys(leadPatch).length > 1) {
      await supabase.from("leads").update(leadPatch).eq("id", result.leadId);
    }

    if (listingId && contactId) {
      const { data: contact } = await supabase
        .from("contacts")
        .select("interested_listing_ids")
        .eq("id", contactId)
        .maybeSingle();
      const next = appendInterestedListingIds(contact?.interested_listing_ids, listingId);
      await supabase
        .from("contacts")
        .update({ interested_listing_ids: next, updated_at: new Date().toISOString() })
        .eq("id", contactId);
    }

    background("external-leads-intelligence", async () => {
      try {
        await processLeadIntelligence(result.leadId);
      } catch (err) {
        console.error("[external-leads] intelligence failed:", err);
      }
    });

    return NextResponse.json({
      ok: true,
      lead_id: result.leadId,
      contact_id: contactId,
      assigned_to_id: (leadRow?.assigned_to_id as string | null) ?? null,
      agent_matched: Boolean(overrideAssigneeId),
      listing_linked: Boolean(listingId),
      deal_side: dealSide,
      enquiry_type: enquiryTypeRaw || null,
      duplicate: result.duplicate,
    });
  } catch (err) {
    console.error("[external-leads] unexpected:", err);
    return NextResponse.json(
      { ok: false, soft_fail: true, error: "Unexpected error — logged" },
      { status: 200 }
    );
  }
}
