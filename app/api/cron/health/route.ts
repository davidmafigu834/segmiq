import { NextResponse, type NextRequest } from "next/server";
import { runHealthChecks } from "@/lib/health-checks";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 503 });
  }

  const results = await runHealthChecks();

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("status_checks").insert(
      results.map((r) => ({ component_key: r.key, ok: r.ok, latency_ms: r.latencyMs }))
    );
    if (error) throw error;
    const retainAfter = new Date(Date.now() - 14 * 86_400_000).toISOString();
    const { error: pruneError } = await supabase.from("status_checks").delete().lt("checked_at", retainAfter);
    if (pruneError) console.error("status_checks prune failed", pruneError);
  } catch (e) {
    console.error("status_checks insert failed", e);
    return NextResponse.json({ ok: false, error: "persist failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, checked: results.length });
}
