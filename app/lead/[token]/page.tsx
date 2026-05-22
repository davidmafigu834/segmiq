import { createAdminClient } from "@/lib/supabase/admin";
import { MagicLinkErrorPage } from "@/components/magic/MagicLinkErrorPage";
import { MagicLinkExpiredPage } from "@/components/magic/MagicLinkExpiredPage";
import { MagicLinkActionView, type MagicCallLogRow, type MagicLeadForView } from "@/components/magic/MagicLinkActionView";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

function unwrapOne<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function normalizeCallLogs(raw: unknown): MagicCallLogRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => {
    const log = entry as MagicCallLogRow & { users?: { name: string } | { name: string }[] | null };
    let users = log.users ?? null;
    if (Array.isArray(users)) {
      users = users[0] ?? null;
    }
    return {
      ...log,
      users: users && typeof users.name === "string" ? { name: users.name } : null,
    };
  });
}

export default async function MagicLeadPage({ params }: { params: { token: string } }) {
  const supabase = createAdminClient();
  const { data: row } = await supabase
    .from("leads")
    .select(
      `id, name, phone, email, source, status, budget, project_type, timeline,
      form_data, created_at, magic_token_expires_at, client_id, assigned_to_id,
      clients (id, name, slug),
      assigned_to:users!assigned_to_id (id, name),
      call_logs (id, outcome, notes, follow_up_date, created_at, users (name))`
    )
    .eq("magic_token", params.token)
    .maybeSingle();

  if (!row) {
    return <MagicLinkErrorPage reason="invalid" />;
  }

  if (row.magic_token_expires_at && new Date(row.magic_token_expires_at as string) < new Date()) {
    return <MagicLinkExpiredPage token={params.token} />;
  }

  const logsRaw = (row as { call_logs?: unknown }).call_logs;
  const call_logs = normalizeCallLogs(logsRaw).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const lead: MagicLeadForView = {
    ...(row as Omit<MagicLeadForView, "clients" | "assigned_to" | "call_logs">),
    clients: unwrapOne((row as { clients?: MagicLeadForView["clients"] | MagicLeadForView["clients"][] }).clients),
    assigned_to: unwrapOne(
      (row as { assigned_to?: MagicLeadForView["assigned_to"] | MagicLeadForView["assigned_to"][] }).assigned_to
    ),
    call_logs,
  };

  return <MagicLinkActionView lead={lead} token={params.token} />;
}
