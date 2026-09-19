import { createAdminClient } from "@/lib/supabase/admin";
import type {
  SafeSocialConnection,
  SocialChannel,
  SocialConversationKind,
  SocialInboxFilters,
  SocialInboxViewId,
  SocialIntentBand,
  SocialOrigin,
  SocialProvider,
  SocialQueueItem,
} from "./types";
import { decorateQueueItem } from "./ranking";

export function isMissingSocialTable(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = `${error.code ?? ""} ${error.message ?? ""}`;
  return /42P01|does not exist|social_conversations|social_channel/i.test(msg);
}

type ConversationJoinRow = {
  id: string;
  client_id: string;
  identity_id: string;
  provider: SocialProvider;
  channel: SocialChannel;
  conversation_kind: SocialConversationKind;
  visibility: "public" | "private";
  status: string;
  unread: boolean;
  assigned_to_id: string | null;
  last_message_at: string | null;
  last_customer_message_at: string | null;
  last_business_message_at: string | null;
  last_message_preview: string | null;
  origin_kind: SocialOrigin["kind"] | null;
  origin_campaign_id: string | null;
  origin_campaign_name: string | null;
  origin_ad_id: string | null;
  origin_ad_name: string | null;
  origin_post_id: string | null;
  origin_permalink: string | null;
  origin_caption: string | null;
  origin_customer_quote: string | null;
  linked_lead_id: string | null;
  linked_deal_id: string | null;
  linked_contact_id: string | null;
  is_demo: boolean;
  identity?: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
  opportunity?: {
    id: string;
    intent_score: number;
    intent_band: SocialIntentBand;
    intent_reasons: unknown;
    detected_product: string | null;
    follow_up_at: string | null;
    follow_up_reason: string | null;
    status: string;
    lead_id: string | null;
    deal_id: string | null;
    contact_id: string | null;
  } | null;
  assignee?: { id: string; name: string } | null;
};

function originFromRow(row: ConversationJoinRow): SocialOrigin | null {
  if (!row.origin_kind && !row.origin_campaign_name && !row.origin_customer_quote) return null;
  return {
    kind: row.origin_kind ?? "unknown",
    campaignName: row.origin_campaign_name,
    campaignId: row.origin_campaign_id,
    adName: row.origin_ad_name,
    adId: row.origin_ad_id,
    postId: row.origin_post_id,
    permalink: row.origin_permalink,
    caption: row.origin_caption,
    customerQuote: row.origin_customer_quote,
  };
}

function followUpLabel(iso: string | null): string | null {
  if (!iso) return null;
  const due = Date.parse(iso);
  if (!Number.isFinite(due)) return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  if (due < start.getTime()) return "Follow up overdue";
  if (due < end.getTime()) return "Follow up today";
  return "Follow up upcoming";
}

export function rowToQueueItem(row: ConversationJoinRow, viewerId: string): SocialQueueItem {
  const opp = Array.isArray(row.opportunity) ? row.opportunity[0] : row.opportunity;
  const identity = Array.isArray(row.identity) ? row.identity[0] : row.identity;
  const assignee = Array.isArray(row.assignee) ? row.assignee[0] : row.assignee;
  const reasons = Array.isArray(opp?.intent_reasons)
    ? (opp!.intent_reasons as string[])
    : [];
  const crmState =
    opp?.status === "converted" || row.linked_lead_id
      ? "converted"
      : row.linked_deal_id || opp?.deal_id
        ? "open_deal"
        : row.linked_contact_id || opp?.contact_id
          ? "existing_customer"
          : "none";
  return decorateQueueItem(
    {
      conversationId: row.id,
      opportunityId: opp?.id ?? null,
      displayName: identity?.display_name?.trim() || identity?.username || "Social visitor",
      username: identity?.username ?? null,
      avatarUrl: identity?.avatar_url ?? null,
      channel: row.channel,
      conversationKind: row.conversation_kind,
      visibility: row.visibility,
      preview: row.last_message_preview || "",
      lastMessageAt: row.last_message_at,
      unread: Boolean(row.unread),
      assignedToId: row.assigned_to_id,
      assignedToName: assignee?.name ?? null,
      intentScore: opp?.intent_score ?? 0,
      intentBand: opp?.intent_band ?? "cold",
      intentReasons: reasons,
      detectedProduct: opp?.detected_product ?? null,
      followUpLabel: followUpLabel(opp?.follow_up_at ?? null),
      crmState,
      primaryLabel: null,
      origin: originFromRow(row),
      isDemo: Boolean(row.is_demo),
      rankScore: 0,
    },
    viewerId
  );
}

export async function listConnections(clientId: string): Promise<SafeSocialConnection[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("social_channel_connections")
    .select(
      "id, provider, channel_kind, status, display_name, username, page_id, ig_account_id, scopes, last_sync_at, last_event_at, last_error, is_demo"
    )
    .eq("client_id", clientId)
    .order("created_at", { ascending: true });
  if (error) {
    if (isMissingSocialTable(error)) return [];
    throw error;
  }
  return (data ?? []).map((row) => ({
    id: row.id as string,
    provider: row.provider as SocialProvider,
    channelKind: row.channel_kind as "page" | "ig_business",
    status: row.status as SafeSocialConnection["status"],
    displayName: (row.display_name as string | null) ?? null,
    username: (row.username as string | null) ?? null,
    pageId: (row.page_id as string | null) ?? null,
    igAccountId: (row.ig_account_id as string | null) ?? null,
    scopesOk: Array.isArray(row.scopes) ? (row.scopes as string[]).length > 0 : false,
    lastSyncAt: (row.last_sync_at as string | null) ?? null,
    lastEventAt: (row.last_event_at as string | null) ?? null,
    lastError: (row.last_error as string | null) ?? null,
    isDemo: Boolean(row.is_demo),
  }));
}

/**
 * Every conversation the viewer is allowed to see. Views are narrowed in the
 * workspace layer so one query can also produce accurate per-view counts.
 */
export async function listConversations(opts: {
  clientId: string;
  viewerId: string;
  canViewTeam: boolean;
  filters?: SocialInboxFilters;
  limit?: number;
}): Promise<{ rows: ConversationJoinRow[]; errorMissingTable: boolean }> {
  const supabase = createAdminClient();
  const limit = Math.min(opts.limit ?? 200, 300);
  let query = supabase
    .from("social_conversations")
    .select(
      `
      id, client_id, identity_id, provider, channel, conversation_kind, visibility, status,
      unread, assigned_to_id, last_message_at, last_customer_message_at, last_business_message_at,
      last_message_preview, origin_kind, origin_campaign_id, origin_campaign_name, origin_ad_id,
      origin_ad_name, origin_post_id, origin_permalink, origin_caption, origin_customer_quote,
      linked_lead_id, linked_deal_id, linked_contact_id, is_demo,
      identity:social_identities!social_conversations_identity_id_fkey (display_name, username, avatar_url),
      opportunity:social_opportunities!social_opportunities_conversation_id_fkey (
        id, intent_score, intent_band, intent_reasons, detected_product, follow_up_at, follow_up_reason, status, lead_id, deal_id, contact_id
      ),
      assignee:users!social_conversations_assigned_to_id_fkey (id, name)
    `
    )
    .eq("client_id", opts.clientId)
    .neq("status", "archived")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (!opts.canViewTeam) {
    query = query.eq("assigned_to_id", opts.viewerId);
  }

  if (opts.filters?.q?.trim()) {
    const q = opts.filters.q.trim().replace(/,/g, " ");
    query = query.or(`last_message_preview.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error) {
    if (isMissingSocialTable(error)) return { rows: [], errorMissingTable: true };
    console.error("[social-inbox] listConversations", error);
    return { rows: [], errorMissingTable: false };
  }
  return { rows: ((data ?? []) as unknown as ConversationJoinRow[]).filter((row) => !row.is_demo), errorMissingTable: false };
}

export async function getConversationRow(clientId: string, conversationId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("social_conversations")
    .select(
      `
      id, client_id, identity_id, provider, channel, conversation_kind, visibility, status,
      unread, assigned_to_id, last_message_at, last_customer_message_at, last_business_message_at,
      last_message_preview, origin_kind, origin_campaign_id, origin_campaign_name, origin_ad_id,
      origin_ad_name, origin_post_id, origin_permalink, origin_caption, origin_customer_quote,
      linked_lead_id, linked_deal_id, linked_contact_id, is_demo, provider_thread_id, connection_id,
      identity:social_identities!social_conversations_identity_id_fkey (id, display_name, username, avatar_url, provider, provider_user_id, match_status),
      opportunity:social_opportunities!social_opportunities_conversation_id_fkey (
        id, intent_score, intent_band, intent_reasons, detected_product, detected_location,
        recommended_action, recommended_action_code, follow_up_at, follow_up_reason, status,
        lead_id, deal_id, contact_id, assigned_to_id
      ),
      assignee:users!social_conversations_assigned_to_id_fkey (id, name)
    `
    )
    .eq("client_id", clientId)
    .eq("id", conversationId)
    .maybeSingle();
  if (error) {
    if (isMissingSocialTable(error)) return null;
    throw error;
  }
  return data as unknown as ConversationJoinRow & {
    provider_thread_id?: string | null;
    connection_id?: string | null;
    identity?: {
      id: string;
      display_name: string | null;
      username: string | null;
      avatar_url: string | null;
      provider: SocialProvider;
      provider_user_id: string;
      match_status: string;
    } | null;
  };
}

export async function listMessages(clientId: string, conversationId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("social_messages")
    .select("id, direction, visibility, body, is_internal_note, send_status, send_error, ai_draft, sent_at, actor_id")
    .eq("client_id", clientId)
    .eq("conversation_id", conversationId)
    .order("sent_at", { ascending: true })
    .limit(400);
  if (error) {
    if (isMissingSocialTable(error)) return [];
    throw error;
  }
  const actorIds = [...new Set((data ?? []).map((m) => m.actor_id as string | null).filter(Boolean))] as string[];
  const names = new Map<string, string>();
  if (actorIds.length) {
    const { data: users } = await supabase.from("users").select("id, name").in("id", actorIds);
    for (const u of users ?? []) names.set(u.id as string, (u.name as string) ?? "Teammate");
  }
  return (data ?? []).map((m) => ({
    id: m.id as string,
    direction: m.direction as "inbound" | "outbound",
    visibility: m.visibility as "public" | "private",
    body: (m.body as string) ?? "",
    isInternalNote: Boolean(m.is_internal_note),
    sendStatus: (m.send_status as "pending" | "sending" | "sent" | "delivered" | "failed") ?? "sent",
    sendError: (m.send_error as string | null) ?? null,
    aiDraft: Boolean(m.ai_draft),
    sentAt: m.sent_at as string,
    actorName: m.actor_id ? names.get(m.actor_id as string) ?? null : null,
  }));
}

export async function listTeam(clientId: string): Promise<{ id: string; name: string }[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("users")
    .select("id, name, role, also_sells, is_active")
    .eq("client_id", clientId)
    .eq("is_active", true)
    .order("name");
  return (data ?? [])
    .filter((u) => u.role === "SALESPERSON" || u.also_sells === true || u.role === "CLIENT_MANAGER")
    .map((u) => ({ id: u.id as string, name: (u.name as string) || "Teammate" }));
}
