type ReminderLike = {
  semanticKey: string;
  actionType: string;
  evidenceMessageIds: string[];
};

function isMeetingReview(item: ReminderLike): boolean {
  return item.semanticKey.startsWith("meeting:") && !item.semanticKey.startsWith("meeting:request");
}

/** A call reminder is the same review when its message already confirms a meeting. */
export function withoutMeetingDuplicateReminders<T extends ReminderLike>(items: T[]): T[] {
  const covered = new Set(items.filter(isMeetingReview).flatMap((item) => item.evidenceMessageIds));
  if (covered.size === 0) return items;
  return items.filter((item) => {
    if (isMeetingReview(item)) return true;
    if (item.actionType !== "create_reminder" && item.actionType !== "update_reminder") return true;
    return !item.evidenceMessageIds.some((id) => covered.has(id));
  });
}
