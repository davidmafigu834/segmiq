import { createAdminClient } from "@/lib/supabase/admin";
import {
  announcementVisible,
  canPublishAnnouncements,
  filterImportantMessages,
  mapIntroductionNotification,
  safeInternalPath,
  type AnnouncementAudience,
  type ImportantMessage,
} from "@/lib/important-messages/model";

export type ImportantFeed = {
  items: ImportantMessage[];
  announcementsAvailable: boolean;
  error: string | null;
};

function missingRelation(error: { message?: string; code?: string } | null): boolean {
  const message = error?.message ?? "";
  return error?.code === "42P01" || error?.code === "42703" || /schema cache|does not exist/i.test(message);
}

export async function loadImportantMessages(input: {
  userId: string;
  role: string | null;
  clientId: string | null;
  now?: Date;
}): Promise<ImportantFeed> {
  const supabase = createAdminClient();
  const now = input.now ?? new Date();
  let businessType: string | null = null;
  if (input.clientId) {
    const client = await supabase.from("clients").select("business_type").eq("id", input.clientId).maybeSingle();
    businessType = (client.data?.business_type as string | null) ?? null;
  }

  const primary = await supabase
    .from("notifications")
    .select("id, message, read, created_at, introduction_id")
    .eq("user_id", input.userId)
    .eq("type", "BUYER_INTRODUCTION")
    .order("created_at", { ascending: false })
    .limit(40);

  let notificationRows = primary.data;
  let notificationError = primary.error?.message ?? null;
  if (primary.error && missingRelation(primary.error)) {
    notificationRows = [];
    notificationError = null;
  }

  const items: ImportantMessage[] = [];
  for (const row of notificationRows ?? []) {
    const mapped = mapIntroductionNotification({
      id: row.id as string,
      message: String(row.message ?? ""),
      read: Boolean(row.read),
      createdAt: String(row.created_at),
      introductionId: (row.introduction_id as string | null) ?? null,
      role: input.role,
    });
    if (mapped) items.push(mapped);
  }

  const announcements = await supabase
    .from("platform_announcements")
    .select("id, title, summary, category, audience, industry, role_target, client_id, href, status, published_at, expires_at")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(30);

  let announcementsAvailable = true;
  if (announcements.error && missingRelation(announcements.error)) {
    announcementsAvailable = false;
  } else if (announcements.error) {
    return { items: filterImportantMessages(items, "all"), announcementsAvailable: false, error: "Could not load important messages." };
  } else {
    const ids = (announcements.data ?? []).map((row) => row.id as string);
    const reads = ids.length
      ? await supabase
          .from("platform_announcement_reads")
          .select("announcement_id")
          .eq("user_id", input.userId)
          .in("announcement_id", ids)
      : { data: [], error: null };
    if (reads.error && !missingRelation(reads.error)) {
      return { items: filterImportantMessages(items, "all"), announcementsAvailable: false, error: "Could not load important messages." };
    }
    const readIds = new Set((reads.data ?? []).map((row) => row.announcement_id as string));
    for (const row of announcements.data ?? []) {
      const audience = row.audience as AnnouncementAudience;
      const visible = announcementVisible({
        status: String(row.status),
        publishedAt: (row.published_at as string | null) ?? null,
        expiresAt: (row.expires_at as string | null) ?? null,
        now,
        audience,
        industry: (row.industry as string | null) ?? null,
        roleTarget: (row.role_target as string | null) ?? null,
        clientId: (row.client_id as string | null) ?? null,
        viewerRole: input.role,
        viewerClientId: input.clientId,
        viewerBusinessType: businessType,
      });
      if (!visible) continue;
      const notice = row.category === "notice";
      items.push({
        id: `announcement:${row.id as string}`,
        source: "announcement",
        category: "whats_new",
        priority: notice ? "notice" : "info",
        title: String(row.title),
        description: String(row.summary),
        createdAt: String(row.published_at ?? now.toISOString()),
        read: readIds.has(row.id as string),
        href: safeInternalPath((row.href as string | null) ?? null),
        actionLabel: safeInternalPath((row.href as string | null) ?? null) ? "View update" : null,
        resolved: false,
      });
    }
  }

  if (notificationError && items.length === 0 && !announcementsAvailable) {
    return { items: [], announcementsAvailable, error: "Could not load important messages." };
  }
  return { items: filterImportantMessages(items, "all"), announcementsAvailable, error: null };
}

export async function markImportantMessagesRead(input: {
  userId: string;
  notificationIds: string[];
  announcementIds: string[];
}): Promise<{ ok: boolean; error: string | null }> {
  const supabase = createAdminClient();
  if (input.notificationIds.length > 0) {
    const update = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", input.userId)
      .in("id", input.notificationIds.slice(0, 40));
    if (update.error) return { ok: false, error: "Could not update messages." };
  }
  if (input.announcementIds.length > 0) {
    const rows = input.announcementIds.slice(0, 40).map((announcementId) => ({
      announcement_id: announcementId,
      user_id: input.userId,
      read_at: new Date().toISOString(),
    }));
    const insert = await supabase.from("platform_announcement_reads").upsert(rows, { onConflict: "announcement_id,user_id" });
    if (insert.error && !missingRelation(insert.error)) return { ok: false, error: "Could not update messages." };
  }
  return { ok: true, error: null };
}

export { canPublishAnnouncements };
