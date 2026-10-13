import { ROSSI_ACTORS, type DemoActorKey } from "@/lib/demo/actors";
import type { DemoGuestRole } from "@/lib/demo/allowlist";

export type DemoPersona = {
  key: DemoActorKey;
  name: string;
  role: DemoGuestRole;
};

/** Phase 2A personas are the Rossi Tyres actors already defined for the dataset. */
export function demoPersonasForTemplate(industry: string | null, scenario: string | null): DemoPersona[] {
  if (industry !== "tyres" || scenario !== "rossi") return [];
  return ROSSI_ACTORS.map((actor) => ({
    key: actor.key,
    name: actor.name,
    role: actor.role,
  }));
}

export function findDemoPersona(
  industry: string | null,
  scenario: string | null,
  key: string
): DemoPersona | null {
  return demoPersonasForTemplate(industry, scenario).find((persona) => persona.key === key) ?? null;
}

export const DEFAULT_DEMO_PERSONA: DemoActorKey = "tinashe";
