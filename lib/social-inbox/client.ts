/**
 * Browser-side calls for the Social Inbox workspace. Everything here talks to
 * /api/social-inbox, which is tenant-scoped and permission-gated on the server.
 */

import type { SocialConversationDetail, SocialInboxViewId, SocialInboxWorkspace } from "./types";

export type SocialContactMatch = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  note: string | null;
};

export type SocialProductMatch = {
  id: string;
  name: string;
  detail: string | null;
};

export class SocialInboxError extends Error {}

async function readJson<T>(res: Response): Promise<T> {
  const payload = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok) {
    throw new SocialInboxError(payload?.error || "Something went wrong. Please try again.");
  }
  if (!payload) throw new SocialInboxError("The server returned an empty response.");
  return payload;
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, cache: "no-store" });
  return readJson<T>(res);
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return readJson<T>(res);
}

export function fetchWorkspace(view: SocialInboxViewId, signal?: AbortSignal): Promise<SocialInboxWorkspace> {
  return getJson<SocialInboxWorkspace>(`/api/social-inbox/workspace?view=${encodeURIComponent(view)}`, signal);
}

export function fetchConversation(id: string, signal?: AbortSignal): Promise<SocialConversationDetail> {
  return getJson<SocialConversationDetail>(`/api/social-inbox/conversations/${encodeURIComponent(id)}`, signal);
}

export function sendReply(
  id: string,
  body: {
    text: string;
    visibility: "public" | "private";
    internalNote?: boolean;
    aiDraft?: boolean;
    idempotencyKey: string;
  }
): Promise<{ ok: true; messageId?: string }> {
  return postJson(`/api/social-inbox/conversations/${encodeURIComponent(id)}/reply`, body);
}

export function suggestReply(id: string): Promise<{ draft: string; source: string }> {
  return postJson(`/api/social-inbox/conversations/${encodeURIComponent(id)}/suggest-reply`, {});
}

export type SocialActionBody =
  | { action: "read"; read: boolean }
  | { action: "assign"; assigneeId: string | null }
  | { action: "resolve"; resolved: boolean }
  | { action: "not_sales"; reason?: string }
  | { action: "convert"; name?: string; phone?: string; email?: string; notes?: string }
  | { action: "create_deal"; name?: string }
  | { action: "follow_up"; followUpAt: string; reason?: string }
  | { action: "follow_up"; clear: true; completed?: boolean }
  | { action: "link_identity"; contactId?: string | null; leadId?: string | null; rejected?: boolean };

export function runConversationAction(
  id: string,
  body: SocialActionBody
): Promise<{ ok: true; leadId?: string; dealId?: string; duplicate?: boolean }> {
  return postJson(`/api/social-inbox/conversations/${encodeURIComponent(id)}/actions`, body);
}

export function runBulkAction(body: {
  action: "assign" | "read" | "resolve";
  conversationIds: string[];
  assigneeId?: string | null;
}): Promise<{ ok: true; count?: number }> {
  return postJson("/api/social-inbox/bulk", body);
}

export function disconnectChannel(connectionId: string): Promise<{ ok: true }> {
  return postJson("/api/social-inbox/connections", { action: "disconnect", connectionId });
}

type ContactListResponse = {
  contacts?: Array<{
    id: string;
    name: string | null;
    phone: string | null;
    email: string | null;
    lifecycle?: string | null;
    activeLead?: { status?: string | null } | null;
  }>;
};

export async function searchContacts(q: string, signal?: AbortSignal): Promise<SocialContactMatch[]> {
  const data = await getJson<ContactListResponse>(
    `/api/contacts/list?limit=12&q=${encodeURIComponent(q)}`,
    signal
  );
  return (data.contacts ?? []).map((row) => ({
    id: row.id,
    name: row.name?.trim() || "Unnamed contact",
    phone: row.phone ?? null,
    email: row.email ?? null,
    note: row.activeLead?.status
      ? `Open enquiry · ${String(row.activeLead.status).replace(/_/g, " ").toLowerCase()}`
      : row.lifecycle
        ? String(row.lifecycle).replace(/_/g, " ").toLowerCase()
        : null,
  }));
}

type CommercialSearchResponse = {
  results?: Array<{
    id: string;
    name: string | null;
    sku?: string | null;
    brand?: string | null;
    price?: number | null;
    currency?: string | null;
    availability?: string | null;
  }>;
};

export async function searchProducts(
  clientId: string,
  q: string,
  signal?: AbortSignal
): Promise<SocialProductMatch[]> {
  const data = await getJson<CommercialSearchResponse>(
    `/api/clients/${encodeURIComponent(clientId)}/commercial-search?limit=12&q=${encodeURIComponent(q)}`,
    signal
  );
  return (data.results ?? []).map((row) => {
    const price =
      typeof row.price === "number" ? `${row.currency ?? ""} ${row.price.toLocaleString()}`.trim() : null;
    return {
      id: row.id,
      name: row.name?.trim() || "Unnamed item",
      detail: [row.brand, price, row.availability].filter(Boolean).join(" · ") || null,
    };
  });
}
