import { answerKey, getVisibleQuestions } from "@/lib/instant-form-helpers";
import type { InstantFormQuestion } from "@/types";
import type { WhatsAppQualQuestion } from "@/lib/whatsapp/qualification-questions";

const CONTACT_MAPS = new Set(["name", "email", "phone"]);
const CONTACT_FIELD_TYPES = new Set(["full_name", "email", "phone"]);

export function isInstantContactQuestion(question: InstantFormQuestion): boolean {
  const mapsTo = question.maps_to?.toLowerCase();
  if (mapsTo && CONTACT_MAPS.has(mapsTo)) return true;
  if (CONTACT_FIELD_TYPES.has(question.field_type)) return true;
  return false;
}

export function instantQuestionToWhatsApp(question: InstantFormQuestion): WhatsAppQualQuestion {
  return {
    id: question.id,
    label: question.label,
    maps_to: question.maps_to ?? answerKey(question),
    field_type: question.field_type === "multiple_choice" ? "dropdown" : "short_text",
    options: question.options,
  };
}

export function qualifyingInstantQuestions(questions: InstantFormQuestion[]): InstantFormQuestion[] {
  return [...questions]
    .sort((a, b) => a.sort_order - b.sort_order)
    .filter((q) => !isInstantContactQuestion(q));
}

export function getNextInstantQuestion(
  allQuestions: InstantFormQuestion[],
  answers: Record<string, string>,
  askedIds: Set<string>
): InstantFormQuestion | null {
  const visible = getVisibleQuestions(allQuestions, answers);
  return visible.find((q) => !askedIds.has(q.id)) ?? null;
}
