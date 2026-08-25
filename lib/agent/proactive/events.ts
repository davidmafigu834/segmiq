import { createAdminClient } from "@/lib/supabase/admin";
import { background } from "@/lib/background";
import { now } from "@/lib/clock";
import type { ActorType, DomainEvent, EntityType } from "./types";
import { eventFingerprint } from "./registry";

export type EmitInput = {
  clientId: string;
  type: string;
  entityType: EntityType;
  entityId: string;
  actorType: ActorType;
  actorId?: string | null;
  occurredAt?: Date;
  payload?: Record<string, unknown>;
  correlationId?: string | null;
  causationId?: string | null;
  source?: string;
  /** Required for replay safety — unique per logical occurrence. */
  idempotencyKey: string;
};

/**
 * Write to the outbox. Duplicate fingerprints are ignored.
 * Processing is kicked off in the background so CRM writes are not blocked.
 */
export async function emitDomainEvent(input: EmitInput): Promise<string | null> {
  try {
    const fingerprint = eventFingerprint({
      clientId: input.clientId,
      type: input.type,
      entityId: input.entityId,
      idempotencyKey: input.idempotencyKey,
    });
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("agent_domain_events")
      .insert({
        client_id: input.clientId,
        fingerprint,
        type: input.type,
        entity_type: input.entityType,
        entity_id: input.entityId,
        actor_type: input.actorType,
        actor_id: input.actorId ?? null,
        occurred_at: (input.occurredAt ?? now()).toISOString(),
        payload: input.payload ?? {},
        correlation_id: input.correlationId ?? null,
        causation_id: input.causationId ?? null,
        source: input.source ?? "crm",
      })
      .select("id")
      .maybeSingle();
    if (error) {
      if (error.code === "23505") return null;
      console.error("[proactive] emit failed", error.message);
      return null;
    }
    const id = data?.id as string | undefined;
    if (id) {
      background("proactiveEvent", () => processDomainEventById(id));
    }
    return id ?? null;
  } catch (err) {
    console.error("[proactive] emit failed", err);
    return null;
  }
}

export async function processDomainEventById(eventId: string): Promise<void> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("agent_domain_events").select("*").eq("id", eventId).maybeSingle();
  if (!data || data.processed_at) return;
  const event: DomainEvent = {
    id: data.id as string,
    clientId: data.client_id as string,
    type: data.type as string,
    entityType: data.entity_type as EntityType,
    entityId: data.entity_id as string,
    actorType: data.actor_type as ActorType,
    actorId: (data.actor_id as string | null) ?? null,
    occurredAt: new Date(data.occurred_at as string),
    payload: (data.payload as Record<string, unknown>) ?? {},
    correlationId: (data.correlation_id as string | null) ?? null,
    causationId: (data.causation_id as string | null) ?? null,
    source: (data.source as string | null) ?? undefined,
    version: Number(data.version) || 1,
    fingerprint: data.fingerprint as string,
  };
  try {
    const { handleDomainEvent } = await import("./handlers");
    await handleDomainEvent(event);
    await supabase
      .from("agent_domain_events")
      .update({ processed_at: now().toISOString(), process_error: null })
      .eq("id", eventId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[proactive] event handler failed", { eventId, message });
    await supabase.from("agent_domain_events").update({ process_error: message.slice(0, 500) }).eq("id", eventId);
  }
}

export async function drainUnprocessedEvents(limit = 50): Promise<number> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("agent_domain_events")
    .select("id")
    .is("processed_at", null)
    .order("created_at", { ascending: true })
    .limit(limit);
  let n = 0;
  for (const row of data ?? []) {
    await processDomainEventById(row.id as string);
    n += 1;
  }
  return n;
}
