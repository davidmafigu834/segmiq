import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAgencyAdmin } from "@/lib/auth/permissions";
import { fbLog } from "@/lib/facebook/log";
import { loadClientFbGraphTokens } from "@/lib/facebook/client-tokens";

export async function POST(req: Request) {
  const check = await requireAgencyAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  let body: { clientId?: string; adAccountId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { clientId, adAccountId } = body;
  if (!clientId || !adAccountId) {
    return NextResponse.json({ error: "clientId and adAccountId required" }, { status: 400 });
  }

  const normalized = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;

  const { pageToken, userToken } = await loadClientFbGraphTokens(clientId);
  if (!(userToken || pageToken)) {
    return NextResponse.json({ error: "Not connected" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error: upErr } = await supabase
    .from("clients")
    .update({
      fb_ad_account_id: normalized,
      updated_at: new Date().toISOString(),
    })
    .eq("id", clientId);

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  fbLog("fb.ad_account.selected", { clientId, adAccountId: normalized });
  return NextResponse.json({ ok: true, fb_ad_account_id: normalized });
}
