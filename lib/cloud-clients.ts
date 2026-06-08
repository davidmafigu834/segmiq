import { createAdminClient } from "@/lib/supabase/admin";
import type { CloudClientRow } from "@/app/(agency)/dashboard/cloud-clients/CloudClientsClient";

type CloudClientDbRow = CloudClientRow & { signup_source?: string | null };

function isMissingColumnError(error: { message?: string } | null, column: string): boolean {
  const msg = error?.message ?? "";
  return msg.includes(`column clients.${column} does not exist`) || msg.includes(`'${column}'`);
}

async function queryClients(select: string) {
  const supabase = createAdminClient();
  return supabase
    .from("clients")
    .select(select)
    .or("is_archived.is.null,is_archived.eq.false")
    .order("created_at", { ascending: false });
}

export async function fetchCloudClientsForAdmin(): Promise<{
  clients: CloudClientRow[];
  queryError?: string;
}> {
  const selects = [
    `
      id, name, plan, billing_period, payment_status, next_payment_date, payment_notes,
      created_at, is_active, signup_source,
      users (id, name, email, role, created_at),
      projects (id, project_media (file_size_bytes))
    `,
    `
      id, name, plan, billing_period, payment_status, next_payment_date, payment_notes,
      created_at, is_active,
      users (id, name, email, role, created_at),
      projects (id, project_media (file_size_bytes))
    `,
    `
      id, name, plan, created_at, is_active,
      users (id, name, email, role, created_at)
    `,
  ];

  let result: Awaited<ReturnType<typeof queryClients>> | null = null;
  for (const select of selects) {
    result = await queryClients(select);
    if (!result.error) break;
    console.error("[cloud-clients] query failed:", result.error.message);
    const recoverable =
      isMissingColumnError(result.error, "signup_source") ||
      isMissingColumnError(result.error, "billing_period") ||
      isMissingColumnError(result.error, "payment_status") ||
      isMissingColumnError(result.error, "next_payment_date") ||
      isMissingColumnError(result.error, "payment_notes") ||
      isMissingColumnError(result.error, "projects") ||
      result.error.message.includes("project_media");
    if (!recoverable) break;
  }

  if (!result || result.error) {
    return { clients: [], queryError: result?.error?.message ?? "Failed to load clients" };
  }

  const rows = (result.data ?? []) as unknown as CloudClientDbRow[];
  const hasSignupSource = rows.some((r) => r.signup_source != null);

  let cloudRows: CloudClientDbRow[];
  if (hasSignupSource) {
    cloudRows = rows.filter((r) => r.signup_source === "cloud");
  } else {
    cloudRows = rows.filter(
      (r) => Array.isArray(r.users) && r.users.some((u) => u.role === "CLIENT_MANAGER")
    );
    if (cloudRows.length > 0) {
      const supabase = createAdminClient();
      const { data: schemas } = await supabase
        .from("form_schemas")
        .select("client_id")
        .in(
          "client_id",
          cloudRows.map((c) => c.id)
        );
      const agencyIds = new Set((schemas ?? []).map((s) => s.client_id as string));
      cloudRows = cloudRows.filter((c) => !agencyIds.has(c.id));
    }
  }

  return { clients: cloudRows };
}
