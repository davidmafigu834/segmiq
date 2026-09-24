/**
 * Server-only identity of the Rossi Tyres demo organisation.
 * Login passwords are never stored here. The seed script reads
 * DEMO_ROSSI_PASSWORD from the environment.
 */

export const ROSSI_WORKSPACE = {
  slug: "rossi-tyres",
  name: "Rossi Tyres",
  industry: "tyres",
  scenario: "rossi",
  timezone: "Africa/Harare",
  businessSummary: "Tyre retail and fleet supply",
} as const;

export type DemoActorKey = "tendai" | "tinashe" | "rudo" | "tanaka";

export type DemoActorSeed = {
  key: DemoActorKey;
  name: string;
  email: string;
  role: "CLIENT_MANAGER" | "SALESPERSON";
  phone: string;
};

export const ROSSI_ACTORS: readonly DemoActorSeed[] = [
  {
    key: "tendai",
    name: "Tendai Muchengeti",
    email: "tendai.muchengeti@rossi.demo",
    role: "CLIENT_MANAGER",
    phone: "+263772410001",
  },
  {
    key: "tinashe",
    name: "Tinashe Moyo",
    email: "tinashe.moyo@rossi.demo",
    role: "SALESPERSON",
    phone: "+263772410002",
  },
  {
    key: "rudo",
    name: "Rudo Chikore",
    email: "rudo.chikore@rossi.demo",
    role: "SALESPERSON",
    phone: "+263772410003",
  },
  {
    key: "tanaka",
    name: "Tanaka Ncube",
    email: "tanaka.ncube@rossi.demo",
    role: "SALESPERSON",
    phone: "+263772410004",
  },
];

export function rossiActorByEmail(email: string): DemoActorSeed | undefined {
  const normalized = email.trim().toLowerCase();
  return ROSSI_ACTORS.find((actor) => actor.email === normalized);
}
