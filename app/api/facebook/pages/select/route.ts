import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAgencyAdmin } from "@/lib/auth/permissions";
import { graphCall } from "@/lib/facebook/graph";
import { fbLog } from "@/lib/facebook/log";
import { loadClientFbGraphTokens, sealAndStoreFbTokens } from "@/lib/facebook/client-tokens";

export async function POST(req: Request) {
  const check = await requireAgencyAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  let body: { clientId?: string; pageId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { clientId, pageId } = body;
  if (!clientId || !pageId) {
    return NextResponse.json({ error: "clientId and pageId required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { pageToken, userToken } = await loadClientFbGraphTokens(clientId, supabase);
  const graphUserToken = userToken || pageToken;
  if (!graphUserToken) {
    return NextResponse.json({ error: "Not connected" }, { status: 400 });
  }

  const preservedUserToken = userToken || pageToken;

  const pageFields = encodeURIComponent("id,name,access_token");
  const pageRes = await graphCall<{ id?: string; name?: string; access_token?: string }>(
    `/${pageId}?fields=${pageFields}`,
    graphUserToken,
    { clientId }
  );

  if (!pageRes.ok) {
    return NextResponse.json(
      { error: pageRes.error.message, tokenExpired: pageRes.tokenExpired },
      { status: 502 }
    );
  }

  const page = pageRes.data;
  if (!page.access_token || !page.id) {
    return NextResponse.json({ error: "No page token" }, { status: 500 });
  }

  const subBody = new URLSearchParams({ subscribed_fields: "leadgen" });
  const subRes = await graphCall<{ success?: boolean }>(`/${pageId}/subscribed_apps`, page.access_token, {
    method: "POST",
    body: subBody,
    clientId,
  });

  const webhookOk = subRes.ok && ((subRes.data as { success?: boolean }).success ?? true);

  if (!subRes.ok && subRes.error.message) {
    console.warn("[facebook pages/select] subscribed_apps:", subRes.error.message);
  }

  await sealAndStoreFbTokens(supabase, clientId, {
    fb_access_token: page.access_token,
    fb_user_access_token: preservedUserToken,
    fb_page_id: page.id,
    fb_page_name: page.name ?? null,
    fb_webhook_verified: webhookOk,
    updated_at: new Date().toISOString(),
  });

  fbLog("fb.page.selected", { clientId, pageId: page.id });
  return NextResponse.json({ ok: true, pageName: page.name });
}
