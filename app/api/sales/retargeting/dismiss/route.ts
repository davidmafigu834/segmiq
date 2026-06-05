import { NextResponse } from "next/server";
import { requireRoles } from "@/lib/api-guards";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const guard = await requireRoles(["SALESPERSON"]);
  if (guard.error) return guard.error;

  const body = await req.json().catch(() => ({}));
  const clientId = body.clientId as string | undefined;
  if (!clientId) {
    return NextResponse.json({ error: "clientId required" }, { status: 400 });
  }

  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const supabase = createAdminClient();
  await supabase.from("retargeting_audience_state").upsert(
    {
      client_id: clientId,
      banner_dismissed_until: end.toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "client_id" }
  );

  return NextResponse.json({ ok: true });
}
