import { NextResponse } from "next/server";
import { createLead } from "@/lib/leads/createLead";
import { createAdminClient } from "@/lib/supabase/admin";
import { appendInterestedListingIds, phonesMatchLoose } from "@/lib/real-estate/helpers";
import { fetchRoundRobinEligibleUsers } from "@/lib/auth/sales-capabilities";
import { processLeadIntelligence } from "@/lib/lead-intelligence";
import { background } from "@/lib/background";
import {
  listingLookupAllowed,
  mapWebsiteIngestDealSide,
  mapWebsiteIngestSource,
  websiteAttributionSourceType,
  websiteExternalLeadId,
  websiteUtmFromBody,
} from "@/lib/real-estate/website-ingest";
import {
  applyMappedBuyerRequirements,
  findExistingExternalLead,
  matchCampaignForIngest,
  recordFirstTouchAttribution,
} from "@/lib/real-estate/marketing-service";

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
 * Third-party website / ad form ingestion.
 * Auth: `api_key` in JSON body, or `Authorization: Bearer sk_live_…`, or `x-api-key`.
 * Never 500 on partial payloads (soft_fail JSON with HTTP 200).
 * Trades clients keep generic lead ingest. Listing/agent/deal_side apply only for real_estate.
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

    const isRealEstate = listingLookupAllowed(client.business_type);
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
    const dealSide = isRealEstate
      ? mapWebsiteIngestDealSide(body.deal_side) ?? mapWebsiteIngestDealSide(enquiryTypeRaw)
      : null;
    const utm = websiteUtmFromBody(body);
    const externalLeadId = websiteExternalLeadId(body);

    if (!phoneRaw && !email && !name) {
      return NextResponse.json(softFail("Need at least name, phone, or email").body, { status: 200 });
    }

    if (externalLeadId) {
      const existingLeadId = await findExistingExternalLead({
        clientId: client.id as string,
        provider: "website",
        externalLeadId,
      });
      if (existingLeadId) {
        return NextResponse.json({
          ok: true,
          lead_id: existingLeadId,
          duplicate: true,
          idempotent: true,
        });
      }
    }

    let listingId: string | null = null;
    if (isRealEstate && listingReference) {
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

    let overrideAssigneeId: string | null = null;
    if (isRealEstate && agentReference) {
      const { data: agents } = await fetchRoundRobinEligibleUsers(supabase, client.id as string, {
        activeOnly: true,
        select: "id, name, phone, role, also_sells, is_active",
      });
      const agentRows = (agents ?? []) as unknown as Array<{ id: string; phone: string | null }>;
      const match = agentRows.find((a) => phonesMatchLoose(a.phone, agentReference));
      if (match) overrideAssigneeId = match.id;
    }

    const campaign = isRealEstate
      ? await matchCampaignForIngest({
          clientId: client.id as string,
          listingId,
          externalCampaignId: typeof body.campaign_id === "string" ? body.campaign_id : null,
        })
      : null;
    if (campaign?.listing_id && !listingId) listingId = campaign.listing_id;
    if (campaign?.default_agent_id && !overrideAssigneeId) {
      overrideAssigneeId = campaign.default_agent_id;
    }

    const source = mapWebsiteIngestSource(body.source);
    const formData: Record<string, unknown> = {
      name: name || "Website lead",
      phone: phoneRaw || undefined,
      email: email || undefined,
      message: message || undefined,
      listing_reference: isRealEstate ? listingReference || undefined : undefined,
      agent_reference: isRealEstate ? agentReference || undefined : undefined,
      enquiry_type: enquiryTypeRaw || undefined,
      deal_side: dealSide || undefined,
      website_origin: "external",
      ...Object.fromEntries(
        Object.entries(utm).filter(([, v]) => Boolean(v))
      ),
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

    if (!result.duplicate) {
      const leadPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
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
          .eq("client_id", client.id)
          .maybeSingle();
        const next = appendInterestedListingIds(contact?.interested_listing_ids, listingId);
        await supabase
          .from("contacts")
          .update({ interested_listing_ids: next, updated_at: new Date().toISOString() })
          .eq("id", contactId)
          .eq("client_id", client.id);
      }

      let formPrequalified = false;
      if (isRealEstate && contactId) {
        const mapped = await applyMappedBuyerRequirements({
          clientId: client.id as string,
          contactId,
          formData: body,
        });
        formPrequalified = mapped.formPrequalified;
      }

      await recordFirstTouchAttribution({
        clientId: client.id as string,
        leadId: result.leadId,
        contactId,
        sourceType: websiteAttributionSourceType(source, body),
        campaignId: campaign?.id ?? null,
        campaignName: campaign?.name ?? (utm.utm_campaign || null),
        listingId,
        utm,
        landingPage: typeof body.landing_page === "string" ? body.landing_page : null,
        referrer: typeof body.referrer === "string" ? body.referrer : null,
        provider: "website",
        externalLeadId,
        formPrequalified,
        rawMetadata: {
          enquiry_type: enquiryTypeRaw || null,
        },
      });
    } else {
      await recordFirstTouchAttribution({
        clientId: client.id as string,
        leadId: result.leadId,
        contactId,
        sourceType: websiteAttributionSourceType(source, body),
      });
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
