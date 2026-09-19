import { createAdminClient } from "@/lib/supabase/admin";
import { SCORE_HOT_MIN } from "@/lib/inbox/scoring";
import type { SalesActionRecommendation } from "@/lib/sales/intelligence/types";
import { isMissingSocialTable } from "./store";

/**
 * Hooks Social Inbox into "What should I focus on today?".
 * Recommendations deep-link to /sales/social-inbox?conversation=
 */
export async function listSocialFocusRecommendations(opts: {
  clientId: string;
  userId: string;
  planDate: string;
}): Promise<SalesActionRecommendation[]> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("social_conversations")
      .select(
        `
        id, assigned_to_id, unread, last_message_at, last_message_preview, channel, conversation_kind,
        identity:social_identities!social_conversations_identity_id_fkey (display_name),
        opportunity:social_opportunities!social_opportunities_conversation_id_fkey (
          intent_score, intent_band, follow_up_at, follow_up_reason, detected_product, status
        )
      `
      )
      .eq("client_id", opts.clientId)
      .eq("assigned_to_id", opts.userId)
      .neq("status", "archived")
      .neq("status", "resolved")
      .limit(40);
    if (error) {
      if (isMissingSocialTable(error)) return [];
      return [];
    }

    const recs: SalesActionRecommendation[] = [];
    for (const row of data ?? []) {
      const identity = Array.isArray(row.identity) ? row.identity[0] : row.identity;
      const opp = Array.isArray(row.opportunity) ? row.opportunity[0] : row.opportunity;
      const name = (identity as { display_name?: string | null } | null)?.display_name || "Social customer";
      const score = Number((opp as { intent_score?: number } | null)?.intent_score ?? 0);
      const followUpAt = (opp as { follow_up_at?: string | null } | null)?.follow_up_at ?? null;
      const product = (opp as { detected_product?: string | null } | null)?.detected_product ?? null;
      const href = `/sales/social-inbox?conversation=${row.id}`;
      const preview = (row.last_message_preview as string | null) ?? "";

      if (row.unread) {
        recs.push({
          id: `social-reply-${row.id}`,
          idempotencyKey: `social-reply:${opts.planDate}:${row.id}`,
          actionType: "RESPOND_TO_CUSTOMER",
          origin: "SYSTEM_RECOMMENDED",
          sourceEntityType: "social_conversation",
          sourceEntityId: row.id as string,
          attentionScore: Math.min(100, 55 + Math.round(score / 4) + (score >= SCORE_HOT_MIN ? 12 : 0)),
          title: name,
          subtitle: product,
          recommendedActionLabel: "Reply in Social Inbox",
          reasonCode: score >= SCORE_HOT_MIN ? "SOCIAL_HIGH_INTENT" : "SOCIAL_NEEDS_REPLY",
          reason:
            score >= SCORE_HOT_MIN
              ? `${name} showed buying intent on ${String(row.channel).replace(/_/g, " ")}. ${preview}`.slice(0, 180)
              : `${name} is waiting for a social reply. ${preview}`.slice(0, 180),
          urgencyLabel: score >= SCORE_HOT_MIN ? "High intent" : "Needs reply",
          dueAt: null,
          customer: {
            leadId: null,
            name,
            phone: null,
            score,
            scoreBand: score >= SCORE_HOT_MIN ? "Hot" : score >= 45 ? "Warm" : "Cold",
            source: String(row.channel).startsWith("instagram") ? "INSTAGRAM" : "FACEBOOK",
            status: null,
            projectType: product,
            dealValue: null,
          },
          availableActions: ["open_social"],
          metadata: { socialHref: href, conversationId: row.id },
        } as SalesActionRecommendation);
      }

      if (followUpAt) {
        const due = Date.parse(followUpAt);
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        if (Number.isFinite(due) && due <= start.getTime() + 24 * 3600_000) {
          recs.push({
            id: `social-follow-${row.id}`,
            idempotencyKey: `social-follow:${opts.planDate}:${row.id}`,
            actionType: "COMPLETE_FOLLOW_UP",
            origin: "SYSTEM_RECOMMENDED",
            sourceEntityType: "social_conversation",
            sourceEntityId: row.id as string,
            attentionScore: due < start.getTime() ? 82 : 70,
            title: name,
            subtitle: product,
            recommendedActionLabel: "Send follow-up",
            reasonCode: due < start.getTime() ? "FOLLOWUP_OVERDUE" : "SOCIAL_FOLLOWUP_DUE",
            reason:
              ((opp as { follow_up_reason?: string | null } | null)?.follow_up_reason as string | null) ||
              `Social follow-up is due for ${name}.`,
            urgencyLabel: due < start.getTime() ? "Overdue" : "Due today",
            dueAt: followUpAt,
            customer: {
              leadId: null,
              name,
              phone: null,
              score,
              scoreBand: score >= SCORE_HOT_MIN ? "Hot" : "Warm",
              source: String(row.channel).startsWith("instagram") ? "INSTAGRAM" : "FACEBOOK",
              status: null,
              projectType: product,
              dealValue: null,
            },
            availableActions: ["open_social"],
            metadata: { socialHref: href, conversationId: row.id },
          } as SalesActionRecommendation);
        }
      }
    }
    return recs;
  } catch {
    return [];
  }
}
