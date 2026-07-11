import type { createAdminClient } from "@/lib/supabase/admin";
import {
  isMissingMagazineColumnError,
  projectListSelect,
  projectRowSelect,
} from "@/lib/cloud/project-columns";

type AdminClient = ReturnType<typeof createAdminClient>;

export async function fetchProjectsForClient(supabase: AdminClient, clientId: string) {
  const withMagazine = projectListSelect(true);
  let result = await supabase
    .from("projects")
    .select(withMagazine)
    .eq("client_id", clientId)
    .order("display_order", { ascending: true });

  if (result.error && isMissingMagazineColumnError(result.error.message)) {
    result = await supabase
      .from("projects")
      .select(projectListSelect(false))
      .eq("client_id", clientId)
      .order("display_order", { ascending: true });
  }

  return result;
}

export async function selectProjectRow(supabase: AdminClient, projectId: string, clientId: string) {
  const withMagazine = projectRowSelect(true);
  let result = await supabase
    .from("projects")
    .select(withMagazine)
    .eq("id", projectId)
    .eq("client_id", clientId)
    .single();

  if (result.error && isMissingMagazineColumnError(result.error.message)) {
    result = await supabase
      .from("projects")
      .select(projectRowSelect(false))
      .eq("id", projectId)
      .eq("client_id", clientId)
      .single();
  }

  return result;
}

export async function selectCreatedProjectRow(
  supabase: AdminClient,
  projectId: string,
  clientId: string
) {
  return selectProjectRow(supabase, projectId, clientId);
}
