/**
 * Manager Agent / Command Center — shared types.
 * Natural language expresses intent. Server permissions decide what may run.
 */

export const MANAGER_RISK_LEVELS = ["LOW", "MEDIUM", "HIGH", "VERY_HIGH"] as const;
export type ManagerRiskLevel = (typeof MANAGER_RISK_LEVELS)[number];

export const MANAGER_SEVERITIES = ["URGENT", "HIGH", "NORMAL", "LOW"] as const;
export type ManagerSeverity = (typeof MANAGER_SEVERITIES)[number];

export const MANAGER_ENTITY_TYPES = [
  "CUSTOMER",
  "LEAD",
  "DEAL",
  "QUOTATION",
  "TASK",
  "APPOINTMENT",
  "CONVERSATION",
  "USER",
  "SUPPORT_CASE",
  "PROACTIVE_ACTION",
  "AGENT_ACTIVITY",
] as const;
export type ManagerEntityType = (typeof MANAGER_ENTITY_TYPES)[number];

export const DATE_PRESETS = [
  "today",
  "yesterday",
  "this_week",
  "last_week",
  "this_month",
  "last_month",
  "last_30",
  "this_quarter",
  "year_to_date",
] as const;
export type DatePreset = (typeof DATE_PRESETS)[number];

export type ManagerActor = {
  userId: string;
  role: "CLIENT_MANAGER" | "SUPER_ADMIN";
  clientId: string;
  alsoSells: boolean;
  name: string;
};

export type AttentionItem = {
  id: string;
  type: string;
  severity: ManagerSeverity;
  entityType: ManagerEntityType;
  entityId: string;
  title: string;
  reason: string;
  ownerName: string | null;
  ownerId: string | null;
  valueLabel: string | null;
  waitingLabel: string | null;
  href: string;
  recommendedActions: string[];
  rank: number;
};

export type AttentionSnapshot = {
  asOf: string;
  items: AttentionItem[];
  groups: Array<{ type: string; label: string; count: number; severity: ManagerSeverity }>;
  brief: {
    customersWaiting: number;
    quoteApprovals: number;
    dealsNoNextAction: number;
    overdueFollowUps: number;
    appointmentsToday: number;
    humanNeeded: number;
    failedProactive: number;
    supportOpen: number;
  };
  sources: Record<string, number>;
};

export type ResultRow = {
  id: string;
  entityType: ManagerEntityType;
  title: string;
  subtitle: string | null;
  status: string | null;
  valueLabel: string | null;
  ownerName: string | null;
  ownerId: string | null;
  href: string;
  meta: Record<string, string | number | null>;
};

export type TableBlock = {
  type: "table";
  entityType: ManagerEntityType;
  title: string;
  columns: Array<{ key: string; label: string }>;
  rows: ResultRow[];
  truncated: boolean;
  totalMatched: number;
  filtersLabel: string | null;
};

export type ConfirmationPreview = {
  title: string;
  summary: string;
  breakdown?: Array<{ label: string; value: string }>;
  exclusions?: string[];
  records: Array<{ id: string; label: string }>;
  risk: ManagerRiskLevel;
};

export type ManagerBlock =
  | { type: "text"; text: string }
  | { type: "attention"; snapshot: AttentionSnapshot }
  | TableBlock
  | { type: "confirmation"; confirmationId: string; preview: ConfirmationPreview }
  | { type: "customer360"; data: Record<string, unknown> }
  | {
      type: "status";
      kind: "done" | "partial" | "denied" | "unsupported" | "error";
      message: string;
    }
  | { type: "suggestions"; actions: Array<{ label: string; prompt: string }> }
  | { type: "disambiguation"; prompt: string; options: ResultRow[] }
  | { type: "sources"; asOf: string; counts: Record<string, number> };

export type ManagerTurnResult = {
  reply: string;
  blocks: ManagerBlock[];
  sessionId: string;
  executionId: string | null;
  asOf: string;
  phase: string | null;
};

export const MAX_QUERY_ROWS = 50;
export const MAX_BULK = 100;
export const CONFIRMATION_TTL_MS = 10 * 60_000;

export function isManagerAgentEnabled(): boolean {
  return process.env.SEGMIQ_MANAGER_AGENT_DISABLED !== "1";
}
