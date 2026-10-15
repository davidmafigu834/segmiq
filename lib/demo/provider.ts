import { harareDateKey } from "@/lib/demo/dates";
import { demoId } from "@/lib/demo/ids";
import { applyDemoMutations } from "@/lib/demo/mutations";
import { getGuestContext } from "@/lib/demo/context";
import { DemoAccessDenied } from "@/lib/demo/errors";
import { getWorkspaceConfig, type WorkspaceConfig } from "@/lib/demo/mode";
import { readSessionMutations } from "@/lib/demo/session-store";
import { readDemoMutations } from "@/lib/demo/store";
import { buildBsaDataset } from "@/lib/demo/industries/vehicle-hire/bsa/dataset";
import { buildRossiDataset } from "@/lib/demo/industries/tyres/rossi/dataset";
import { findDemoTemplate, type DemoTemplateMeta } from "@/lib/demo/template-catalog";
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
  actors: Record<string, DemoActor>;
  now?: Date;
}): DemoDataset | null {
  const template = findDemoTemplate(opts.industry, opts.scenario);
  const build = template ? demoDatasetBuilder(template) : null;
  if (!template || !build) return null;
  return build({
    now: opts.now,
    clientId: opts.clientId,
    actors: opts.actors,
  });
}

function demoDatasetBuilder(template: DemoTemplateMeta) {
  if (template.industry === "tyres" && template.scenario === "rossi") return buildRossiDataset;
  if (template.industry === "vehicle_hire" && template.scenario === "bsa_mobility") return buildBsaDataset;
  return null;
}

const snapshotCache = new Map<string, { at: number; dataset: DemoDataset }>();

export function clearDemoSnapshotCache(): void {
  snapshotCache.clear();
}

async function resolveActors(clientId: string, template: DemoTemplateMeta): Promise<Record<string, DemoActor>> {
  const guest = getGuestContext();
  const found = new Map<string, { id: string; name: string; role: DemoActor["role"]; phone: string }>();
  if (!guest) {
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
  }

  const actors: Record<string, DemoActor> = {};
  for (const seed of template.actors) {
    const row = found.get(seed.email);
    actors[seed.key] = {
      key: seed.key,
      id: guest || !row ? demoId(`${template.idPrefix}:actor:${seed.key}`) : row.id,
      name: seed.name,
      email: seed.email,
      role: seed.role,
      phone: row?.phone || seed.phone,
    };
  }
  return actors;
}

export async function resolveDemoPersona(clientId: string, personaKey: string): Promise<DemoActor | null> {
  const config = await getWorkspaceConfig(clientId);
  const template = findDemoTemplate(config?.industry, config?.scenario);
  if (!template?.actors.some((actor) => actor.key === personaKey)) return null;
  const actors = await resolveActors(clientId, template);
  return actors[personaKey] ?? null;
}

export async function loadDemoDatasetForClient(clientId: string, now = new Date()): Promise<DemoDataset | null> {
  const guest = getGuestContext();
  if (guest) {
    if (guest.clientId !== clientId) throw new DemoAccessDenied();
    const config = await getWorkspaceConfig(clientId);
    if (!config || config.mode !== "demo" || !findDemoTemplate(config.industry, config.scenario)) {
      throw new DemoAccessDenied();
    }
    const dataset = await loadFromConfig(config, now, { sessionId: guest.sessionId, strictTemplate: true });
    if (!dataset) throw new DemoAccessDenied();
    return dataset;
  }
  const config = await getWorkspaceConfig(clientId);
  if (!config || config.mode !== "demo") return null;
  return loadFromConfig(config, now, { sessionId: null, strictTemplate: false });
}

async function loadFromConfig(
  config: WorkspaceConfig,
  now: Date,
  scope: { sessionId: string | null; strictTemplate: boolean }
): Promise<DemoDataset | null> {
  const industry = scope.strictTemplate ? config.industry : config.industry ?? "tyres";
  const scenario = scope.strictTemplate ? config.scenario : config.scenario ?? "rossi";
  const template = findDemoTemplate(industry, scenario);
  if (!template) return null;
  const actors = await resolveActors(config.clientId, template);
  const mutations = scope.sessionId
    ? await readSessionMutations(scope.sessionId)
    : await readDemoMutations(config.clientId);
  const key = `${scope.sessionId ?? "org"}:${config.clientId}:${harareDateKey(now)}:${mutations.length}:${mutations.at(-1)?.id ?? "base"}`;
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
