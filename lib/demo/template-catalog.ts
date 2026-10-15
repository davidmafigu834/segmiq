import { ROSSI_ACTORS, ROSSI_WORKSPACE, type DemoActorKey, type DemoActorSeed } from "@/lib/demo/actors";
import { BSA_ACTORS, BSA_WORKSPACE } from "@/lib/demo/industries/vehicle-hire/bsa/identity";

export type DemoTemplateMeta = {
  industry: string;
  scenario: string;
  idPrefix: string;
  defaultPersona: DemoActorKey;
  actors: readonly DemoActorSeed[];
  intro: { headline: string; subtext: string } | null;
};

/**
 * Template identity only. Dataset builders stay out of this module so
 * Middleware does not load Node crypto through demo id generation.
 */
export const DEMO_TEMPLATE_CATALOG: readonly DemoTemplateMeta[] = [
  {
    industry: ROSSI_WORKSPACE.industry,
    scenario: ROSSI_WORKSPACE.scenario,
    idPrefix: "rossi",
    defaultPersona: "tinashe",
    actors: ROSSI_ACTORS,
    intro: null,
  },
  {
    industry: BSA_WORKSPACE.industry,
    scenario: BSA_WORKSPACE.scenario,
    idPrefix: "bsa",
    defaultPersona: "tariro",
    actors: BSA_ACTORS,
    intro: {
      headline: "Your sales operations, organised in one place.",
      subtext: "Explore how your two-person sales team could manage enquiries, quotations, follow-ups and bookings using SegmiQ.",
    },
  },
];

export function findDemoTemplate(industry: string | null | undefined, scenario: string | null | undefined): DemoTemplateMeta | null {
  if (!industry || !scenario) return null;
  return DEMO_TEMPLATE_CATALOG.find((template) => template.industry === industry && template.scenario === scenario) ?? null;
}
