import { createAdminClient } from "@/lib/supabase/admin";

export type StatusIncident = {
  id: string;
  title: string;
  body: string;
  severity: "minor" | "major" | "critical";
  component_key: string | null;
  started_at: string;
  resolved_at: string | null;
};

export async function listIncidents(): Promise<StatusIncident[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("status_incidents")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as StatusIncident[];
}

export async function createIncident(input: {
  title: string;
  body: string;
  severity?: "minor" | "major" | "critical";
  componentKey?: string;
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("status_incidents")
    .insert({
      title: input.title,
      body: input.body,
      severity: input.severity ?? "minor",
      component_key: input.componentKey ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as StatusIncident;
}

export async function resolveIncident(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("status_incidents")
    .update({ resolved_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
