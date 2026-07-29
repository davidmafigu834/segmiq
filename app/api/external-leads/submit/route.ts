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
import type { LeadSource } from "@/types";

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

/**
 * POST /api/external-leads/submit
 * Third-party website / ad form ingestion. Never 500 on partial payloads.
 */
export async function POST(req: Request) {
  try {
    let body: Record<string, unknown> = {};
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json(softFail("Malformed JSON body").body, { status: 200 });
    }

    const apiKey = typeof body.api_key === "string" ? body.api_key.trim() : "";
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

    if (!phoneRaw && !email && !name) {
      return NextResponse.json(
        softFail("Need at least name, phone, or email").body,
        { status: 200 }
      );
    }

    // Resolve listing by address or external_reference
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

    // Match agent by phone
    let overrideAssigneeId: string | null = null;
    if (agentReference) {
      const { data: agents } = await fetchRoundRobinEligibleUsers(supabase, client.id as string, {
        activeOnly: true,
        select: "id, name, phone, role, also_sells, is_active",
      });
      // Dynamic select string makes Supabase return GenericStringError; cast the shape we asked for.
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

    // Link listing interest + optional lead fields
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

      await supabase
        .from("leads")
        .update({
          linked_listing_id: listingId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", result.leadId);
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
