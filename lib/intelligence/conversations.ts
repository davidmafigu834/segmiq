import { createAdminClient } from "@/lib/supabase/admin";

export async function openConversation(input: {
  clientId: string;
  userId: string | null;
  contactId?: string | null;
  audience: "STAFF" | "PORTAL";
  contextType: string;
  contextId?: string | null;
}) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("ai_conversations")
    .insert({
      client_id: input.clientId,
      user_id: input.userId,
      contact_id: input.contactId ?? null,
      audience: input.audience,
      context_type: input.contextType,
      context_id: input.contextId ?? null,
    })
    .select("id")
    .single();
  return (data?.id as string | undefined) ?? null;
}

export async function appendMessage(input: {
  conversationId: string | null;
  clientId: string;
  role: "user" | "assistant";
  content: string;
}) {
  if (!input.conversationId) return;
  const supabase = createAdminClient();
  await supabase.from("ai_messages").insert({
    conversation_id: input.conversationId,
    client_id: input.clientId,
    role: input.role,
    content: input.content.slice(0, 4000),
  });
}
