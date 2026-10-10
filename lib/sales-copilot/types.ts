export type CopilotQueue = "needs_review" | "todo" | "waiting";

export type CopilotCapabilities = {
  quotations: boolean;
  listings: boolean;
  appointments: boolean;
  reminders: boolean;
  stock: boolean;
};

export type CatalogueItem = {
  id: string;
  name: string;
  sku: string | null;
  brand: string | null;
  size: string | null;
  unitPrice: number | null;
  stockQty: number | null;
};

export type ListingItem = {
  id: string;
  name: string;
  location: string | null;
  intent: string | null;
};

export type CopilotMessage = {
  id: string;
  direction: "inbound" | "outbound";
  body: string;
  createdAt: string;
  status: string | null;
  authorId: string | null;
  authorName: string | null;
};

export type RequiredField = { key: string; label: string };

export type CopilotEngineInput = {
  timezone: string;
  defaultHour: number;
  contactLaterDays: number;
  checkinOffsetDays: number;
  capabilities: CopilotCapabilities;
  requiredFields: RequiredField[];
  knownFacts: Record<string, string>;
  catalogue: CatalogueItem[];
  listings: ListingItem[];
  stage: string | null;
  followUpAt: string | null;
  quoteStatus: string | null;
  doNotContact: boolean;
  messages: CopilotMessage[];
};

export type EvidenceExcerpt = {
  id: string;
  at: string;
  speaker: "customer" | "salesperson";
  text: string;
};

export type ProposalDraft = {
  semanticKey: string;
  actionType: string;
  queue: CopilotQueue;
  title: string;
  explanation: string;
  evidenceMessageIds: string[];
  evidence: EvidenceExcerpt[];
  proposedAt: string | null;
  hourSuggested: boolean;
  currentDueAt: string | null;
  waitingActor: "salesperson" | "customer" | "colleague" | "external" | null;
  priority: "high" | "medium" | "low";
  missing: string[];
  payload: Record<string, unknown>;
  linkedFollowUp: boolean;
};

export type CopilotAnalysis = {
  summary: string;
  facts: Array<{ key: string; value: string; messageId: string }>;
  needs: string[];
  objections: string[];
  questions: Array<{ text: string; messageId: string }>;
  waitingActor: ProposalDraft["waitingActor"];
  proposals: ProposalDraft[];
  fulfilledKeys: string[];
  lastMessageId: string | null;
  lastMessageAt: string | null;
  uncertainty: string[];
  contextRevision: string;
};

export type ExistingWorkItem = {
  id: string;
  semanticKey: string;
  payloadHash: string;
  reviewStatus: string;
  executionStatus: string;
  fulfilmentStatus: string;
  contextRevision: string;
  evidenceMessageIds: string[];
  salespersonChoice?: boolean;
  chosenId?: string | null;
};

export type WorkItemUpsert = ProposalDraft & {
  id?: string;
  payloadHash: string;
  contextRevision: string;
  reviewStatus?: string;
  executionStatus?: string;
  fulfilmentStatus?: string;
  linkedQuotationId?: string | null;
  executionError?: string | null;
};

export type CopilotWorkView = {
  id: string;
  leadId: string;
  actionType: string;
  queue: CopilotQueue;
  title: string;
  explanation: string;
  reviewStatus: string;
  executionStatus: string;
  fulfilmentStatus: string;
  waitingActor: string | null;
  proposedAt: string | null;
  hourSuggested: boolean;
  currentDueAt: string | null;
  priority: "high" | "medium" | "low";
  missing: string[];
  evidence: EvidenceExcerpt[];
  linkedQuotationId: string | null;
  linkedFollowUp: boolean;
  executionError: string | null;
  payload: Record<string, unknown>;
  semanticKey: string;
  contextRevision: string;
  primaryLabel: string;
  snoozeUntil: string | null;
};
