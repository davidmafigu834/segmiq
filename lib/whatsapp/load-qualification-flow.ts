import { getVisibleQuestions } from "@/lib/instant-form-helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import type { InstantFormCompletion, InstantFormIntro, InstantFormQuestion } from "@/types";
import {
  WHATSAPP_QUAL_COMPLETE,
  WHATSAPP_QUAL_INTRO,
  normalizeClientQuestions,
  type WhatsAppQualQuestion,
} from "@/lib/whatsapp/qualification-questions";
import {
  getNextInstantQuestion,
  instantQuestionToWhatsApp,
  qualifyingInstantQuestions,
} from "@/lib/whatsapp/instant-form-qualification";

export type QualificationFlowSource = "instant_form" | "custom" | "form_schema" | "default";

export type QualificationFlow = {
  source: QualificationFlowSource;
  formId: string | null;
  formName: string | null;
  intro: string;
  completion: string;
  questions: WhatsAppQualQuestion[];
  instantQuestions: InstantFormQuestion[] | null;
};

function buildInstantIntro(intro: InstantFormIntro | null | undefined): string {
  const headline = intro?.headline?.trim();
  const body = intro?.body?.trim();
  const parts = [
    headline,
    body,
    "We already have your contact details from WhatsApp. A few quick questions help us qualify your enquiry.",
  ].filter(Boolean);
  return parts.join("\n\n");
}

function buildInstantCompletion(completion: InstantFormCompletion | null | undefined): string {
  const headline = completion?.headline?.trim();
  const body = completion?.body?.trim();
  if (headline && body) return `${headline}\n\n${body}`;
  if (body) return body;
  if (headline) return headline;
  return WHATSAPP_QUAL_COMPLETE;
}

async function loadInstantForm(
  clientId: string,
  formId: string | null
): Promise<{
  id: string;
  name: string;
  intro: InstantFormIntro;
  completion: InstantFormCompletion;
  questions: InstantFormQuestion[];
} | null> {
  const supabase = createAdminClient();

  if (formId) {
    const { data } = await supabase
      .from("instant_forms")
      .select("id, name, intro, completion, questions, status, client_id")
      .eq("id", formId)
      .eq("client_id", clientId)
      .eq("status", "published")
      .maybeSingle();
    if (data) {
      return {
        id: data.id as string,
        name: data.name as string,
        intro: (data.intro as InstantFormIntro) ?? {},
        completion: (data.completion as InstantFormCompletion) ?? {},
        questions: (data.questions as InstantFormQuestion[]) ?? [],
      };
    }
    // Explicit form selection that is missing or unpublished — do not fall back.
    return null;
  }

  const { data: published } = await supabase
    .from("instant_forms")
    .select("id, name, intro, completion, questions")
    .eq("client_id", clientId)
    .eq("status", "published")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!published) return null;
  return {
    id: published.id as string,
    name: published.name as string,
    intro: (published.intro as InstantFormIntro) ?? {},
    completion: (published.completion as InstantFormCompletion) ?? {},
    questions: (published.questions as InstantFormQuestion[]) ?? [],
  };
}

export async function loadQualificationFlow(clientId: string): Promise<QualificationFlow | null> {
  const supabase = createAdminClient();
  const { data: client } = await supabase
    .from("clients")
    .select(
      "whatsapp_qualification_enabled, whatsapp_qualification_questions, whatsapp_instant_form_id"
    )
    .eq("id", clientId)
    .maybeSingle();

  if (client?.whatsapp_qualification_enabled === false) return null;

  const instantForm = await loadInstantForm(
    clientId,
    (client?.whatsapp_instant_form_id as string | null) ?? null
  );

  if (instantForm) {
    const qualifying = qualifyingInstantQuestions(instantForm.questions);
    if (qualifying.length > 0) {
      return {
        source: "instant_form",
        formId: instantForm.id,
        formName: instantForm.name,
        intro: buildInstantIntro(instantForm.intro),
        completion: buildInstantCompletion(instantForm.completion),
        questions: qualifying.map(instantQuestionToWhatsApp),
        instantQuestions: qualifying,
      };
    }
  }

  const custom = normalizeClientQuestions(client?.whatsapp_qualification_questions);
  if (custom?.length) {
    return {
      source: "custom",
      formId: null,
      formName: null,
      intro: WHATSAPP_QUAL_INTRO,
      completion: WHATSAPP_QUAL_COMPLETE,
      questions: custom,
      instantQuestions: null,
    };
  }

  // Qualification is enabled but no published Instant Form is available.
  return null;
}

export function getNextFlowQuestion(
  flow: QualificationFlow,
  answers: Record<string, string>,
  askedIds: Set<string>
): WhatsAppQualQuestion | null {
  if (flow.instantQuestions) {
    const next = getNextInstantQuestion(flow.instantQuestions, answers, askedIds);
    return next ? instantQuestionToWhatsApp(next) : null;
  }
  for (const q of flow.questions) {
    if (!askedIds.has(q.id)) return q;
  }
  return null;
}

export function countFlowQuestions(flow: QualificationFlow, answers: Record<string, string>): number {
  if (flow.instantQuestions) {
    return getVisibleQuestions(flow.instantQuestions, answers).length;
  }
  return flow.questions.length;
}
