/**
 * Sales Agent — types.
 * Works for the salesperson. Does not speak to the customer.
 */

import type { AgentRiskLevel } from "@/lib/agent/types";

export const SALES_INTENTS = [
  "CREATE_QUOTATION",
  "UPDATE_DRAFT_QUOTATION",
  "VIEW_QUOTATION",
  "SEARCH_CUSTOMER",
  "SEARCH_DEAL",
  "SEARCH_PRODUCT",
  "SEARCH_PACKAGE",
  "COPY_LAST_QUOTATION",
  "GET_TODAYS_FOCUS",
  "NEXT_BEST_ACTION",
  "DRAFT_FOLLOWUP",
  "PREPARE_CALL_BRIEF",
  "UNSUPPORTED",
] as const;
export type SalesIntentName = (typeof SALES_INTENTS)[number];

export const FUTURE_SALES_INTENTS = [
  "CREATE_FOLLOWUP",
  "CREATE_TASK",
  "CREATE_APPOINTMENT",
  "UPDATE_DEAL_STAGE",
  "ADD_INTERNAL_NOTE",
  "TRANSFER_CONVERSATION",
  "SHOW_MY_DEALS",
  "SHOW_MY_FOLLOWUPS",
  "SHOW_MY_APPOINTMENTS",
] as const;
export type FutureSalesIntentName = (typeof FUTURE_SALES_INTENTS)[number];

export const ITEM_TYPES = ["PACKAGE", "PRODUCT", "SERVICE", "CUSTOM"] as const;
export type SalesItemType = (typeof ITEM_TYPES)[number];

export const REQUIREMENT_STATUSES = ["CONFIRMED", "MENTIONED", "UNCERTAIN"] as const;
export type RequirementStatus = (typeof REQUIREMENT_STATUSES)[number];

export type SalesActor = {
  userId: string;
  role: "SALESPERSON" | "CLIENT_MANAGER" | "SUPER_ADMIN";
  clientId: string;
  name: string;
};

/** IDs injected by the application — never inferred by the model. */
export type SalesPageContext = {
  conversationId?: string | null;
  leadId?: string | null;
  customerId?: string | null;
  dealId?: string | null;
  quotationId?: string | null;
  ownerId?: string | null;
  companyId?: string | null;
  currentUserId?: string | null;
};

export type CustomerReference = {
  source: "CURRENT_CONTEXT" | "SEARCH" | "ID" | "SELECTED";
  query?: string;
  id?: string;
};

export type VariantAllocation = {
  variantQuery: string;
  variantId?: string;
  quantity: number;
};

export type SalesIntentItem = {
  type: SalesItemType;
  query: string;
  quantity: number;
  variantQuery?: string;
  variantAllocations?: VariantAllocation[];
  id?: string;
};

export type SalesIntent = {
  intent: SalesIntentName | FutureSalesIntentName;
  customerReference?: CustomerReference;
  dealReference?: CustomerReference;
  quotationReference?: CustomerReference;
  items: SalesIntentItem[];
  discountPercent?: number | null;
  validityDays?: number | null;
  sendRequested?: boolean;
  extractFromConversation?: boolean;
  copyLast?: boolean;
  searchQuery?: string;
  note?: string;
  /** Product-only add-on quote for an existing install (Command Center). */
  upgrade?: boolean;
  /** Optional hint like "3kVA" when the salesperson mentions the existing system. */
  existingSystemHint?: string;
};

export type ProgressStep = {
  id: string;
  label: string;
  status: "pending" | "running" | "done" | "failed" | "skipped";
  detail?: string;
};

export type SalesChoice = {
  id: string;
  entityType: "CUSTOMER" | "LEAD" | "DEAL" | "PRODUCT" | "SERVICE" | "PACKAGE" | "VARIANT" | "QUOTATION" | "TEMPLATE";
  title: string;
  subtitle?: string | null;
  status?: string | null;
  meta?: Record<string, string | number | null>;
  availableLabel?: string | null;
  href?: string | null;
};

export type QuotationPreviewLine = {
  name: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  kind: "PACKAGE" | "PRODUCT" | "SERVICE" | "CUSTOM" | "OTHER";
};

export type CommercialCheckPreview = {
  items: Array<{ id: string; label: string; status: "pass" | "warn" | "block"; action?: string }>;
  canSend: boolean;
  approvalRequired: boolean;
  readyLabel: string;
};

export type QuotationDraftPreview = {
  quotationId: string;
  quoteNumber: string;
  status: string;
  customerName: string;
  dealName: string | null;
  currency: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  validUntil: string | null;
  lines: QuotationPreviewLine[];
  commercialCheck: CommercialCheckPreview;
  href: string;
  inventoryNotes: string[];
  learningNotes: string[];
  sendRequested: boolean;
  isRevision: boolean;
};

export type SalesBlock =
  | { type: "text"; text: string }
  | { type: "progress"; steps: ProgressStep[] }
  | { type: "context"; card: SalesContextCard }
  | { type: "quotation_draft"; preview: QuotationDraftPreview }
  | { type: "commercial_check"; check: CommercialCheckPreview }
  | {
      type: "choice";
      kind: SalesChoice["entityType"];
      prompt: string;
      options: SalesChoice[];
    }
  | {
      type: "requirements";
      prompt: string;
      items: Array<{ label: string; quantity: number | null; status: RequirementStatus }>;
      location?: string | null;
    }
  | {
      type: "variant_allocator";
      prompt: string;
      productName: string;
      requestedTotal: number;
      allocatedTotal: number;
      variants: Array<{ id: string; name: string; quantity: number; availableLabel?: string | null }>;
    }
  | {
      type: "status";
      kind: "done" | "partial" | "denied" | "unsupported" | "error" | "blocked";
      message: string;
    }
  | { type: "actions"; actions: Array<{ label: string; href?: string; prompt?: string; style?: "primary" | "secondary" | "danger" }> }
  | { type: "learning"; title: string; body: string };

export type SalesContextCard = {
  customerName: string | null;
  customerId: string | null;
  leadId: string | null;
  projectType: string | null;
  dealId: string | null;
  dealName: string | null;
  dealStage: string | null;
  quotationId: string | null;
  quotationNumber: string | null;
  quotationStatus: string | null;
  conversationId: string | null;
  customerHref: string | null;
  dealHref: string | null;
};

export type SalesTurnResult = {
  reply: string;
  blocks: SalesBlock[];
  sessionId: string;
  executionId: string | null;
  phase: string | null;
  status: "COMPLETED" | "WAITING_FOR_INPUT" | "WAITING_FOR_CONFIRMATION" | "FAILED" | "CANCELLED";
  context: SalesContextCard | null;
  recent?: SalesRecentWork[];
};

export type SalesRecentWork = {
  quotationId: string;
  quoteNumber: string;
  customerName: string | null;
  status: string;
  summary: string;
  createdAt: string;
  href: string;
};

export type PendingInput = {
  kind: SalesChoice["entityType"] | "REQUIREMENTS" | "VARIANT" | "COPY_CONFIRM" | "TEMPLATE";
  prompt: string;
  options: SalesChoice[];
  intent: SalesIntent;
  progress: ProgressStep[];
  extra?: Record<string, unknown>;
};

export type SalesSessionState = {
  id: string;
  activeCustomerId: string | null;
  activeLeadId: string | null;
  activeDealId: string | null;
  activeQuotationId: string | null;
  activeConversationId: string | null;
  pendingInput: PendingInput | null;
  pageContext: SalesPageContext;
  expiresAt: string | null;
};

export const SALES_PROMPT_VERSION = "1.0.0";
export const SESSION_TTL_MS = 30 * 60_000;
export const PRODUCT_SEARCH_LIMIT = 8;

export function isSalesAgentGloballyEnabled(): boolean {
  return process.env.SEGMIQ_SALES_AGENT_DISABLED !== "1";
}

export function formatSalesMoney(amount: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export type SalesToolMeta = {
  requiredPermission: string;
  riskLevel: AgentRiskLevel;
  requiresConfirmation: boolean;
  allowedAgentModes: Array<"SALESPERSON" | "MANAGER">;
  tenantScoped: true;
  ownerScope: boolean;
};
