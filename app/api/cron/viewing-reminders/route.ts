import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { executeViewingReminders } from "@/lib/real-estate/viewing-reminders";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Standalone T-30 viewing WhatsApp reminders for real-estate appointments. */
export async function GET(req: Request) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 503 });
  }
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const dryRun = url.searchParams.get("dryRun") === "1";
    const force = url.searchParams.get("force") === "1";
    const result = await executeViewingReminders({ dryRun, force });
    return NextResponse.json(result);
  } catch (e) {
    console.error("[cron viewing-reminders]", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
