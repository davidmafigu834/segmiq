import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAgencyAdmin } from "@/lib/auth/permissions";
import { fbLog } from "@/lib/facebook/log";

export async function POST(req: Request) {
  const check = await requireAgencyAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  let body: { clientId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { clientId } = body;
  if (!clientId) {
    return NextResponse.json({ error: "clientId required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("clients")
    .update({
      fb_access_token: null,
      fb_user_access_token: null,
      fb_access_token_expires_at: null,
      fb_page_id: null,
      fb_page_name: null,
      fb_form_id: null,
      fb_form_name: null,
      fb_form_questions: null,
      fb_qualification_enabled: false,
      fb_qualification_rules: null,
      fb_ad_account_id: null,
      fb_webhook_verified: false,
      fb_token_expired_at: null,
      fb_connected_at: null,
      fb_connected_by_user_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", clientId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  fbLog("fb.disconnect.complete", { clientId });
  return NextResponse.json({ ok: true });
}
