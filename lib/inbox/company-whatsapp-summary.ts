import type { CompanyWhatsAppSummary, InboxConversation } from "./types";

export function computeCompanyWhatsAppSummary(
  conversations: InboxConversation[],
  options: { now?: Date; periodDays?: number } = {}
): CompanyWhatsAppSummary {
  const now = options.now ?? new Date();
  const periodDays = options.periodDays ?? 7;
  const periodStart = now.getTime() - periodDays * 24 * 60 * 60 * 1000;
  const active = conversations.filter((row) => row.conversationStatus === "OPEN");
  const newRows = conversations.filter(
    (row) => new Date(row.firstContactAt || row.createdAt).getTime() >= periodStart
  );
  const resolved = conversations.filter(
    (row) =>
      row.conversationStatus === "RESOLVED" &&
      Boolean(row.resolvedAt) &&
      new Date(row.resolvedAt as string).getTime() >= periodStart
  );
  const firstResponses = newRows
    .map((row) => row.firstResponseSeconds)
    .filter((value): value is number => value != null && value >= 0);

  return {
    active: active.length,
    newConversations: newRows.length,
    avgFirstResponseSeconds: firstResponses.length
      ? Math.round(firstResponses.reduce((sum, value) => sum + value, 0) / firstResponses.length)
      : null,
    resolved: resolved.length,
    unassigned: active.filter((row) => !row.assignedToId).length,
    waitingOnTeam: active.filter((row) => row.lastMessageDirection === "inbound").length,
    periodDays,
  };
}
