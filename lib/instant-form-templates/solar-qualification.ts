import { newQuestionId } from "@/lib/instant-form-helpers";
import type { InstantFormCompletion, InstantFormIntro, InstantFormQuestion } from "@/types";

export const SOLAR_QUALIFICATION_INTRO: InstantFormIntro = {
  headline: "Thanks for contacting us on WhatsApp",
  body: "We'll ask a few quick questions so we can qualify your enquiry and connect you with the right specialist.",
  button_text: "Get started",
};

export const SOLAR_QUALIFICATION_COMPLETION: InstantFormCompletion = {
  headline: "Thank you!",
  body: "We've captured your details. A team member will follow up shortly with next steps.",
};

export function buildSolarQualificationQuestions(): InstantFormQuestion[] {
  return [
    {
      id: newQuestionId(),
      kind: "custom",
      field_type: "multiple_choice",
      label: "What service do you need?",
      options: [
        "Residential solar installation",
        "Commercial solar installation",
        "Solar maintenance / repair",
        "Battery backup only",
        "Not sure yet",
      ],
      is_required: true,
      maps_to: "project_type",
      sort_order: 0,
    },
    {
      id: newQuestionId(),
      kind: "custom",
      field_type: "short_answer",
      label: "Where is the property located? (City or area)",
      placeholder: "e.g. Harare, Borrowdale",
      is_required: true,
      maps_to: "location",
      sort_order: 1,
    },
    {
      id: newQuestionId(),
      kind: "custom",
      field_type: "multiple_choice",
      label: "Is this for a residential or commercial property?",
      options: ["Residential", "Commercial", "Industrial", "Other"],
      is_required: true,
      maps_to: "property_type",
      sort_order: 2,
    },
    {
      id: newQuestionId(),
      kind: "custom",
      field_type: "multiple_choice",
      label: "When would you like the installation completed?",
      options: [
        "Within 30 days",
        "1–3 months",
        "3–6 months",
        "Just exploring / no rush",
      ],
      is_required: true,
      maps_to: "timeline",
      sort_order: 3,
    },
    {
      id: newQuestionId(),
      kind: "custom",
      field_type: "short_answer",
      label: "What is your approximate budget for this project?",
      placeholder: "e.g. $5,000 – $15,000",
      is_required: true,
      maps_to: "budget",
      sort_order: 4,
    },
  ];
}

export type SolarQualificationTemplate = {
  intro: InstantFormIntro;
  completion: InstantFormCompletion;
  questions: InstantFormQuestion[];
};

export function getSolarQualificationTemplate(): SolarQualificationTemplate {
  return {
    intro: SOLAR_QUALIFICATION_INTRO,
    completion: SOLAR_QUALIFICATION_COMPLETION,
    questions: buildSolarQualificationQuestions(),
  };
}
