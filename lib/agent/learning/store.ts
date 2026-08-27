import { createAdminClient } from "@/lib/supabase/admin";
import { asRow, asRows } from "@/lib/agent/rows";
import { now } from "@/lib/clock";
import { brainCollections } from "@/lib/company-brain/store";
import { invalidateBrainCache } from "@/lib/company-brain/cache";
import { recordLearningAudit } from "./audit";
import {
  computeConfidence,
  intentHintsForCategory,
  isSurfacedCandidate,
  knowledgeSourceFromCandidate,
  semanticKey,
  shouldSurfaceCandidate,
  suppressionAllowsResurface,
} from "./policy";
import type {
  KnowledgeCompareResult,
  LearningCandidate,
  LearningCategory,
  LearningDestination,
  LearningObservation,
  LearningType,
  LearnedKnowledge,
} from "./types";

type Row = Record<string, unknown>;

function candidateFromRow(row: Row): LearningCandidate {
  return {
    id: row.id as string,
    clientId: row.client_id as string,
    type: row.type as LearningType,
    category: row.category as LearningCategory,
    title: row.title as string,
    summary: row.summary as string,
    proposedLearning: row.proposed_learning as string,
    originalProposedLearning: (row.original_proposed_learning as string | null) ?? null,
    confidenceLevel: row.confidence_level as LearningCandidate["confidenceLevel"],
    confidenceScore: row.confidence_score == null ? null : Number(row.confidence_score),
    evidenceCount: Number(row.evidence_count) || 0,
    conversationCount: Number(row.conversation_count) || 0,
    salespersonCount: Number(row.salesperson_count) || 0,
    riskLevel: row.risk_level as LearningCandidate["riskLevel"],
    comparisonState: row.comparison_state as LearningCandidate["comparisonState"],
    existingKnowledgeType: (row.existing_knowledge_type as string | null) ?? null,
    existingKnowledgeId: (row.existing_knowledge_id as string | null) ?? null,
    existingKnowledgeSummary: (row.existing_knowledge_summary as string | null) ?? null,
    status: row.status as LearningCandidate["status"],
    semanticKey: row.semantic_key as string,
    previouslyRejected: Boolean(row.previously_rejected),
    resurfacedAt: (row.resurfaced_at as string | null) ?? null,
    firstObservedAt: row.first_observed_at as string,
    lastObservedAt: row.last_observed_at as string,
    reviewedAt: (row.reviewed_at as string | null) ?? null,
    reviewedBy: (row.reviewed_by as string | null) ?? null,
    rejectionReason: (row.rejection_reason as string | null) ?? null,
    managerFeedback: (row.manager_feedback as LearningCandidate["managerFeedback"]) ?? null,
    managerComment: (row.manager_comment as string | null) ?? null,
    source: row.source as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function knowledgeFromRow(row: Row): LearnedKnowledge {
  return {
    id: row.id as string,
    clientId: row.client_id as string,
    candidateId: (row.candidate_id as string | null) ?? null,
    category: row.category as string,
    title: row.title as string,
    content: row.content as string,
    originalContent: (row.original_content as string | null) ?? null,
    source: row.source as LearnedKnowledge["source"],
    status: row.status as LearnedKnowledge["status"],
    confidenceLevel: row.confidence_level as LearnedKnowledge["confidenceLevel"],
    evidenceCount: Number(row.evidence_count) || 0,
    conversationCount: Number(row.conversation_count) || 0,
    salespersonCount: Number(row.salesperson_count) || 0,
    usageCount: Number(row.usage_count) || 0,
    approvedBy: (row.approved_by as string | null) ?? null,
    approvedAt: (row.approved_at as string | null) ?? null,
    firstObservedAt: (row.first_observed_at as string | null) ?? null,
    lastObservedAt: (row.last_observed_at as string | null) ?? null,
    lastReinforcedAt: (row.last_reinforced_at as string | null) ?? null,
    destinationType: (row.destination_type as string | null) ?? null,
    destinationId: (row.destination_id as string | null) ?? null,
    supersededBy: (row.superseded_by as string | null) ?? null,
    intentHints: Array.isArray(row.intent_hints) ? (row.intent_hints as string[]) : [],
    semanticKey: row.semantic_key as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

async function recountCandidate(candidateId: string, clientId: string): Promise<void> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("agent_learning_evidence")
    .select("conversation_id, salesperson_id")
    .eq("candidate_id", candidateId)
    .eq("client_id", clientId);
  const rows = asRows<{ conversation_id: string | null; salesperson_id: string | null }>(data);
  const conversations = new Set(rows.map((r) => r.conversation_id).filter(Boolean));
  const salespeople = new Set(rows.map((r) => r.salesperson_id).filter(Boolean));
  const confidence = computeConfidence({
    conversationCount: conversations.size,
    salespersonCount: salespeople.size,
  });
  await supabase
    .from("agent_learning_candidates")
    .update({
      evidence_count: rows.length,
      conversation_count: conversations.size,
      salesperson_count: salespeople.size,
      confidence_level: confidence,
      last_observed_at: now().toISOString(),
      updated_at: now().toISOString(),
    })
    .eq("id", candidateId)
    .eq("client_id", clientId);
}

export async function ingestObservation(opts: {
  clientId: string;
  observation: LearningObservation;
  comparison: KnowledgeCompareResult;
  conversationId: string;
  salespersonId: string | null;
  customerId: string | null;
  dealId: string | null;
  source: string;
  excerpt: string;
  messageIds: string[];
  segmentStartId?: string | null;
  segmentEndId?: string | null;
  forceSurface?: boolean;
}): Promise<{ action: "created" | "reinforced" | "suppressed" | "knowledge_reinforced"; id: string | null }> {
  const supabase = createAdminClient();
  const key = semanticKey(opts.observation.type, opts.observation.category, opts.observation.title);
  const evidenceFp = [
    opts.clientId,
    opts.conversationId,
    opts.segmentStartId ?? opts.messageIds[0] ?? "none",
    opts.segmentEndId ?? opts.messageIds[opts.messageIds.length - 1] ?? "none",
    key,
  ].join(":");

  if (opts.comparison.state === "SUPPORTS_EXISTING" && opts.comparison.existingType === "LEARNED_KNOWLEDGE" && opts.comparison.existingId) {
    await attachEvidence({
      clientId: opts.clientId,
      candidateId: null,
      knowledgeId: opts.comparison.existingId,
      fingerprint: evidenceFp,
      ...opts,
    });
    await reinforceKnowledge(opts.clientId, opts.comparison.existingId);
    return { action: "knowledge_reinforced", id: opts.comparison.existingId };
  }

  if (opts.comparison.state === "DUPLICATES" && opts.comparison.existingId) {
    await attachEvidence({
      clientId: opts.clientId,
      candidateId: opts.comparison.existingId,
      knowledgeId: null,
      fingerprint: evidenceFp,
      ...opts,
    });
    await recountCandidate(opts.comparison.existingId, opts.clientId);
    return { action: "reinforced", id: opts.comparison.existingId };
  }

  const { data: suppression } = await supabase
    .from("agent_learning_suppressions")
    .select("evidence_at_rejection, rejected_at")
    .eq("client_id", opts.clientId)
    .eq("semantic_key", key)
    .maybeSingle();

  const surface =
    opts.forceSurface ||
    shouldSurfaceCandidate({
      conversationCount: 1,
      salespersonCount: opts.salespersonId ? 1 : 0,
      isExplicitTeach: opts.source === "TEACH_SEGMIQ",
      isCorrection: opts.observation.type === "CORRECTION",
      isConflict: opts.comparison.state === "CONFLICTS" || opts.observation.type === "CONFLICT",
      isSafety: opts.observation.type === "CORRECTION",
      oneOffException: opts.observation.oneOffException,
      riskLevel: opts.observation.riskLevel,
    });

  if (suppression && !surface) {
    return { action: "suppressed", id: null };
  }

  let previouslyRejected = false;
  let resurfacedAt: string | null = null;
  if (suppression) {
    const days = Math.floor(
      (now().getTime() - new Date(String((suppression as Row).rejected_at)).getTime()) / 86_400_000
    );
    const allow = suppressionAllowsResurface({
      evidenceAtRejection: Number((suppression as Row).evidence_at_rejection) || 0,
      currentEvidenceCount: 8,
      currentSalespersonCount: 3,
      daysSinceRejection: days,
    });
    if (!allow && opts.source !== "TEACH_SEGMIQ") return { action: "suppressed", id: null };
    previouslyRejected = true;
    resurfacedAt = now().toISOString();
  }

  if (!surface && opts.comparison.state !== "CONFLICTS") {
    const { data: existing } = await supabase
      .from("agent_learning_candidates")
      .select("id")
      .eq("client_id", opts.clientId)
      .eq("semantic_key", key)
      .in("status", ["DETECTED", "REVIEWING"])
      .maybeSingle();
    if (existing) {
      await attachEvidence({
        clientId: opts.clientId,
        candidateId: (existing as Row).id as string,
        knowledgeId: null,
        fingerprint: evidenceFp,
        ...opts,
      });
      await recountCandidate((existing as Row).id as string, opts.clientId);
      return { action: "reinforced", id: (existing as Row).id as string };
    }
    const inserted = await insertCandidate(opts, key, previouslyRejected, resurfacedAt);
    if (inserted) {
      await attachEvidence({
        clientId: opts.clientId,
        candidateId: inserted.id,
        knowledgeId: null,
        fingerprint: evidenceFp,
        ...opts,
      });
      await recountCandidate(inserted.id, opts.clientId);
    }
    return { action: "created", id: inserted?.id ?? null };
  }

  const inserted = await insertCandidate(opts, key, previouslyRejected, resurfacedAt);
  if (inserted) {
    await attachEvidence({
      clientId: opts.clientId,
      candidateId: inserted.id,
      knowledgeId: null,
      fingerprint: evidenceFp,
      ...opts,
    });
    await recountCandidate(inserted.id, opts.clientId);
    await recordLearningAudit({
      clientId: opts.clientId,
      action: "candidate_created",
      entityType: "LEARNING_CANDIDATE",
      entityId: inserted.id,
      summary: inserted.title,
    });
  }
  return { action: "created", id: inserted?.id ?? null };
}

async function insertCandidate(
  opts: {
    clientId: string;
    observation: LearningObservation;
    comparison: KnowledgeCompareResult;
    source: string;
  },
  key: string,
  previouslyRejected: boolean,
  resurfacedAt: string | null
): Promise<LearningCandidate | null> {
  const supabase = createAdminClient();
  const obs = opts.observation;
  const { data, error } = await supabase
    .from("agent_learning_candidates")
    .insert({
      client_id: opts.clientId,
      type: obs.oneOffException && obs.riskLevel === "VERY_HIGH" ? "CONFLICT" : obs.type,
      category: obs.category,
      title: obs.title,
      summary: obs.summary,
      proposed_learning: obs.oneOffException
        ? "Discount or commercial exceptions should be escalated for approval. Do not generalize a one-off offer."
        : obs.proposedLearning,
      original_proposed_learning: obs.proposedLearning,
      confidence_level: obs.confidence,
      risk_level: obs.riskLevel,
      comparison_state: opts.comparison.state,
      existing_knowledge_type: opts.comparison.existingType ?? null,
      existing_knowledge_id: opts.comparison.existingId ?? null,
      existing_knowledge_summary: opts.comparison.summary,
      status: "DETECTED",
      semantic_key: key,
      previously_rejected: previouslyRejected,
      resurfaced_at: resurfacedAt,
      source: opts.source,
    })
    .select("*")
    .maybeSingle();
  if (error) {
    console.error("[learning] candidate insert failed", error.message);
    return null;
  }
  return data ? candidateFromRow(data as Row) : null;
}

async function attachEvidence(opts: {
  clientId: string;
  candidateId: string | null;
  knowledgeId: string | null;
  conversationId: string;
  salespersonId: string | null;
  customerId: string | null;
  dealId: string | null;
  source: string;
  excerpt: string;
  messageIds: string[];
  segmentStartId?: string | null;
  segmentEndId?: string | null;
  fingerprint: string;
}): Promise<void> {
  if (!opts.candidateId && !opts.knowledgeId) return;
  const supabase = createAdminClient();
  const { error } = await supabase.from("agent_learning_evidence").insert({
    client_id: opts.clientId,
    candidate_id: opts.candidateId,
    knowledge_id: opts.knowledgeId,
    conversation_id: opts.conversationId,
    message_ids: opts.messageIds,
    segment_start_message_id: opts.segmentStartId ?? opts.messageIds[0] ?? null,
    segment_end_message_id: opts.segmentEndId ?? opts.messageIds[opts.messageIds.length - 1] ?? null,
    salesperson_id: opts.salespersonId,
    customer_id: opts.customerId,
    deal_id: opts.dealId,
    source_type: opts.source,
    excerpt: opts.excerpt.slice(0, 400),
    fingerprint: opts.fingerprint,
  });
  if (error && error.code !== "23505") {
    console.error("[learning] evidence insert failed", error.message);
  }
}

async function reinforceKnowledge(clientId: string, knowledgeId: string): Promise<void> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("agent_learning_evidence")
    .select("conversation_id, salesperson_id")
    .eq("knowledge_id", knowledgeId)
    .eq("client_id", clientId);
  const rows = asRows<{ conversation_id: string | null; salesperson_id: string | null }>(data);
  const conversations = new Set(rows.map((r) => r.conversation_id).filter(Boolean));
  const salespeople = new Set(rows.map((r) => r.salesperson_id).filter(Boolean));
  await supabase
    .from("agent_learning_knowledge")
    .update({
      evidence_count: rows.length,
      conversation_count: conversations.size,
      salesperson_count: salespeople.size,
      last_reinforced_at: now().toISOString(),
      last_observed_at: now().toISOString(),
      confidence_level: computeConfidence({
        conversationCount: conversations.size,
        salespersonCount: salespeople.size,
      }),
      updated_at: now().toISOString(),
    })
    .eq("id", knowledgeId)
    .eq("client_id", clientId);
}

export async function listCandidates(
  clientId: string,
  tab: "discoveries" | "approved" | "conflicts" | "rejected"
): Promise<LearningCandidate[]> {
  const supabase = createAdminClient();
  let query = supabase.from("agent_learning_candidates").select("*").eq("client_id", clientId);
  if (tab === "discoveries") query = query.in("status", ["DETECTED", "REVIEWING"]).neq("comparison_state", "CONFLICTS");
  if (tab === "conflicts") query = query.eq("comparison_state", "CONFLICTS").in("status", ["DETECTED", "REVIEWING"]);
  if (tab === "rejected") query = query.eq("status", "REJECTED");
  if (tab === "approved") query = query.eq("status", "APPROVED");
  const { data } = await query.order("last_observed_at", { ascending: false }).limit(80);
  const rows = asRows<Row>(data).map(candidateFromRow);
  if (tab === "discoveries") {
    return rows.filter((c) =>
      isSurfacedCandidate({
        conversationCount: c.conversationCount,
        salespersonCount: c.salespersonCount,
        type: c.type,
        source: c.source,
        comparisonState: c.comparisonState,
        riskLevel: c.riskLevel,
      })
    );
  }
  return rows;
}

export async function getCandidate(clientId: string, id: string): Promise<LearningCandidate | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("agent_learning_candidates")
    .select("*")
    .eq("id", id)
    .eq("client_id", clientId)
    .maybeSingle();
  return data ? candidateFromRow(data as Row) : null;
}

export async function listEvidence(clientId: string, candidateId: string, limit = 6) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("agent_learning_evidence")
    .select("id, conversation_id, excerpt, observed_at, salesperson_id, source_type")
    .eq("client_id", clientId)
    .eq("candidate_id", candidateId)
    .order("observed_at", { ascending: false })
    .limit(limit);
  return asRows(data);
}

export async function listKnowledge(clientId: string, status?: string): Promise<LearnedKnowledge[]> {
  const supabase = createAdminClient();
  let query = supabase.from("agent_learning_knowledge").select("*").eq("client_id", clientId);
  if (status) query = query.eq("status", status);
  const { data } = await query.order("updated_at", { ascending: false }).limit(80);
  return asRows<Row>(data).map(knowledgeFromRow);
}

export async function getKnowledge(clientId: string, id: string): Promise<LearnedKnowledge | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("agent_learning_knowledge")
    .select("*")
    .eq("id", id)
    .eq("client_id", clientId)
    .maybeSingle();
  return data ? knowledgeFromRow(data as Row) : null;
}

export async function approveCandidate(opts: {
  clientId: string;
  candidateId: string;
  actorId: string;
  content?: string;
  destination?: LearningDestination;
  destinationId?: string | null;
  mergeIntoKnowledgeId?: string | null;
}): Promise<LearnedKnowledge | null> {
  const candidate = await getCandidate(opts.clientId, opts.candidateId);
  if (!candidate) return null;
  const supabase = createAdminClient();
  const content = (opts.content ?? candidate.proposedLearning).trim();

  if (opts.mergeIntoKnowledgeId) {
    await supabase
      .from("agent_learning_evidence")
      .update({ knowledge_id: opts.mergeIntoKnowledgeId })
      .eq("candidate_id", opts.candidateId)
      .eq("client_id", opts.clientId);
    await reinforceKnowledge(opts.clientId, opts.mergeIntoKnowledgeId);
    await supabase
      .from("agent_learning_candidates")
      .update({
        status: "MERGED",
        reviewed_at: now().toISOString(),
        reviewed_by: opts.actorId,
        updated_at: now().toISOString(),
      })
      .eq("id", opts.candidateId)
      .eq("client_id", opts.clientId);
    await recordLearningAudit({
      clientId: opts.clientId,
      actorId: opts.actorId,
      action: "candidate_merged",
      entityType: "LEARNING_CANDIDATE",
      entityId: opts.candidateId,
      summary: `Merged ${candidate.title}`,
    });
    return getKnowledge(opts.clientId, opts.mergeIntoKnowledgeId);
  }

  const dest = opts.destination ?? "LEARNED_KNOWLEDGE";
  let destinationId = opts.destinationId ?? null;
  if (dest === "FAQ") {
    const faq = await brainCollections.createFaq(opts.clientId, {
      question: candidate.title,
      approved_answer: content,
      category: candidate.category,
      active: true,
    });
    destinationId = faq.id;
  } else if (dest === "RESPONSE_EXAMPLE") {
    const example = await brainCollections.createExample(opts.clientId, {
      situation: candidate.title,
      preferred_response: content,
      category: "FOLLOW_UP",
      active: true,
    });
    destinationId = (example as { id?: string }).id ?? null;
  } else if (dest === "TERMINOLOGY" && candidate.type === "TERMINOLOGY") {
    await supabase.from("agent_learning_terminology").upsert(
      {
        client_id: opts.clientId,
        phrase: candidate.title,
        canonical_meaning: content,
        confidence_level: candidate.confidenceLevel,
        source: "SALES_TEAM_LEARNING",
        approved: true,
        evidence_count: candidate.evidenceCount,
        candidate_id: candidate.id,
        updated_at: now().toISOString(),
      },
      { onConflict: "client_id,phrase" }
    );
  }

  const { data, error } = await supabase
    .from("agent_learning_knowledge")
    .insert({
      client_id: opts.clientId,
      candidate_id: candidate.id,
      category: candidate.category,
      title: candidate.title,
      content,
      original_content: candidate.originalProposedLearning ?? candidate.proposedLearning,
      source: knowledgeSourceFromCandidate(candidate.source, candidate.type),
      status: "ACTIVE",
      confidence_level: candidate.confidenceLevel,
      evidence_count: candidate.evidenceCount,
      conversation_count: candidate.conversationCount,
      salesperson_count: candidate.salespersonCount,
      approved_by: opts.actorId,
      approved_at: now().toISOString(),
      first_observed_at: candidate.firstObservedAt,
      last_observed_at: candidate.lastObservedAt,
      last_reinforced_at: now().toISOString(),
      destination_type: dest,
      destination_id: destinationId,
      intent_hints: intentHintsForCategory(candidate.category),
      semantic_key: candidate.semanticKey,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  await supabase
    .from("agent_learning_candidates")
    .update({
      status: "APPROVED",
      proposed_learning: content,
      reviewed_at: now().toISOString(),
      reviewed_by: opts.actorId,
      updated_at: now().toISOString(),
    })
    .eq("id", candidate.id)
    .eq("client_id", opts.clientId);

  await supabase
    .from("agent_learning_evidence")
    .update({ knowledge_id: (data as Row).id })
    .eq("candidate_id", candidate.id)
    .eq("client_id", opts.clientId);

  await recordLearningAudit({
    clientId: opts.clientId,
    actorId: opts.actorId,
    action: "candidate_approved",
    entityType: "LEARNED_KNOWLEDGE",
    entityId: (data as Row).id as string,
    summary: `Learning approved — ${candidate.title}`,
  });
  invalidateBrainCache(opts.clientId);
  return knowledgeFromRow(data as Row);
}

export async function rejectCandidate(opts: {
  clientId: string;
  candidateId: string;
  actorId: string;
  reason?: string | null;
  feedback?: string | null;
}): Promise<void> {
  const candidate = await getCandidate(opts.clientId, opts.candidateId);
  if (!candidate) return;
  const supabase = createAdminClient();
  await supabase
    .from("agent_learning_candidates")
    .update({
      status: "REJECTED",
      reviewed_at: now().toISOString(),
      reviewed_by: opts.actorId,
      rejection_reason: opts.reason ?? null,
      manager_feedback: opts.feedback ?? null,
      updated_at: now().toISOString(),
    })
    .eq("id", opts.candidateId)
    .eq("client_id", opts.clientId);
  await supabase.from("agent_learning_suppressions").upsert(
    {
      client_id: opts.clientId,
      semantic_key: candidate.semanticKey,
      rejected_candidate_id: candidate.id,
      rejected_at: now().toISOString(),
      rejected_by: opts.actorId,
      evidence_at_rejection: candidate.evidenceCount,
    },
    { onConflict: "client_id,semantic_key" }
  );
  await recordLearningAudit({
    clientId: opts.clientId,
    actorId: opts.actorId,
    action: "candidate_rejected",
    entityType: "LEARNING_CANDIDATE",
    entityId: candidate.id,
    summary: `Rejected ${candidate.title}`,
  });
}

export async function deactivateKnowledge(opts: {
  clientId: string;
  knowledgeId: string;
  actorId: string;
}): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from("agent_learning_knowledge")
    .update({ status: "INACTIVE", updated_at: now().toISOString() })
    .eq("id", opts.knowledgeId)
    .eq("client_id", opts.clientId);
  await recordLearningAudit({
    clientId: opts.clientId,
    actorId: opts.actorId,
    action: "knowledge_deactivated",
    entityType: "LEARNED_KNOWLEDGE",
    entityId: opts.knowledgeId,
    summary: "Learned knowledge deactivated",
  });
}

export async function updateKnowledge(opts: {
  clientId: string;
  knowledgeId: string;
  actorId: string;
  title?: string;
  content: string;
}): Promise<void> {
  const current = await getKnowledge(opts.clientId, opts.knowledgeId);
  if (!current) return;
  const supabase = createAdminClient();
  await supabase.from("agent_learning_knowledge_versions").insert({
    knowledge_id: current.id,
    client_id: opts.clientId,
    content: current.content,
    title: current.title,
    changed_by: opts.actorId,
    change_summary: "Edited approved learning",
  });
  await supabase
    .from("agent_learning_knowledge")
    .update({
      title: opts.title ?? current.title,
      content: opts.content,
      updated_at: now().toISOString(),
    })
    .eq("id", opts.knowledgeId)
    .eq("client_id", opts.clientId);
}

export async function conversationLearningSummary(clientId: string, conversationId: string) {
  const supabase = createAdminClient();
  const { data: evidence } = await supabase
    .from("agent_learning_evidence")
    .select("id, candidate_id, knowledge_id, excerpt, source_type, observed_at")
    .eq("client_id", clientId)
    .eq("conversation_id", conversationId)
    .order("observed_at", { ascending: false })
    .limit(12);
  const rows = asRows<{
    id: string;
    candidate_id: string | null;
    knowledge_id: string | null;
    excerpt: string | null;
    source_type: string;
    observed_at: string;
  }>(evidence);
  const candidateIds = [...new Set(rows.map((r) => r.candidate_id).filter(Boolean))] as string[];
  let candidates: LearningCandidate[] = [];
  if (candidateIds.length) {
    const { data } = await supabase
      .from("agent_learning_candidates")
      .select("*")
      .eq("client_id", clientId)
      .in("id", candidateIds);
    candidates = asRows<Row>(data).map(candidateFromRow);
  }
  return { evidence: rows, candidates };
}

export async function sourceStats(clientId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("agent_learning_jobs")
    .select("source, status")
    .eq("client_id", clientId)
    .in("status", ["COMPLETED", "SKIPPED"]);
  const counts: Record<string, number> = {};
  for (const row of asRows<{ source: string; status: string }>(data)) {
    if (row.status !== "COMPLETED") continue;
    counts[row.source] = (counts[row.source] ?? 0) + 1;
  }
  return {
    sales: counts.CONVERSATION_SEGMENT ?? 0,
    support: 0,
    corrections: counts.HUMAN_CORRECTION ?? 0,
    teach: counts.TEACH_SEGMIQ ?? 0,
    managerFeedback: counts.MANAGER_FEEDBACK ?? 0,
  };
}

export async function summaryCounts(clientId: string) {
  const supabase = createAdminClient();
  const [{ data: openRows }, { count: conflicts }, { count: approved }, { count: rejected }] =
    await Promise.all([
      supabase
        .from("agent_learning_candidates")
        .select("conversation_count, salesperson_count, type, source, comparison_state, risk_level")
        .eq("client_id", clientId)
        .in("status", ["DETECTED", "REVIEWING"])
        .neq("comparison_state", "CONFLICTS"),
      supabase
        .from("agent_learning_candidates")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId)
        .eq("comparison_state", "CONFLICTS")
        .in("status", ["DETECTED", "REVIEWING"]),
      supabase
        .from("agent_learning_knowledge")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId)
        .eq("status", "ACTIVE"),
      supabase
        .from("agent_learning_candidates")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId)
        .eq("status", "REJECTED"),
    ]);
  const discoveries = asRows<{
    conversation_count: number;
    salesperson_count: number;
    type: string;
    source: string;
    comparison_state: string;
    risk_level: string;
  }>(openRows).filter((row) =>
    isSurfacedCandidate({
      conversationCount: Number(row.conversation_count) || 0,
      salespersonCount: Number(row.salesperson_count) || 0,
      type: row.type,
      source: row.source,
      comparisonState: row.comparison_state,
      riskLevel: row.risk_level as LearningCandidate["riskLevel"],
    })
  ).length;
  return {
    discoveries,
    conflicts: conflicts ?? 0,
    approved: approved ?? 0,
    rejected: rejected ?? 0,
  };
}

export { candidateFromRow, knowledgeFromRow };
