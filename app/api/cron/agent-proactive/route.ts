import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { runProactiveWorker } from "@/lib/agent/proactive";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Manual / ops trigger. Minute execution piggybacks on `/api/cron/check-followups`. */
export async function GET(req: Request) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 503 });
  }
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runProactiveWorker();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[cron agent-proactive]", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
