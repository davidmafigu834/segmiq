import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRoles } from "@/lib/api-guards";
import { maskRecipient } from "@/lib/messaging/mask";

export const dynamic = "force-dynamic";

export async function GET() {
  const g = await requireRoles(["SUPER_ADMIN"]);
  if ("error" in g) return g.error;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("message_logs")
    .select(
      "id, created_at, notification_type, channel, recipient, status, error_message, error_code, template_key, lead_id"
    )
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []).map((r) => ({
    ...r,
    recipient_masked: maskRecipient(String((r as { recipient?: string }).recipient ?? "")),
  }));

  return NextResponse.json({ logs: rows });
}
