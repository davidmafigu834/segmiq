import type { InstantFormQuestion } from "@/types";

export function slugifyFormName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "form";
}

export function newQuestionId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `q_${Math.random().toString(36).slice(2)}`;
}

export function isQuestionVisible(
  question: InstantFormQuestion,
  answers: Record<string, string>
): boolean {
  const logic = question.conditional_logic;
  if (!logic?.question_id) return true;
  const depAnswer = answers[logic.question_id] ?? "";
  if (logic.operator === "equals") return depAnswer === logic.value;
  return depAnswer !== logic.value;
}

export function getVisibleQuestions(
  questions: InstantFormQuestion[],
  answers: Record<string, string>
): InstantFormQuestion[] {
  return [...questions]
    .sort((a, b) => a.sort_order - b.sort_order)
    .filter((q) => isQuestionVisible(q, answers));
}

export function answerKey(question: InstantFormQuestion): string {
  return question.maps_to ?? question.id;
}

export const CONTACT_FIELD_PRESETS: {
  field_type: InstantFormQuestion["field_type"];
  label: string;
  maps_to?: string;
  placeholder?: string;
}[] = [
  { field_type: "full_name", label: "Full name", maps_to: "name", placeholder: "John Smith" },
  { field_type: "email", label: "Email", maps_to: "email", placeholder: "you@example.com" },
  { field_type: "phone", label: "Phone number", maps_to: "phone", placeholder: "+1 555 000 0000" },
  { field_type: "street_address", label: "Street address", placeholder: "123 Main St" },
  { field_type: "city", label: "City", placeholder: "Your city" },
  { field_type: "state", label: "State / Province", placeholder: "Your state" },
  { field_type: "country", label: "Country", placeholder: "Your country" },
  { field_type: "zip", label: "Zip / Postal code", placeholder: "00000" },
  { field_type: "company", label: "Company name", placeholder: "Your company" },
  { field_type: "job_title", label: "Job title", placeholder: "Your role" },
];

export function defaultInstantFormQuestions(): InstantFormQuestion[] {
  return [
    {
      id: newQuestionId(),
      kind: "contact",
      field_type: "full_name",
      label: "Full name",
      placeholder: "John Smith",
      is_required: true,
      maps_to: "name",
      sort_order: 0,
    },
    {
      id: newQuestionId(),
      kind: "contact",
      field_type: "email",
      label: "Email",
      placeholder: "you@example.com",
      is_required: true,
      maps_to: "email",
      sort_order: 1,
    },
    {
      id: newQuestionId(),
      kind: "contact",
      field_type: "phone",
      label: "Phone number",
      placeholder: "+1 555 000 0000",
      is_required: true,
      maps_to: "phone",
      sort_order: 2,
    },
  ];
}
