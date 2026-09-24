import { ROSSI_ACTORS, type DemoActorKey } from "@/lib/demo/actors";
import { buildRossiDataset } from "@/lib/demo/industries/tyres/rossi/dataset";
import { harareDateKey } from "@/lib/demo/dates";
import { demoId } from "@/lib/demo/ids";
import { applyDemoMutations } from "@/lib/demo/mutations";
import { getWorkspaceConfig, type WorkspaceConfig } from "@/lib/demo/mode";
import { readDemoMutations } from "@/lib/demo/store";
import type { DemoActor, DemoDataset, DemoWorkspaceRef } from "@/lib/demo/types";

export type DataProvider =
  | { kind: "production" }
  | { kind: "demo"; industry: string; scenario: string };

export function getDataProvider(workspace: DemoWorkspaceRef | null | undefined): DataProvider {
  const mode = workspace?.workspace_mode ?? workspace?.mode;
  if (mode !== "demo") return { kind: "production" };
  return {
    kind: "demo",
    industry: workspace?.demo_industry ?? workspace?.industry ?? "tyres",
    scenario: workspace?.demo_scenario ?? workspace?.scenario ?? "rossi",
  };
}

export function materializeDemoDataset(opts: {
  industry: string;
  scenario: string;
  clientId: string;
  actors: Record<DemoActorKey, DemoActor>;
  now?: Date;
}): DemoDataset | null {
  if (opts.industry === "tyres" && opts.scenario === "rossi") {
    return buildRossiDataset({
      now: opts.now,
      clientId: opts.clientId,
      actors: opts.actors,
    });
  }
  return null;
}

const snapshotCache = new Map<string, { at: number; dataset: DemoDataset }>();

export function clearDemoSnapshotCache(): void {
  snapshotCache.clear();
}

async function resolveActors(clientId: string): Promise<Record<DemoActorKey, DemoActor>> {
  const found = new Map<string, { id: string; name: string; role: DemoActor["role"]; phone: string }>();
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("users")
      .select("id, name, email, role, phone")
      .eq("client_id", clientId);
    for (const row of data ?? []) {
      const email = String((row as { email?: string }).email ?? "").toLowerCase();
      found.set(email, {
        id: String((row as { id: string }).id),
        name: String((row as { name?: string }).name ?? ""),
        role: ((row as { role?: DemoActor["role"] }).role ?? "SALESPERSON") as DemoActor["role"],
        phone: String((row as { phone?: string | null }).phone ?? ""),
      });
    }
  } catch {
    // Deterministic ids keep tests and offline renders stable.
  }

  const actors = {} as Record<DemoActorKey, DemoActor>;
  for (const seed of ROSSI_ACTORS) {
    const row = found.get(seed.email);
    actors[seed.key] = {
      key: seed.key,
      id: row?.id ?? demoId(`rossi:actor:${seed.key}`),
      name: seed.name,
      email: seed.email,
      role: seed.role,
      phone: row?.phone || seed.phone,
    };
  }
  return actors;
}

export async function loadDemoDatasetForClient(clientId: string, now = new Date()): Promise<DemoDataset | null> {
  const config = await getWorkspaceConfig(clientId);
  if (!config || config.mode !== "demo") return null;
  return loadFromConfig(config, now);
}

async function loadFromConfig(config: WorkspaceConfig, now: Date): Promise<DemoDataset | null> {
  const industry = config.industry ?? "tyres";
  const scenario = config.scenario ?? "rossi";
  const actors = await resolveActors(config.clientId);
  const mutations = await readDemoMutations(config.clientId);
  const key = `${config.clientId}:${harareDateKey(now)}:${mutations.length}:${mutations.at(-1)?.id ?? "base"}`;
  const cached = snapshotCache.get(key);
  if (cached && Date.now() - cached.at < 20_000) return cached.dataset;

  const base = materializeDemoDataset({
    industry,
    scenario,
    clientId: config.clientId,
    actors,
    now,
  });
  if (!base) return null;
  const dataset = applyDemoMutations(base, mutations);
  snapshotCache.set(key, { at: Date.now(), dataset });
  return dataset;
}

export const DEMO_UNSUPPORTED = "This feature is not included in this demo workspace.";
