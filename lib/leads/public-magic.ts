import type { LeadSource, LeadStatus } from "@/types";

export const PUBLIC_MAGIC_LEAD_SELECT = `
  id, name, phone, email, source, status, budget, project_type, timeline,
  form_data, created_at, magic_token_expires_at, client_id, assigned_to_id,
  clients!leads_client_id_fkey (id, name, slug),
  assigned_to:users!assigned_to_id (id, name),
  call_logs (id, outcome, notes, follow_up_date, created_at, users (name))
`;

export type PublicMagicLeadPayload = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  source: LeadSource;
  status: LeadStatus;
  budget: string | null;
  project_type: string | null;
  timeline: string | null;
  form_data: Record<string, unknown> | null;
  created_at: string;
  magic_token_expires_at: string | null;
  client_id: string;
  assigned_to_id: string | null;
  clients: { id: string; name: string; slug: string } | null;
  assigned_to: { id: string; name: string } | null;
  call_logs: Array<{
    id: string;
    outcome: string;
    notes: string | null;
    follow_up_date: string | null;
    created_at: string;
    users: { name: string } | null;
  }>;
};

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function normalizeCallLogs(raw: unknown): PublicMagicLeadPayload["call_logs"] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => {
    const log = entry as {
      id?: string;
      outcome?: string;
      notes?: string | null;
      follow_up_date?: string | null;
      created_at?: string;
      users?: { name?: string } | Array<{ name?: string }> | null;
    };
    const user = unwrapOne(log.users);
    return {
      id: String(log.id ?? ""),
      outcome: String(log.outcome ?? ""),
      notes: (log.notes as string | null | undefined) ?? null,
      follow_up_date: (log.follow_up_date as string | null | undefined) ?? null,
      created_at: String(log.created_at ?? ""),
      users: user?.name ? { name: user.name } : null,
    };
  });
}

export function buildPublicMagicLeadPayload(row: Record<string, unknown>): PublicMagicLeadPayload {
  return {
    id: row.id as string,
    name: (row.name as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    source: row.source as LeadSource,
    status: row.status as LeadStatus,
    budget: (row.budget as string | null) ?? null,
    project_type: (row.project_type as string | null) ?? null,
    timeline: (row.timeline as string | null) ?? null,
    form_data: (row.form_data as Record<string, unknown> | null) ?? null,
    created_at: row.created_at as string,
    magic_token_expires_at: (row.magic_token_expires_at as string | null) ?? null,
    client_id: row.client_id as string,
    assigned_to_id: (row.assigned_to_id as string | null) ?? null,
    clients: unwrapOne(row.clients as { id: string; name: string; slug: string } | Array<{ id: string; name: string; slug: string }> | null),
    assigned_to: unwrapOne(row.assigned_to as { id: string; name: string } | Array<{ id: string; name: string }> | null),
    call_logs: normalizeCallLogs(row.call_logs),
  };
}
