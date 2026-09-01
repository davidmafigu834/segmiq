import { quotationEventLabel } from "@/lib/quotations/events";
import type { ActivityFilterCategory } from "./types";

export type ActivityIconKey =
  | "user-plus"
  | "phone-call"
  | "whatsapp"
  | "mail"
  | "mail-check"
  | "sticky-note"
  | "file-text"
  | "file-check"
  | "upload"
  | "calendar-clock"
  | "list-todo"
  | "check-circle"
  | "arrow-right-left"
  | "flame"
  | "activity"
  | "refresh"
  | "workflow"
  | "user-round"
  | "inbox";

export type ActivityTone = "neutral" | "success" | "info" | "warning" | "brand" | "danger";

export type ActivityPresentation = {
  label: string;
  iconKey: ActivityIconKey;
  tone: ActivityTone;
  filterCategory: ActivityFilterCategory;
};

const QUOTE_EVENT_MAP: Record<string, ActivityPresentation> = {
  CREATED: { label: "Quote created", iconKey: "file-text", tone: "info", filterCategory: "quotes" },
  SENT: { label: "Quote sent", iconKey: "file-check", tone: "info", filterCategory: "quotes" },
  VIEWED: { label: "Quote viewed", iconKey: "file-text", tone: "neutral", filterCategory: "quotes" },
  ACCEPTED: { label: "Quote accepted", iconKey: "check-circle", tone: "success", filterCategory: "quotes" },
  DECLINED: { label: "Quote declined", iconKey: "file-text", tone: "danger", filterCategory: "quotes" },
  APPROVED: { label: "Quote approved", iconKey: "file-check", tone: "success", filterCategory: "quotes" },
  CHANGES_REQUESTED: {
    label: "Quote changes requested",
    iconKey: "file-text",
    tone: "warning",
    filterCategory: "quotes",
  },
};

const LEAD_EVENT_MAP: Record<string, ActivityPresentation> = {
  LEAD_CREATED: { label: "New lead captured", iconKey: "user-plus", tone: "info", filterCategory: "system" },
  RE_ENQUIRY: { label: "Re-enquiry received", iconKey: "user-plus", tone: "info", filterCategory: "system" },
  LEAD_ASSIGNED: { label: "Owner assigned", iconKey: "user-round", tone: "neutral", filterCategory: "system" },
  LEAD_REASSIGNED: { label: "Owner reassigned", iconKey: "user-round", tone: "neutral", filterCategory: "system" },
  STATUS_CHANGED: { label: "Stage changed", iconKey: "arrow-right-left", tone: "brand", filterCategory: "system" },
  CALL_LOGGED: { label: "Call logged", iconKey: "phone-call", tone: "success", filterCategory: "calls" },
  INTAKE_LOGGED: { label: "Walk-in logged", iconKey: "user-plus", tone: "info", filterCategory: "system" },
  NOTE_ADDED: { label: "Note added", iconKey: "sticky-note", tone: "warning", filterCategory: "notes" },
  DOCUMENT_SENT: { label: "Document sent", iconKey: "upload", tone: "info", filterCategory: "documents" },
  FOLLOW_UP_SET: { label: "Follow-up scheduled", iconKey: "calendar-clock", tone: "warning", filterCategory: "tasks" },
  FOLLOW_UP_COMPLETED: {
    label: "Follow-up completed",
    iconKey: "check-circle",
    tone: "success",
    filterCategory: "tasks",
  },
  MESSAGE_RECEIVED: { label: "WhatsApp received", iconKey: "whatsapp", tone: "success", filterCategory: "whatsapp" },
  MESSAGE_SENT: { label: "WhatsApp sent", iconKey: "whatsapp", tone: "success", filterCategory: "whatsapp" },
  CONVERSATION_RESOLVED: { label: "Conversation resolved", iconKey: "inbox", tone: "neutral", filterCategory: "whatsapp" },
  CONVERSATION_REOPENED: { label: "Conversation reopened", iconKey: "inbox", tone: "neutral", filterCategory: "whatsapp" },
  CONVERSATION_TYPE_CHANGED: { label: "Conversation updated", iconKey: "inbox", tone: "neutral", filterCategory: "whatsapp" },
  CONVERSATION_TRANSFERRED_TO_SUPPORT: {
    label: "Transferred to support",
    iconKey: "inbox",
    tone: "warning",
    filterCategory: "whatsapp",
  },
  SUPPORT_CASE_OPENED: { label: "Support case opened", iconKey: "inbox", tone: "warning", filterCategory: "system" },
  SUPPORT_CASE_UPDATED: { label: "Support case updated", iconKey: "inbox", tone: "neutral", filterCategory: "system" },
  CAMPAIGN_RESPONSE: { label: "Campaign response", iconKey: "activity", tone: "info", filterCategory: "system" },
  LEARNING_OBSERVED: { label: "Agent learning recorded", iconKey: "workflow", tone: "neutral", filterCategory: "system" },
  DEAL_CREATED: { label: "Deal created", iconKey: "file-text", tone: "brand", filterCategory: "system" },
  DEAL_STAGE_CHANGED: { label: "Deal stage changed", iconKey: "arrow-right-left", tone: "brand", filterCategory: "system" },
  DEAL_WON: { label: "Deal won", iconKey: "check-circle", tone: "success", filterCategory: "system" },
  DEAL_LOST: { label: "Deal lost", iconKey: "file-text", tone: "danger", filterCategory: "system" },
  DEAL_VALUE_CHANGED: { label: "Deal value updated", iconKey: "activity", tone: "neutral", filterCategory: "system" },
  DEAL_UPDATED: { label: "Deal updated", iconKey: "activity", tone: "neutral", filterCategory: "system" },
  DEAL_MIGRATED: { label: "Deal migrated", iconKey: "refresh", tone: "neutral", filterCategory: "system" },
  CONTACT_CREATED: { label: "Added to Customer Hub", iconKey: "user-plus", tone: "info", filterCategory: "system" },
};

const RE_NOTE_LABELS: Record<string, string> = {
  requirements_updated: "Requirements updated",
  property_matched: "Property matched",
  property_sent: "Property sent to client",
  property_linked: "Property linked",
  viewing_scheduled: "Viewing scheduled",
  viewing_completed: "Viewing completed",
  stage_changed: "Stage changed",
  offer_created: "Offer created",
  offer_submitted: "Offer submitted",
  offer_countered: "Seller countered",
  offer_revised: "Buyer revised offer",
  offer_accepted: "Offer accepted",
  offer_rejected: "Offer rejected",
  offer_withdrawn: "Offer withdrawn",
};

export function presentationForLeadEvent(
  eventType: string,
  data: Record<string, unknown>
): ActivityPresentation {
  const base = LEAD_EVENT_MAP[eventType] ?? {
    label: eventType.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
    iconKey: "activity" as ActivityIconKey,
    tone: "neutral" as ActivityTone,
    filterCategory: "system" as ActivityFilterCategory,
  };

  if (eventType === "NOTE_ADDED") {
    const reKind = data.re_kind as string | undefined;
    if (reKind && RE_NOTE_LABELS[reKind]) {
      return { ...base, label: RE_NOTE_LABELS[reKind]! };
    }
  }

  if (eventType === "STATUS_CHANGED") {
    const to = data.to_status as string | undefined;
    if (to) {
      return { ...base, label: "Stage changed" };
    }
  }

  return base;
}

export function presentationForQuotationEvent(eventType: string): ActivityPresentation {
  const mapped = QUOTE_EVENT_MAP[eventType];
  if (mapped) return mapped;
  return {
    label: quotationEventLabel(eventType),
    iconKey: "file-text",
    tone: "info",
    filterCategory: "quotes",
  };
}

export function filterCategoryMatches(
  itemCategory: ActivityFilterCategory,
  filter: ActivityFilterCategory
): boolean {
  if (filter === "all") return true;
  return itemCategory === filter;
}

export const ACTIVITY_FILTER_OPTIONS: { id: ActivityFilterCategory; label: string }[] = [
  { id: "all", label: "All" },
  { id: "calls", label: "Calls" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "notes", label: "Notes" },
  { id: "tasks", label: "Follow-ups" },
  { id: "documents", label: "Documents" },
  { id: "quotes", label: "Quotes" },
  { id: "system", label: "System" },
];
