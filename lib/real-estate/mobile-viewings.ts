/** Shared by viewing reads and the calendar: listing access never reveals a private buyer. */
export function mobileViewingDto(row: Record<string, unknown>): Record<string, unknown> & {permittedActions:string[];notificationEffects:{customerNotification:string}} {
  const full = row.access === "full";
  const fields = ["id","listing_id","agent_id","scheduled_at","status","listing","access","confirmation_status","updated_at","created_at","reschedule_count"];
  if (full) fields.push("contact_id","buyer_search_id","contact","instructions","feedback_text","feedback_sentiment","outcome","cancel_reason","follow_up_at");
  const dto = Object.fromEntries(fields.filter(k => k in row).map(k => [k,row[k]]));
  return { ...dto, permittedActions: full && row.buyer_search_id && ["scheduled","cancelled"].includes(String(row.status)) ? ["reschedule_viewing", ...(row.status === "scheduled" ? ["viewing_outcome"] : [])] : [], notificationEffects:{customerNotification:"NONE_ON_READ"} };
}
