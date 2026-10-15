import type { VehicleHireActorKey } from "@/lib/demo/actors";
import type { DemoActorSeed } from "@/lib/demo/actors";

/**
 * Fictional BSA Mobility demonstration.
 * The owner persona is an overview seat, not a third salesperson.
 */
export const BSA_WORKSPACE = {
  slug: "bsa-mobility",
  name: "BSA Mobility Solutions",
  industry: "vehicle_hire",
  scenario: "bsa_mobility",
  timezone: "Africa/Harare",
  businessSummary: "Executive mobility, luxury vehicle hire and chauffeur services.",
  tagline: "The Apex of Motion",
  location: "Harare, Zimbabwe",
} as const;

export const BSA_ACTORS: readonly (DemoActorSeed & { key: VehicleHireActorKey })[] = [
  {
    key: "owner",
    name: "Owner view",
    email: "owner.view@bsa.demo",
    role: "CLIENT_MANAGER",
    phone: "+263000000001",
  },
  {
    key: "tariro",
    name: "Tariro Dube",
    email: "tariro.dube@bsa.demo",
    role: "SALESPERSON",
    phone: "+263000000002",
  },
  {
    key: "munashe",
    name: "Munashe Moyo",
    email: "munashe.moyo@bsa.demo",
    role: "SALESPERSON",
    phone: "+263000000003",
  },
];
