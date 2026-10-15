import type { DemoActorKey } from "@/lib/demo/actors";
import type { DemoGuestRole } from "@/lib/demo/allowlist";
import { findDemoTemplate } from "@/lib/demo/template-catalog";

export type DemoPersona = {
  key: DemoActorKey;
  name: string;
  role: DemoGuestRole;
};

/** Personas registered for one industry template. Unknown templates have none. */
export function demoPersonasForTemplate(industry: string | null, scenario: string | null): DemoPersona[] {
  const template = findDemoTemplate(industry, scenario);
  if (!template) return [];
  return template.actors.map((actor) => ({
    key: actor.key,
    name: actor.name,
    role: actor.role,
  }));
}

export function defaultDemoPersona(industry: string | null, scenario: string | null): DemoActorKey | null {
  return findDemoTemplate(industry, scenario)?.defaultPersona ?? null;
}

export function findDemoPersona(
  industry: string | null,
  scenario: string | null,
  key: string
): DemoPersona | null {
  return demoPersonasForTemplate(industry, scenario).find((persona) => persona.key === key) ?? null;
}

export const DEFAULT_DEMO_PERSONA: DemoActorKey = "tinashe";
