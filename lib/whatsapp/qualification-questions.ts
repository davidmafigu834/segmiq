export type WhatsAppQualMapsTo =
  | "project_type"
  | "location"
  | "timeline"
  | "budget"
  | "notes"
  | "other";

export type WhatsAppQualQuestion = {
  id: string;
  label: string;
  maps_to: WhatsAppQualMapsTo | string;
  field_type?: "short_text" | "long_text" | "dropdown" | "radio";
  options?: string[];
};

const CONTACT_MAPS = new Set(["name", "phone", "email"]);

/** Default flow — qualifying only (no contact fields). */
export const DEFAULT_WHATSAPP_QUALIFICATION_QUESTIONS: WhatsAppQualQuestion[] = [
  {
    id: "project_type",
    label: "What type of project or service are you interested in?",
    maps_to: "project_type",
    field_type: "short_text",
  },
  {
    id: "location",
    label: "Where is the project located?",
    maps_to: "location",
    field_type: "short_text",
  },
  {
    id: "timeline",
    label: "When are you looking to get started?",
    maps_to: "timeline",
    field_type: "short_text",
  },
  {
    id: "budget",
    label: "What's your approximate budget?",
    maps_to: "budget",
    field_type: "short_text",
  },
];

export function filterContactQuestions(questions: WhatsAppQualQuestion[]): WhatsAppQualQuestion[] {
  return questions.filter((q) => !CONTACT_MAPS.has(String(q.maps_to).toLowerCase()));
}

export function normalizeClientQuestions(raw: unknown): WhatsAppQualQuestion[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const parsed: WhatsAppQualQuestion[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const label = typeof o.label === "string" ? o.label.trim() : "";
    const maps_to = typeof o.maps_to === "string" ? o.maps_to.trim() : "other";
    if (!label) continue;
    parsed.push({
      id: typeof o.id === "string" && o.id.trim() ? o.id.trim() : maps_to,
      label,
      maps_to,
      field_type: (o.field_type as WhatsAppQualQuestion["field_type"]) ?? "short_text",
      options: Array.isArray(o.options) ? o.options.map(String) : undefined,
    });
  }
  const filtered = filterContactQuestions(parsed);
  return filtered.length > 0 ? filtered : null;
}

export function formatQuestionMessage(question: WhatsAppQualQuestion, index: number, total: number): string {
  const prefix = total > 1 ? `(${index + 1}/${total}) ` : "";
  let text = `${prefix}${question.label}`;
  if (question.options?.length) {
    text += `\n\n${question.options.map((o, i) => `${i + 1}. ${o}`).join("\n")}`;
    text += "\n\nReply with your choice or type your answer.";
  }
  return text;
}

export const WHATSAPP_QUAL_INTRO =
  "Thanks for reaching out! We already have your contact details from WhatsApp. A few quick questions help us qualify your enquiry and get you to the right person faster.";

export const WHATSAPP_QUAL_COMPLETE =
  "Thank you — we've captured your details. A member of our team will follow up with you shortly.";
