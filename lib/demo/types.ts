import type {
  ContactRow,
  DealRow,
  DealStage,
  LeadRow,
  LeadSource,
  NotificationType,
  QuotationLineItemRow,
  QuotationRow,
  QuotationStatus,
  UserRole,
} from "@/types";
import type { DemoActorKey } from "@/lib/demo/actors";

export type DemoActor = {
  key: DemoActorKey;
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone: string;
};

export type DemoProduct = {
  id: string;
  client_id: string;
  name: string;
  sku: string;
  brand: string;
  category: string;
  size: string;
  description: string;
  selling_price: number;
  currency: string;
  stock: number;
  unit: string;
};

export type DemoMessage = {
  id: string;
  leadId: string;
  direction: "customer" | "rep";
  text: string;
  at: string;
  actorKey: DemoActorKey | null;
  kind: "message" | "system" | "internal";
};

export type DemoActivity = {
  id: string;
  leadId: string | null;
  dealId: string | null;
  actorKey: DemoActorKey;
  title: string;
  detail: string | null;
  kind: "whatsapp" | "quote" | "call" | "won" | "deal" | "lead" | "note";
  at: string;
};

export type DemoNotification = {
  id: string;
  userKey: DemoActorKey;
  type: NotificationType;
  message: string;
  read: boolean;
  leadId: string | null;
  quotationId: string | null;
  at: string;
};

export type DemoFollowUp = {
  id: string;
  leadId: string;
  dealId: string | null;
  ownerKey: DemoActorKey;
  label: string;
  dueAt: string;
  completed: boolean;
};

export type DemoDataset = {
  version: 1;
  industry: string;
  scenario: string;
  clientId: string;
  organisationName: string;
  timezone: string;
  generatedAt: string;
  actors: Record<DemoActorKey, DemoActor>;
  products: DemoProduct[];
  contacts: ContactRow[];
  leads: LeadRow[];
  deals: DealRow[];
  quotations: QuotationRow[];
  lineItems: QuotationLineItemRow[];
  messages: DemoMessage[];
  activities: DemoActivity[];
  notifications: DemoNotification[];
  followUps: DemoFollowUp[];
};

export type DemoMutation =
  | { id: string; type: "deal.stage"; dealId: string; stage: DealStage; at: string; actorUserId: string }
  | { id: string; type: "deal.won"; dealId: string; value: number; at: string; actorUserId: string }
  | { id: string; type: "deal.lost"; dealId: string; reason: string; at: string; actorUserId: string }
  | { id: string; type: "deal.fields"; dealId: string; patch: Partial<DealRow>; at: string; actorUserId: string }
  | { id: string; type: "followup.complete"; leadId: string; dealId: string | null; at: string; actorUserId: string }
  | {
      id: string;
      type: "followup.create";
      leadId: string;
      dealId: string | null;
      label: string;
      dueAt: string;
      at: string;
      actorUserId: string;
    }
  | { id: string; type: "message"; leadId: string; text: string; at: string; actorUserId: string; kind: "message" | "internal" }
  | { id: string; type: "assign"; dealId: string; ownerId: string; at: string; actorUserId: string };

export type DemoWorkspaceRef = {
  workspace_mode?: string | null;
  mode?: string | null;
  demo_industry?: string | null;
  industry?: string | null;
  demo_scenario?: string | null;
  scenario?: string | null;
};

export type LeadSourceLabel = LeadSource | "WALK_IN" | "PHONE";

export type { QuotationStatus };
