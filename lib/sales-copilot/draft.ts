import type { CopilotWorkView } from "./types";

type DraftSource = {
  actionType: string;
  explanation: string;
  payload: Record<string, unknown>;
};

export function copilotDraftStorageKey(leadId: string): string {
  return `segmiq:copilot-draft:${leadId}`;
}

export function stageCopilotDraft(leadId: string, text: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(copilotDraftStorageKey(leadId), text);
}

export function takeCopilotDraft(leadId: string): string | null {
  if (typeof window === "undefined") return null;
  const key = copilotDraftStorageKey(leadId);
  const value = window.sessionStorage.getItem(key);
  if (value) window.sessionStorage.removeItem(key);
  return value;
}

export function customerDraft(item: DraftSource): string {
  const concerns = Array.isArray(item.payload.concerns) ? item.payload.concerns.map(String) : [];
  const discussed = Array.isArray(item.payload.discussed) ? item.payload.discussed.map(String) : [];
  if (item.actionType === "answer_question") {
    const question = typeof item.payload.question === "string" ? item.payload.question : "";
    return question
      ? `Thanks for your question about “${question.slice(0, 140)}”. I am checking that and will confirm shortly.`
      : "Thanks for your message. I am checking that and will confirm shortly.";
  }
  const parts = [
    discussed[0] ? `You mentioned ${discussed[0].slice(0, 140)}` : null,
    concerns[0] ? `and raised ${concerns[0].slice(0, 140)}` : null,
  ].filter(Boolean);
  if (parts.length === 0) {
    return "Hi, just checking in as we agreed. Happy to help with anything still open.";
  }
  return `Hi, just checking in. ${parts.join(" ")}. Happy to help with anything still open.`;
}

export type { CopilotWorkView };
