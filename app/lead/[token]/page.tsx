import { createAdminClient } from "@/lib/supabase/admin";
import { MagicLinkErrorPage } from "@/components/magic/MagicLinkErrorPage";
import { MagicLinkExpiredPage } from "@/components/magic/MagicLinkExpiredPage";
import { MagicLinkActionView, type MagicLeadForView } from "@/components/magic/MagicLinkActionView";
import { buildPublicMagicLeadPayload, PUBLIC_MAGIC_LEAD_SELECT } from "@/lib/leads/public-magic";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function MagicLeadPage({ params }: { params: { token: string } }) {
  const supabase = createAdminClient();
  const { data: row } = await supabase
    .from("leads")
    .select(PUBLIC_MAGIC_LEAD_SELECT)
    .eq("magic_token", params.token)
    .maybeSingle();

  if (!row) {
    return <MagicLinkErrorPage reason="invalid" />;
  }

  if (row.magic_token_expires_at && new Date(row.magic_token_expires_at as string) < new Date()) {
    return <MagicLinkExpiredPage token={params.token} />;
  }

  const payload = buildPublicMagicLeadPayload(row as Record<string, unknown>);
  const call_logs = payload.call_logs.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const lead: MagicLeadForView = {
    ...payload,
    call_logs,
  };

  return <MagicLinkActionView lead={lead} token={params.token} />;
}
