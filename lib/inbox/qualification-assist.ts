import { extractQualificationDisplayFields } from "./qualification-display";
import { DEFAULT_WHATSAPP_QUALIFICATION_QUESTIONS } from "@/lib/whatsapp/qualification-questions";

export type QualificationAssistField = {
  key: string;
  label: string;
  filled: boolean;
  value: string | null;
  suggestedQuestion: string | null;
};

const SUGGESTED_QUESTIONS: Record<string, string> = {
  project_type: "What type of project or service are you looking for?",
  location: "Where is the project located?",
  timeline: "When are you hoping to start the project?",
  budget: "What budget range should we work to?",
  property_type: "What type of property is this for?",
};

function labelForKey(key: string): string {
  const known: Record<string, string> = {
    project_type: "Project / service",
    location: "Location",
    timeline: "Timeline",
    budget: "Budget",
    property_type: "Property type",
  };
  if (known[key]) return known[key];
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function buildQualificationAssist(input: {
  formData?: Record<string, unknown> | null;
  projectType?: string | null;
  location?: string | null;
  budget?: string | null;
  timeline?: string | null;
}): QualificationAssistField[] {
  const displayed = extractQualificationDisplayFields(input.formData);
  const byLabel = new Map(displayed.map((row) => [row.label.toLowerCase(), row.value]));

  const filledValue = (key: string, fallback?: string | null): string | null => {
    if (fallback?.trim()) return fallback.trim();
    const fromForm = input.formData?.[key];
    if (typeof fromForm === "string" && fromForm.trim()) return fromForm.trim();
    const byFriendly = byLabel.get(labelForKey(key).toLowerCase());
    return byFriendly ?? null;
  };

  const keys = new Set<string>([
    "project_type",
    "location",
    "budget",
    "timeline",
    ...DEFAULT_WHATSAPP_QUALIFICATION_QUESTIONS.map((q) => q.maps_to).filter(
      (key) => key !== "notes" && key !== "other"
    ),
  ]);

  const fields: QualificationAssistField[] = [];
  for (const key of keys) {
    const value = filledValue(
      key,
      key === "project_type"
        ? input.projectType
        : key === "location"
          ? input.location
          : key === "budget"
            ? input.budget
            : key === "timeline"
              ? input.timeline
              : null
    );
    fields.push({
      key,
      label: labelForKey(key),
      filled: Boolean(value),
      value,
      suggestedQuestion: value ? null : SUGGESTED_QUESTIONS[key] ?? `Could you share the ${labelForKey(key).toLowerCase()}?`,
    });
  }

  for (const row of displayed) {
    if (fields.some((field) => field.label.toLowerCase() === row.label.toLowerCase())) continue;
    fields.push({
      key: row.label,
      label: row.label,
      filled: true,
      value: row.value,
      suggestedQuestion: null,
    });
  }

  return fields;
}

export function qualificationProgress(fields: QualificationAssistField[]): {
  complete: number;
  total: number;
} {
  const tracked = fields.filter((field) =>
    ["project_type", "location", "budget", "timeline"].includes(field.key)
  );
  const source = tracked.length > 0 ? tracked : fields;
  return {
    complete: source.filter((field) => field.filled).length,
    total: Math.max(source.length, 1),
  };
}
