import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isCommercialFlagEnabled } from "@/lib/commercial/flags";
import { loadDocumentCompanySettings } from "@/lib/documents/settings";
import { isRealEstate } from "@/lib/terminology";
import type { WorkProjectActor } from "@/lib/work-projects/access";
import { listWorkProjects, loadWorkProjectWorkspace } from "@/lib/work-projects/service";

export async function tradesProjectActor(): Promise<WorkProjectActor & { clientId: string }> {
  const session = await getServerSession(authOptions);
  if (!session?.userId || !session.clientId) redirect("/login");
  const supabase = createAdminClient();
  const { data: client } = await supabase
    .from("clients")
    .select("business_type")
    .eq("id", session.clientId)
    .maybeSingle();
  if (isRealEstate(client?.business_type as string | null)) {
    redirect(session.role === "SALESPERSON" ? "/sales/dashboard" : "/client/dashboard");
  }
  return {
    userId: session.userId,
    role: session.role,
    clientId: session.clientId,
  };
}

export async function companyOwners(clientId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("users")
    .select("id, name")
    .eq("client_id", clientId)
    .in("role", ["CLIENT_MANAGER", "SALESPERSON"])
    .order("name");
  return (data ?? []) as Array<{ id: string; name: string | null }>;
}

export async function documentsEnabledFor(clientId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase.from("clients").select("commercial_flags").eq("id", clientId).maybeSingle();
  const flagged = isCommercialFlagEnabled(data?.commercial_flags, "documents.enabled");
  const settings = await loadDocumentCompanySettings(clientId);
  return Boolean(flagged && settings.enabled);
}

export async function loadProjectList(actor: WorkProjectActor) {
  const result = await listWorkProjects(actor, {});
  if (!result.ok) return [];
  return result.data;
}

export async function loadProjectOrNotFound(actor: WorkProjectActor, projectId: string) {
  const result = await loadWorkProjectWorkspace(actor, projectId);
  if (!result.ok) notFound();
  return result.data;
}
