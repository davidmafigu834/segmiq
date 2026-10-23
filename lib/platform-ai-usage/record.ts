import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { canObserveClient } from "./flags";
import type { ConversationObservation } from "./types";

function subjectHash(input: ConversationObservation): string {
  return createHash("sha256")
    .update(`${input.clientId}:${input.channel}:${input.subjectKey}`)
    .digest("hex");
}

export async function recordBillableAiConversation(
  input: ConversationObservation,
): Promise<{ recorded: boolean; outcome: string }> {
  if (!canObserveClient(input.clientId)) {
    return { recorded: false, outcome: "observer_disabled" };
  }

  const db = createAdminClient();
  const { data, error } = await db.rpc(
    "platform_record_ai_customer_conversation",
    {
      p_client_id: input.clientId,
      p_source_event_key: input.sourceEventKey,
      p_subject_key_hash: subjectHash(input),
      p_channel: input.channel,
      p_occurred_at: input.occurredAt,
      p_successful: input.successful,
      p_test_mode: input.testMode,
      // 4D is deliberately not wired. Shadow observations cannot become
      // financial merely because an environment flag was set.
      p_financial_requested: false,
    },
  );
  if (error) {
    console.error(
      "[platform-ai-usage] shadow conversation observation failed",
      {
        code: error.code,
        clientId: input.clientId,
        sourceEventKey: input.sourceEventKey,
      },
    );
    return { recorded: false, outcome: "storage_failed" };
  }
  const result = data as { outcome?: string } | null;
  return { recorded: true, outcome: result?.outcome ?? "recorded" };
}

export async function recordBillableAiAction(input: {
  clientId: string;
  actionId: string;
  occurredAt: string;
}): Promise<{ recorded: boolean; outcome: string }> {
  if (!canObserveClient(input.clientId)) {
    return { recorded: false, outcome: "observer_disabled" };
  }
  const db = createAdminClient();
  const { data, error } = await db.rpc("platform_record_ai_internal_action", {
    p_client_id: input.clientId,
    p_source_action_id: input.actionId,
    p_source_event_key: `agent-action:${input.actionId}`,
    p_occurred_at: input.occurredAt,
    p_financial_requested: false,
  });
  if (error) {
    console.error("[platform-ai-usage] shadow action observation failed", {
      code: error.code,
      clientId: input.clientId,
      actionId: input.actionId,
    });
    return { recorded: false, outcome: "storage_failed" };
  }
  const result = data as { outcome?: string } | null;
  return { recorded: true, outcome: result?.outcome ?? "recorded" };
}
