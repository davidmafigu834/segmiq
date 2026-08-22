/**
 * KPI grid class names shared by live company pages and their loading skeletons.
 * Changing a live page grid without updating this module (and the matching skeleton)
 * will fail `tests/company-skeletons.test.ts`.
 */
export const COMPANY_KPI_GRID = {
  dashboard: "grid w-full grid-cols-2 gap-3 min-[900px]:grid-cols-3 xl:grid-cols-6",
  leads: "grid w-full grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6",
  pipeline: "grid w-full grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6",
  team: "grid w-full grid-cols-2 gap-3 min-[900px]:grid-cols-3 xl:grid-cols-5",
  customers: "grid w-full grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5",
  quotations: "grid w-full min-w-0 grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5",
  calendar: "grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6",
  reports:
    "grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 md:grid-cols-[repeat(3,minmax(0,1fr))] layout:grid-cols-[repeat(6,minmax(0,1fr))]",
} as const;

export const COMPANY_KPI_COUNTS = {
  dashboard: 6,
  leads: 6,
  pipeline: 6,
  team: 5,
  customers: 5,
  quotations: 5,
  calendar: 6,
  reports: 6,
} as const;
