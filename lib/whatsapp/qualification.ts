import { createAdminClient } from "@/lib/supabase/admin";
import { background } from "@/lib/background";
import { parseLeadFields } from "@/lib/lead-helpers";
import { processLeadIntelligence } from "@/lib/lead-intelligence";
import {
  countFlowQuestions,
  getNextFlowQuestion,
  loadQualificationFlow,
  type QualificationFlow,
  type QualificationFlowSource,
} from "@/lib/whatsapp/load-qualification-flow";
import { formatQuestionMessage, type WhatsAppQualQuestion } from "@/lib/whatsapp/qualification-questions";
import { sendWhatsAppSessionMessage } from "@/lib/whatsapp/session-message";

type QualificationState = {
  in_progress: boolean;
  completed?: boolean;
  source?: QualificationFlowSource;
  form_id?: string | null;
  answers: Record<string, string>;
  asked_ids: string[];
  pending_question_id: string | null;
};

function readQualState(formData: Record<string, unknown> | null): QualificationState | null {
  const raw = formData?._qualification;
  if (!raw || typeof raw !== "object") return null;
  const q = raw as Record<string, unknown>;
  if (q.completed === true) {
    return {
      in_progress: false,
      completed: true,
      answers: {},
      asked_ids: [],
      pending_question_id: null,
    };
  }
  if (q.in_progress !== true) return null;

  // Legacy next_index state from earlier builds — treat as restart if no pending id.
  if (typeof q.next_index === "number" && !q.pending_question_id) return null;

  return {
    in_progress: true,
    completed: false,
    source: q.source as QualificationFlowSource | undefined,
    form_id: (q.form_id as string | null) ?? null,
    answers: (q.answers as Record<string, string>) ?? {},
    asked_ids: Array.isArray(q.asked_ids) ? (q.asked_ids as string[]) : [],
    pending_question_id: (q.pending_question_id as string | null) ?? null,
  };
}

function leadFieldUpdate(mapsTo: string, value: string): Record<string, unknown> {
  const v = value.trim();
  if (!v) return {};
  switch (mapsTo) {
    case "project_type":
      return { project_type: v };
    case "budget":
      return { budget: v };
    case "timeline":
      return { timeline: v };
    default:
      return {};
  }
}

async function sendQualificationText(opts: {
  clientId: string;
  leadId: string;
  phone: string;
  text: string;
}): Promise<boolean> {
  const result = await sendWhatsAppSessionMessage({
    to: opts.phone,
    body: opts.text,
    clientId: opts.clientId,
    leadId: opts.leadId,
    actorId: "system",
    actorName: "Segmiq",
  });
  return result.ok;
}

function mergeFormData(
  existing: Record<string, unknown>,
  flow: QualificationFlow,
  qualState: QualificationState
): Record<string, unknown> {
  const merged: Record<string, unknown> = {
    ...existing,
    _qualification: qualState,
  };
  if (flow.formId) {
    merged._instantFormId = flow.formId;
    if (flow.formName) merged._instantFormName = flow.formName;
  }
  for (const q of flow.questions) {
    const val = qualState.answers[q.id];
    if (val?.trim()) {
      merged[q.maps_to] = val.trim();
      merged[q.label] = val.trim();
    }
  }
  return merged;
}

function findQuestion(flow: QualificationFlow, questionId: string): WhatsAppQualQuestion | null {
  return flow.questions.find((q) => q.id === questionId) ?? null;
}

export async function processWhatsAppQualification(opts: {
  clientId: string;
  clientName: string;
  leadId: string;
  phone: string;
  inboundBody: string;
  isNewLead: boolean;
}): Promise<void> {
  const flow = await loadQualificationFlow(opts.clientId);
  if (!flow || flow.questions.length === 0) return;

  const supabase = createAdminClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("form_data, status, budget, project_type, timeline")
    .eq("id", opts.leadId)
    .maybeSingle();
  if (!lead) return;

  const formData = (lead.form_data as Record<string, unknown> | null) ?? {};
  const qual = readQualState(formData);
  if (qual?.completed) return;

  const answerText = opts.inboundBody.trim();

  if (opts.isNewLead) {
    const first = getNextFlowQuestion(flow, {}, new Set());
    if (!first) return;

    const total = countFlowQuestions(flow, {});
    const intro = `${flow.intro}\n\n${formatQuestionMessage(first, 0, total)}`;
    const sent = await sendQualificationText({
      clientId: opts.clientId,
      leadId: opts.leadId,
      phone: opts.phone,
      text: intro,
    });
    if (!sent) return;

    const nextState: QualificationState = {
      in_progress: true,
      source: flow.source,
      form_id: flow.formId,
      answers: {},
      asked_ids: [],
      pending_question_id: first.id,
    };
    await supabase
      .from("leads")
      .update({
        form_data: mergeFormData(formData, flow, nextState),
        updated_at: new Date().toISOString(),
      })
      .eq("id", opts.leadId);
    return;
  }

  if (!qual?.in_progress || !qual.pending_question_id) return;

  const pending = findQuestion(flow, qual.pending_question_id);
  if (!pending) return;

  if (!answerText) {
    const total = countFlowQuestions(flow, qual.answers);
    const reask = formatQuestionMessage(pending, qual.asked_ids.length, total);
    await sendQualificationText({
      clientId: opts.clientId,
      leadId: opts.leadId,
      phone: opts.phone,
      text: `Please send a text reply.\n\n${reask}`,
    });
    return;
  }

  qual.answers[pending.id] = answerText;
  qual.asked_ids = [...qual.asked_ids, pending.id];

  const fieldPatch = leadFieldUpdate(String(pending.maps_to), answerText);
  const parsed = parseLeadFields({
    ...formData,
    ...qual.answers,
    [pending.maps_to]: answerText,
  });

  const leadUpdates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    ...fieldPatch,
  };
  if (parsed.budget) leadUpdates.budget = parsed.budget;
  if (parsed.project_type) leadUpdates.project_type = parsed.project_type;
  if (parsed.timeline) leadUpdates.timeline = parsed.timeline;

  const askedSet = new Set(qual.asked_ids);
  const next = getNextFlowQuestion(flow, qual.answers, askedSet);

  if (next) {
    const total = countFlowQuestions(flow, qual.answers);
    const sent = await sendQualificationText({
      clientId: opts.clientId,
      leadId: opts.leadId,
      phone: opts.phone,
      text: formatQuestionMessage(next, qual.asked_ids.length, total),
    });
    if (!sent) return;

    qual.pending_question_id = next.id;
    leadUpdates.form_data = mergeFormData(formData, flow, qual);
    await supabase.from("leads").update(leadUpdates).eq("id", opts.leadId);
    return;
  }

  leadUpdates.form_data = mergeFormData(formData, flow, {
    in_progress: false,
    completed: true,
    source: flow.source,
    form_id: flow.formId,
    answers: qual.answers,
    asked_ids: qual.asked_ids,
    pending_question_id: null,
  });
  if (lead.status === "NEW") leadUpdates.status = "CONTACTED";

  await supabase.from("leads").update(leadUpdates).eq("id", opts.leadId);

  await sendQualificationText({
    clientId: opts.clientId,
    leadId: opts.leadId,
    phone: opts.phone,
    text: flow.completion,
  });

  background("processLeadIntelligence", () => processLeadIntelligence(opts.leadId));
}
