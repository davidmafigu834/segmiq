import { NextResponse } from "next/server";
import { requireAgencyAdmin } from "@/lib/auth/permissions";
import { graphCall } from "@/lib/facebook/graph";
import { fbLog } from "@/lib/facebook/log";
import { loadClientFbGraphTokens } from "@/lib/facebook/client-tokens";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  const check = await requireAgencyAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");
  if (!clientId) {
    return NextResponse.json({ error: "clientId required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: client, error: cErr } = await supabase
    .from("clients")
    .select("fb_page_id")
    .eq("id", clientId)
    .maybeSingle();

  const { pageToken } = await loadClientFbGraphTokens(clientId, supabase);

  if (cErr || !pageToken || !client?.fb_page_id) {
    return NextResponse.json({ error: "Connect a Page first" }, { status: 400 });
  }

  const fields = encodeURIComponent("id,name,status");
  const result = await graphCall<{ data?: { id: string; name: string; status?: string }[] }>(
    `/${client.fb_page_id}/leadgen_forms?fields=${fields}`,
    pageToken,
    { clientId }
  );

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error.message, tokenExpired: result.tokenExpired },
      { status: 502 }
    );
  }

  const forms = result.data.data ?? [];
  fbLog("fb.form.listed", { clientId, count: forms.length });
  return NextResponse.json({ forms });
}
