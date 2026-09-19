import { createAdminClient } from "@/lib/supabase/admin";
import { graphCall } from "@/lib/facebook/graph";
import { revealFbPageToken } from "@/lib/facebook/client-tokens";
import { insertSocialMessage, upsertSocialConversation, upsertSocialIdentity } from "./ingest";
import type { SocialChannel, SocialProvider } from "./types";

type GraphPerson = { id?: string; name?: string; username?: string };
type GraphMessage = {
  id?: string;
  message?: string;
  created_time?: string;
  from?: GraphPerson;
  attachments?: { data?: Array<{ type?: string; title?: string }> };
};
type GraphConversation = {
  id?: string;
  updated_time?: string;
  participants?: { data?: GraphPerson[] };
  messages?: { data?: GraphMessage[] };
};
type GraphComment = {
  id?: string;
  message?: string;
  text?: string;
  created_time?: string;
  timestamp?: string;
  from?: GraphPerson;
  username?: string;
};
type GraphPost = {
  id?: string;
  message?: string;
  caption?: string;
  permalink_url?: string;
  permalink?: string;
  comments?: { data?: GraphComment[] };
};

export type SocialSyncResult = {
  conversations: number;
  messages: number;
  comments: number;
  errors: string[];
};

const lastSyncByClient = new Map<string, number>();
const COOLDOWN_MS = 20_000;

export async function syncSocialInbox(clientId: string): Promise<SocialSyncResult> {
  const now = Date.now();
  const last = lastSyncByClient.get(clientId) ?? 0;
  if (now - last < COOLDOWN_MS) {
    return { conversations: 0, messages: 0, comments: 0, errors: [] };
  }

  const supabase = createAdminClient();
  const { data: connections } = await supabase
    .from("social_channel_connections")
    .select("id, provider, page_id, ig_account_id, token_sealed, status, is_demo")
    .eq("client_id", clientId)
    .neq("status", "disconnected");

  const result: SocialSyncResult = { conversations: 0, messages: 0, comments: 0, errors: [] };
  const live = (connections ?? []).filter((conn) => !conn.is_demo);
  if (!live.length) {
    return result;
  }

  lastSyncByClient.set(clientId, now);

  for (const conn of live) {
    const token = await revealFbPageToken(conn.token_sealed as string | null, clientId);
    if (!token) {
      result.errors.push("A connected Page is missing a usable Meta token. Reconnect Facebook.");
      await supabase
        .from("social_channel_connections")
        .update({
          last_error: "Missing Meta token. Reconnect Facebook.",
          status: "sync_issue",
          updated_at: new Date().toISOString(),
        })
        .eq("id", conn.id)
        .eq("client_id", clientId);
      continue;
    }
    const pageId = (conn.page_id as string | null) ?? null;
    const provider = conn.provider as SocialProvider;
    const connectionId = conn.id as string;
    const beforeErrors = result.errors.length;
    const beforeConversations = result.conversations;

    if (provider === "facebook" && pageId) {
      await runImport(result, "Messenger", () =>
        importMessengerThreads({
          clientId,
          connectionId,
          selfId: pageId,
          token,
          platform: "messenger",
          provider: "facebook",
          channel: "facebook_messenger",
        })
      );
      await runImport(result, "Page comments", () =>
        importFacebookComments({ clientId, connectionId, pageId, token })
      );
    }

    if (provider === "instagram" && conn.ig_account_id) {
      const igAccountId = conn.ig_account_id as string;
      await runImport(result, "Instagram DMs", () =>
        importMessengerThreads({
          clientId,
          connectionId,
          selfId: igAccountId,
          token,
          platform: "instagram",
          provider: "instagram",
          channel: "instagram_dm",
          pathId: pageId || igAccountId,
        })
      );
      await runImport(result, "Instagram comments", () =>
        importInstagramComments({ clientId, connectionId, igAccountId, token })
      );
    }

    const failed = result.errors.length > beforeErrors;
    const importedHere = result.conversations > beforeConversations;
    await supabase
      .from("social_channel_connections")
      .update({
        last_sync_at: new Date().toISOString(),
        last_error: failed ? result.errors.slice(beforeErrors).join(" ") : null,
        status: failed && !importedHere ? "sync_issue" : "connected",
        updated_at: new Date().toISOString(),
      })
      .eq("id", conn.id)
      .eq("client_id", clientId);
  }
  return result;
}

async function runImport(
  result: SocialSyncResult,
  label: string,
  work: () => Promise<{ conversations: number; messages?: number; comments?: number }>
) {
  try {
    const part = await work();
    result.conversations += part.conversations;
    result.messages += part.messages ?? 0;
    result.comments += part.comments ?? 0;
  } catch (error) {
    result.errors.push(`${label}: ${error instanceof Error ? error.message : "Sync failed."}`);
  }
}

async function graphList<T>(
  path: string,
  token: string,
  clientId: string,
  _pages = 2
): Promise<{ items: T[]; error?: string }> {
  const page = await graphCall<{ data?: unknown[] }>(path, token, {
    clientId,
    timeoutMs: 20000,
  });
  if (!page.ok) {
    return { items: [], error: page.error.message };
  }
  const rows = Array.isArray(page.data.data) ? page.data.data : [];
  return { items: rows as T[] };
}

function commentText(comment: GraphComment): string {
  return (comment.message ?? comment.text ?? "").trim();
}

function commentSentAt(comment: GraphComment): string {
  return comment.created_time ?? comment.timestamp ?? new Date().toISOString();
}

function messageBody(row: GraphMessage): string {
  const text = (row.message ?? "").trim();
  if (text) return text;
  const kind = row.attachments?.data?.[0]?.type ?? row.attachments?.data?.[0]?.title;
  if (kind) return `[${kind}]`;
  return "";
}

async function importMessengerThreads(opts: {
  clientId: string;
  connectionId: string;
  selfId: string;
  token: string;
  platform: "messenger" | "instagram";
  provider: SocialProvider;
  channel: SocialChannel;
  pathId?: string;
}): Promise<{ conversations: number; messages: number }> {
  const accountId = opts.pathId ?? opts.selfId;
  const listed = await graphList<GraphConversation>(
    `/${accountId}/conversations?platform=${opts.platform}&fields=participants,updated_time,messages.limit(30){id,message,from,created_time,attachments}&limit=25`,
    opts.token,
    opts.clientId
  );
  if (listed.error && !listed.items.length) {
    throw new Error(listed.error);
  }

  let conversations = 0;
  let messages = 0;
  for (const thread of listed.items) {
    const people = thread.participants?.data ?? [];
    const customer = people.find((p) => p.id && p.id !== opts.selfId && p.id !== accountId);
    if (!customer?.id) continue;
    const rows = (thread.messages?.data ?? [])
      .filter((m) => m.id)
      .sort((a, b) => Date.parse(a.created_time ?? "") - Date.parse(b.created_time ?? ""));
    if (!rows.length) continue;

    const latestInbound = [...rows].reverse().find((m) => m.from?.id && m.from.id !== opts.selfId) ?? rows.at(-1);
    const identityId = await upsertSocialIdentity({
      clientId: opts.clientId,
      provider: opts.provider,
      providerUserId: customer.id,
      displayName: customer.name ?? customer.username ?? null,
    });
    const preview = messageBody(latestInbound ?? {}) || messageBody(rows.at(-1) ?? {}) || "Message";
    const inboundAt = latestInbound?.created_time ?? thread.updated_time ?? new Date().toISOString();
    const convo = await upsertSocialConversation({
      clientId: opts.clientId,
      connectionId: opts.connectionId,
      identityId,
      provider: opts.provider,
      channel: opts.channel,
      kind: "dm",
      visibility: "private",
      threadId: customer.id,
      preview,
      inboundAt,
      unread: Boolean(latestInbound && latestInbound === rows.at(-1)),
    });
    conversations += 1;
    for (const row of rows) {
      const fromPage = row.from?.id === opts.selfId;
      const body = messageBody(row);
      if (!body) continue;
      const added = await insertSocialMessage({
        clientId: opts.clientId,
        conversationId: convo.conversationId,
        identityId: fromPage ? null : identityId,
        providerMessageId: row.id as string,
        body,
        visibility: "private",
        sentAt: row.created_time ?? inboundAt,
        direction: fromPage ? "outbound" : "inbound",
      });
      if (added) messages += 1;
    }
  }
  return { conversations, messages };
}

async function importFacebookComments(opts: {
  clientId: string;
  connectionId: string;
  pageId: string;
  token: string;
}): Promise<{ conversations: number; comments: number }> {
  const fields =
    "id,message,permalink_url,comments.limit(50).filter(stream){id,message,from,created_time}";
  const feed = await graphList<GraphPost>(
    `/${opts.pageId}/feed?fields=${fields}&limit=20`,
    opts.token,
    opts.clientId
  );
  const published = await graphList<GraphPost>(
    `/${opts.pageId}/published_posts?fields=${fields}&limit=15`,
    opts.token,
    opts.clientId
  );
  const visitors = await graphList<GraphPost>(
    `/${opts.pageId}/visitor_posts?fields=${fields}&limit=10`,
    opts.token,
    opts.clientId
  );

  const byId = new Map<string, GraphPost>();
  for (const post of [...feed.items, ...published.items, ...visitors.items]) {
    if (post.id) byId.set(post.id, post);
  }

  const hardError = !byId.size && (feed.error || published.error);
  if (hardError) {
    throw new Error(feed.error || published.error || "Could not load Page posts.");
  }

  let conversations = 0;
  let comments = 0;
  for (const post of byId.values()) {
    let rows = post.comments?.data ?? [];
    if (!rows.length && post.id) {
      const extra = await graphList<GraphComment>(
        `/${post.id}/comments?filter=stream&fields=id,message,from,created_time&limit=50`,
        opts.token,
        opts.clientId,
        2
      );
      rows = extra.items;
    }
    for (const comment of rows) {
      const saved = await persistComment({
        clientId: opts.clientId,
        connectionId: opts.connectionId,
        provider: "facebook",
        channel: "facebook_comment",
        pageId: opts.pageId,
        comment,
        post,
      });
      if (saved) {
        conversations += 1;
        comments += 1;
      }
    }
  }
  return { conversations, comments };
}

async function persistComment(opts: {
  clientId: string;
  connectionId: string;
  provider: SocialProvider;
  channel: SocialChannel;
  pageId?: string;
  comment: GraphComment;
  post: GraphPost;
}): Promise<boolean> {
  if (!opts.comment.id) return false;
  if (opts.pageId && opts.comment.from?.id === opts.pageId) return false;
  const text = commentText(opts.comment) || "Comment";
  const sentAt = commentSentAt(opts.comment);
  const fromId = opts.comment.from?.id ?? `anon:${opts.comment.id}`;
  const displayName =
    opts.comment.from?.name ?? opts.comment.from?.username ?? opts.comment.username ?? "Social visitor";
  const identityId = await upsertSocialIdentity({
    clientId: opts.clientId,
    provider: opts.provider,
    providerUserId: fromId,
    displayName,
  });
  const convo = await upsertSocialConversation({
    clientId: opts.clientId,
    connectionId: opts.connectionId,
    identityId,
    provider: opts.provider,
    channel: opts.channel,
    kind: "comment",
    visibility: "public",
    threadId: opts.comment.id,
    preview: text,
    inboundAt: sentAt,
    unread: true,
    origin: {
      kind: "post",
      postId: opts.post.id ?? null,
      permalink: opts.post.permalink_url ?? opts.post.permalink ?? null,
      caption: opts.post.message ?? opts.post.caption ?? null,
      customerQuote: text,
    },
  });
  return insertSocialMessage({
    clientId: opts.clientId,
    conversationId: convo.conversationId,
    identityId,
    providerMessageId: opts.comment.id,
    body: text,
    visibility: "public",
    sentAt,
    direction: "inbound",
  });
}

async function importInstagramComments(opts: {
  clientId: string;
  connectionId: string;
  igAccountId: string;
  token: string;
}): Promise<{ conversations: number; comments: number }> {
  const media = await graphList<{ id?: string; caption?: string; permalink?: string }>(
    `/${opts.igAccountId}/media?fields=id,caption,permalink&limit=15`,
    opts.token,
    opts.clientId
  );
  if (media.error && !media.items.length) {
    throw new Error(media.error);
  }

  let conversations = 0;
  let comments = 0;
  for (const item of media.items) {
    if (!item.id) continue;
    const listed = await graphList<GraphComment>(
      `/${item.id}/comments?fields=id,text,username,timestamp,from&limit=40`,
      opts.token,
      opts.clientId
    );
    for (const comment of listed.items) {
      const saved = await persistComment({
        clientId: opts.clientId,
        connectionId: opts.connectionId,
        provider: "instagram",
        channel: "instagram_comment",
        comment,
        post: item,
      });
      if (saved) {
        conversations += 1;
        comments += 1;
      }
    }
  }
  return { conversations, comments };
}
