/**
 * KPI grid class names shared by live company pages and their loading skeletons.
 * Changing a live page grid without updating this module (and the matching skeleton)
 * will fail `tests/company-skeletons.test.ts`.
 */
export const COMPANY_KPI_GRID = {
  dashboard:
    "dashboard-group relative z-[1] grid w-full grid-cols-1 gap-3 layout:grid-cols-[minmax(220px,0.9fr)_minmax(0,1.35fr)] layout:items-stretch",
  leads: "grid w-full grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6",
  pipeline:
    "dashboard-group relative z-[1] grid w-full grid-cols-1 gap-3 layout:grid-cols-[minmax(220px,0.9fr)_minmax(0,1.35fr)] layout:items-stretch",
  team:
    "dashboard-group relative z-[1] grid w-full grid-cols-1 gap-3 layout:grid-cols-[minmax(220px,0.9fr)_minmax(0,1.35fr)] layout:items-stretch",
  customers:
    "dashboard-group relative z-[1] grid w-full grid-cols-1 gap-3 layout:grid-cols-[minmax(220px,0.9fr)_minmax(0,1.35fr)] layout:items-stretch",
  quotations: "grid w-full min-w-0 grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5",
  calendar: "grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6",
  viewings: "grid w-full grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5",
  sources: "grid w-full grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5",
  offers: "grid w-full grid-cols-2 gap-3 md:grid-cols-4",
  transactions: "grid w-full grid-cols-2 gap-3 md:grid-cols-3",
  listings: "grid w-full grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5",
  websiteLeads: "grid w-full grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5",
  agentPerformance: "grid w-full grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5",
  marketing: "grid w-full grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5",
  feedback: "grid w-full grid-cols-2 gap-3 md:grid-cols-4",
  developments: "grid w-full grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5",
  compliance: "grid w-full grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5",
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
  viewings: 5,
  sources: 5,
  offers: 4,
  transactions: 3,
  listings: 5,
  websiteLeads: 5,
  agentPerformance: 5,
  marketing: 5,
  feedback: 3,
  developments: 5,
  compliance: 5,
  reports: 6,
} as const;
