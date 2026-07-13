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

async function fetchCloudMembershipSets(clientIds: string[]) {
  if (clientIds.length === 0) {
    return {
      projectClientIds: new Set<string>(),
      formSchemaClientIds: new Set<string>(),
    };
  }

  const supabase = createAdminClient();
  const [projectsResult, schemasResult] = await Promise.all([
    supabase.from("projects").select("client_id").in("client_id", clientIds),
    supabase.from("form_schemas").select("client_id").in("client_id", clientIds),
  ]);

  return {
    projectClientIds: new Set(
      (projectsResult.data ?? []).map((row) => row.client_id as string)
    ),
    formSchemaClientIds: new Set(
      (schemasResult.data ?? []).map((row) => row.client_id as string)
    ),
  };
}

/** Cloud tenants: self-signup, project activity, or CRM-free manager accounts. */
export function isCloudSubscriptionClient(
  row: CloudClientDbRow,
  projectClientIds: Set<string>,
  formSchemaClientIds: Set<string>
): boolean {
  if (row.signup_source === "cloud") return true;
  if (projectClientIds.has(row.id)) return true;
  if (Array.isArray(row.projects) && row.projects.length > 0) return true;

  const hasManager =
    Array.isArray(row.users) && row.users.some((user) => user.role === "CLIENT_MANAGER");
  return hasManager && !formSchemaClientIds.has(row.id);
}

export async function fetchCloudClientsForAdmin(): Promise<{
  clients: CloudClientRow[];
  queryError?: string;
}> {
  // clients↔users has two FKs (users.client_id and clients.fb_connected_by_user_id) — hint required.
  const usersEmbed = "users!users_client_id_fkey (id, name, email, role, created_at)";
  const selects = [
    `
      id, name, plan, billing_period, payment_status, next_payment_date, payment_notes,
      created_at, is_active, signup_source,
      ${usersEmbed},
      projects (id, project_media!project_media_project_id_fkey (file_size_bytes))
    `,
    `
      id, name, plan, billing_period, payment_status, next_payment_date, payment_notes,
      created_at, is_active,
      ${usersEmbed},
      projects (id, project_media!project_media_project_id_fkey (file_size_bytes))
    `,
    `
      id, name, plan, created_at, is_active,
      ${usersEmbed}
    `,
  ];

  let result: Awaited<ReturnType<typeof queryClients>> | null = null;
  let hasSignupSource = false;

  for (const select of selects) {
    result = await queryClients(select);
    if (!result.error) {
      hasSignupSource = select.includes("signup_source");
      break;
    }
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
  const { projectClientIds, formSchemaClientIds } = await fetchCloudMembershipSets(
    rows.map((row) => row.id)
  );

  let cloudRows: CloudClientDbRow[];
  if (hasSignupSource) {
    cloudRows = rows.filter((row) =>
      isCloudSubscriptionClient(row, projectClientIds, formSchemaClientIds)
    );
  } else {
    cloudRows = rows.filter(
      (row) => Array.isArray(row.users) && row.users.some((user) => user.role === "CLIENT_MANAGER")
    );
    if (cloudRows.length > 0) {
      const agencyIds = formSchemaClientIds;
      cloudRows = cloudRows.filter((row) => !agencyIds.has(row.id));
    }
  }

  return { clients: cloudRows };
}
