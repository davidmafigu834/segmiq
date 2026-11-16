import type { Screen } from "./nav";

export type Mark = "overdue" | "today" | "waiting";

export const COMPANIES = [
  { id: "sunline", name: "Sunline Solar", place: "Harare", preset: "Solar Installation" },
  { id: "westgate", name: "Westgate Energy", place: "Harare", preset: "Solar Installation" },
  { id: "highlands", name: "Highlands Solar", place: "Bulawayo", preset: "Solar Installation" },
] as const;

export type CompanyId = (typeof COMPANIES)[number]["id"];

export function companyById(id: string | null | undefined) {
  return COMPANIES.find((company) => company.id === id) ?? COMPANIES[0];
}

/** Derived sales stages. Labels match lib/sales/solar-workflow/labels.ts. */
export const STAGES = [
  { id: "NEW_LEAD", label: "New Lead" },
  { id: "CONTACTED", label: "Contacted" },
  { id: "QUALIFIED", label: "Qualified" },
  { id: "SITE_VISIT_REQUIRED", label: "Site Visit Required" },
  { id: "SITE_VISIT_COMPLETED", label: "Site Visit Completed" },
  { id: "PROPOSAL_PREPARED", label: "Proposal Prepared" },
  { id: "QUOTE_SENT", label: "Quote Sent" },
  { id: "NEGOTIATION", label: "Negotiation" },
  { id: "WON", label: "Won" },
  { id: "LOST", label: "Lost" },
] as const;

export type StageId = (typeof STAGES)[number]["id"];

export type Opportunity = {
  id: string;
  name: string;
  suburb: string;
  address: string;
  stage: StageId;
  detail: string;
  next: string;
  quote?: string;
  visit?: string;
  projectId?: string;
};

/** Sample desk for Sunline Solar. Stages are derived the way the live board derives them. */
export const OPPORTUNITIES: Opportunity[] = [
  {
    id: "amina",
    name: "Amina Cruz",
    suburb: "Newlands",
    address: "4 Newlands Road",
    stage: "NEW_LEAD",
    detail: "WhatsApp enquiry about a backup system. No visit and no quotation yet.",
    next: "Contact the lead",
  },
  {
    id: "tendai-lead",
    name: "Kuda Sibanda",
    suburb: "Borrowdale",
    address: "11 Kensington",
    stage: "CONTACTED",
    detail: "Spoke yesterday. Still gathering the monthly bill and essential loads.",
    next: "Qualify the requirement",
  },
  {
    id: "nyasha",
    name: "Nyasha Moyo",
    suburb: "Borrowdale",
    address: "18 Borrowdale Road",
    stage: "QUOTE_SENT",
    detail: "Site visit and assessment are complete. Quotation Q-1042 was sent.",
    next: "Follow up on the quotation",
    quote: "Q-1042 · US$4,800 · sent",
    visit: "Completed · suitable to proceed",
  },
  {
    id: "rudo",
    name: "Rudo Ncube",
    suburb: "Avondale",
    address: "6 Avondale",
    stage: "SITE_VISIT_REQUIRED",
    detail: "Visit is scheduled. Passing the date does not complete it.",
    next: "Open the site visit",
    visit: "Tomorrow · 09:30 · scheduled",
  },
  {
    id: "chipo-sales",
    name: "Tariro Dube",
    suburb: "Greendale",
    address: "9 Greendale Avenue",
    stage: "PROPOSAL_PREPARED",
    detail: "Draft quotation exists and has not been sent.",
    next: "Send the quotation",
    quote: "Q-1038 · draft",
    visit: "Completed · suitable to proceed",
  },
  {
    id: "farai",
    name: "Farai Dube",
    suburb: "Mount Pleasant",
    address: "22 Mount Pleasant",
    stage: "WON",
    detail: "Deal is won. The installation project is open.",
    next: "Open the project",
    quote: "Q-1011 · accepted",
    projectId: "farai",
  },
  {
    id: "lost",
    name: "Brian Mutasa",
    suburb: "Marlborough",
    address: "2 Marlborough Drive",
    stage: "LOST",
    detail: "Customer chose to wait. The deal is closed lost.",
    next: "Leave closed",
  },
];

export type Project = {
  id: string;
  name: string;
  customer: string;
  address: string;
  status: string;
  installation: string;
  attention: string;
  mark: Mark;
  next: string;
};

export const PROJECTS: Project[] = [
  {
    id: "farai",
    name: "Farai Dube — Solar Installation",
    customer: "Farai Dube",
    address: "22 Mount Pleasant",
    status: "In Progress",
    installation: "Scheduled",
    attention: "Installation is scheduled but equipment is not fully issued.",
    mark: "overdue",
    next: "Issue the remaining inverter",
  },
  {
    id: "chipo",
    name: "Chipo Ndlovu — Solar Installation",
    customer: "Chipo Ndlovu",
    address: "14 Greendale",
    status: "Quality Check",
    installation: "QA pending",
    attention: "Physical work is complete but the quality check is missing.",
    mark: "today",
    next: "Record the quality check",
  },
  {
    id: "tendai",
    name: "Tendai Moyo — Solar Installation",
    customer: "Tendai Moyo",
    address: "8 Marlborough",
    status: "Handover",
    installation: "Handover pending",
    attention: "Commissioning is complete. Customer balance is still outstanding.",
    mark: "waiting",
    next: "Explain the outstanding balance",
  },
];

export const WORK = [
  {
    id: "rudo",
    name: "Rudo Ncube",
    meta: "Site visit · tomorrow 09:30",
    detail: "Pre-sale visit. Assessment is still empty.",
    mark: "today" as Mark,
    action: "Open visit",
    screen: "visit" as Screen,
  },
  {
    id: "farai",
    name: "Farai Dube",
    meta: "Installation · today",
    detail: "Two batteries are reserved. The inverter is not issued.",
    mark: "overdue" as Mark,
    action: "Open project",
    screen: "project" as Screen,
  },
  {
    id: "chipo",
    name: "Chipo Ndlovu",
    meta: "Quality check",
    detail: "Checklist photos are in. QA has not been recorded.",
    mark: "today" as Mark,
    action: "Open project",
    screen: "project" as Screen,
  },
];

export const QUOTES = [
  { id: "q1042", name: "Q-1042", meta: "Nyasha Moyo · sent", detail: "US$4,800 · viewed once. Stage stays Quote Sent until negotiation or a close.", screen: "quote" as Screen },
  { id: "q1038", name: "Q-1038", meta: "Tariro Dube · draft", detail: "Prepared from the completed assessment. Not sent.", screen: "quote" as Screen },
  { id: "q1011", name: "Q-1011", meta: "Farai Dube · accepted", detail: "Accepted quotation. The won deal opened the installation project.", screen: "project" as Screen },
];

export const CUSTOMERS = [
  { id: "farai", name: "Farai Dube", detail: "1 open project · installation scheduled · no installed system yet" },
  { id: "nyasha", name: "Nyasha Moyo", detail: "Quotation sent · no project" },
  { id: "tendai", name: "Tendai Moyo", detail: "Handover pending · system not registered" },
  { id: "chipo", name: "Chipo Ndlovu", detail: "Quality check · system not registered" },
];

export const PRODUCTS = [
  { name: "5 kW hybrid inverter", detail: "Serial required · 1 on hand · 1 short on Farai Dube" },
  { name: "550 W panel", detail: "Serial not required · 24 on hand" },
  { name: "5 kWh battery", detail: "Serial required · 2 reserved for Farai Dube" },
];

export const PACKAGES = [
  { name: "Home backup 5 kW", detail: "Inverter, battery, and 8 panels. Used on Q-1042." },
  { name: "Lights and plugs", detail: "Small essential-load package." },
];

export const TEAM = [
  { name: "Tatenda Marufu", detail: "Sales · owns the Sunline pipeline" },
  { name: "Rumbidzai Ncube", detail: "Project manager · Farai Dube and Chipo Ndlovu" },
  { name: "Tapiwa Banda", detail: "Installer · assigned to Farai Dube today" },
];

export const CALENDAR = [
  { time: "09:30", name: "Rudo Ncube", detail: "Site visit · 6 Avondale · scheduled" },
  { time: "11:00", name: "Farai Dube", detail: "Installation · 22 Mount Pleasant · equipment short" },
  { time: "15:00", name: "Nyasha Moyo", detail: "Quotation follow-up · WhatsApp" },
];

export const INSTALL_STEPS = ["Preparation", "Equipment", "Installation", "QA", "Commissioning", "Handover"] as const;

export const MILESTONES = ["Sale", "Assessment", "Preparation", "Installation", "Commissioning", "Handover"] as const;
