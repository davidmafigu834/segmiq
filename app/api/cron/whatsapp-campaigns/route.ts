import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { processActiveCampaigns } from "@/lib/marketing/campaign-send";
import { runJourneyEngine } from "@/lib/marketing/journeys";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncTemplateStatuses } from "@/lib/marketing/template-manager";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 503 });
  }
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [result, journeys] = await Promise.all([
      processActiveCampaigns(),
      runJourneyEngine(),
    ]);

    const supabase = createAdminClient();
    const { data: clients } = await supabase
      .from("clients")
      .select("id")
      .eq("is_active", true)
      .eq("is_archived", false);

    let templatesSynced = 0;
    for (const client of clients ?? []) {
      templatesSynced += await syncTemplateStatuses(client.id as string);
    }

    return NextResponse.json({ ok: true, ...result, journeys, templatesSynced });
  } catch (e) {
    console.error("[cron whatsapp-campaigns]", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
