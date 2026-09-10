import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAgencyAdmin } from "@/lib/auth/permissions";
import {
  fetchClientCampaigns,
  bustCampaignsCache,
  type FbCampaignsDatePreset,
  type ClientCampaignsRow,
} from "@/lib/facebook/campaigns";
import { loadClientFbGraphTokens } from "@/lib/facebook/client-tokens";

export const dynamic = "force-dynamic";

function parsePreset(v: string | null): FbCampaignsDatePreset {
  if (v === "last_7d" || v === "last_30d" || v === "lifetime") return v;
  return "last_30d";
}

export async function GET(req: Request) {
  const check = await requireAgencyAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const url = new URL(req.url);
  const filterIds = url.searchParams.getAll("clientId").filter(Boolean);
  const datePreset = parsePreset(url.searchParams.get("datePreset"));
  const refresh = url.searchParams.get("refresh") === "1";

  const supabase = createAdminClient();

  let q = supabase
    .from("clients")
    .select("id, name, fb_access_token, fb_user_access_token, fb_ad_account_id")
    .not("fb_access_token", "is", null)
    .not("fb_ad_account_id", "is", null);

  if (filterIds.length > 0) {
    q = q.in("id", filterIds);
  }

  const { data: clients, error: dbErr } = await q;
  if (dbErr) {
    return NextResponse.json({ error: dbErr.message }, { status: 500 });
  }

  const rows = (clients ?? []) as (ClientCampaignsRow & { name: string })[];

  if (rows.length === 0 && filterIds.length === 1) {
    const { data: one } = await supabase
      .from("clients")
      .select("id, name, fb_access_token, fb_user_access_token, fb_ad_account_id")
      .eq("id", filterIds[0])
      .maybeSingle();
    if (one) {
      const tokens = await loadClientFbGraphTokens(one.id as string, supabase);
      const token = tokens.userToken || tokens.pageToken;
      let err = "Not connected";
      if (token && !(one.fb_ad_account_id as string | null)) {
        err = "Ad account not selected";
      } else if (!token) {
        err = "Not connected";
      }
      return NextResponse.json({
        clients: [
          {
            clientId: one.id as string,
            clientName: one.name as string,
            error: err,
            campaigns: [],
          },
        ],
        datePreset,
      });
    }
  }

  const results = await Promise.all(
    rows.map(async (c) => {
      if (refresh) {
        bustCampaignsCache(c.id);
      }
      const tokens = await loadClientFbGraphTokens(c.id, supabase);
      const revealed: ClientCampaignsRow = {
        id: c.id,
        fb_access_token: tokens.pageToken,
        fb_user_access_token: tokens.userToken,
        fb_ad_account_id: c.fb_ad_account_id,
      };
      const { campaigns, error: fetchErr } = await fetchClientCampaigns(revealed, datePreset, {
        bypassCache: refresh,
      });
      return {
        clientId: c.id,
        clientName: c.name,
        error: fetchErr,
        campaigns,
      };
    })
  );

  return NextResponse.json(
    { clients: results, datePreset },
    { headers: { "Cache-Control": "private, max-age=0" } }
  );
}
