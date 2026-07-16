import { newQuestionId } from "@/lib/instant-form-helpers";
import type { InstantFormCompletion, InstantFormIntro, InstantFormQuestion } from "@/types";

export const SEGMIQ_CLIENT_ACQUISITION_FORM_NAME = "Segmiq client acquisition";

export const SEGMIQ_CLIENT_ACQUISITION_INTRO: InstantFormIntro = {
  headline: "Thanks for reaching out about Segmiq!",
  body: "We already have your WhatsApp number. A few quick questions help us see if Segmiq is the right fit and get you to the right person faster.",
  button_text: "Get started",
};

export const SEGMIQ_CLIENT_ACQUISITION_COMPLETION: InstantFormCompletion = {
  headline: "Thank you — we've got your answers.",
  body: "A Segmiq team member will follow up on WhatsApp shortly. If you're a good fit, we'll book a short demo and show you how Facebook leads get captured, scored, and followed up automatically.",
};

export function buildSegmiqClientAcquisitionQuestions(): InstantFormQuestion[] {
  return [
    {
      id: newQuestionId(),
      kind: "custom",
      field_type: "multiple_choice",
      label: "What type of business do you run?",
      options: [
        "Construction / building",
        "Solar / energy",
        "Roofing",
        "Electrical",
        "Landscaping / outdoor",
        "Marketing agency (managing client leads)",
        "Other trade / service business",
        "Other (not trade/service)",
      ],
      is_required: true,
      maps_to: "project_type",
      sort_order: 0,
    },
    {
      id: newQuestionId(),
      kind: "custom",
      field_type: "multiple_choice",
      label: "Which country is your business mainly based in?",
      options: ["Zimbabwe", "Zambia", "South Africa", "Kenya", "Other"],
      is_required: true,
      maps_to: "location",
      sort_order: 1,
    },
    {
      id: newQuestionId(),
      kind: "custom",
      field_type: "multiple_choice",
      label: "How many people follow up on enquiries and quotes?",
      options: ["Just me (solo)", "2–5 people", "6–15 people", "16 or more"],
      is_required: true,
      maps_to: "team_size",
      sort_order: 2,
    },
    {
      id: newQuestionId(),
      kind: "custom",
      field_type: "multiple_choice",
      label: "Roughly how many new enquiries do you get per month?",
      options: ["Under 20", "20–50", "50–200", "200–500", "500+"],
      is_required: true,
      maps_to: "timeline",
      sort_order: 3,
    },
    {
      id: newQuestionId(),
      kind: "custom",
      field_type: "multiple_choice",
      label: "Where do most of your leads come from today?",
      options: [
        "Facebook / Instagram ads",
        "WhatsApp (direct messages)",
        "Referrals",
        "Website / Google",
        "Mix of the above",
        "We don't get leads yet",
      ],
      is_required: true,
      maps_to: "lead_source",
      sort_order: 4,
    },
    {
      id: newQuestionId(),
      kind: "custom",
      field_type: "multiple_choice",
      label: "What's the biggest problem you're trying to fix?",
      options: [
        "We're too slow to reply — leads go cold",
        "Salespeople leave and take our contacts",
        "No visibility on who's following up",
        "Quotes and documents are messy / slow",
        "Facebook leads don't answer or are low quality",
        "We don't have a proper pipeline yet",
        "Just exploring options",
      ],
      is_required: true,
      maps_to: "pain_point",
      sort_order: 5,
    },
    {
      id: newQuestionId(),
      kind: "custom",
      field_type: "multiple_choice",
      label: "Are you looking to get started soon, or just researching?",
      options: [
        "Ready to start — I want a demo this week",
        "Interested — need to see ROI first",
        "Just researching for now",
      ],
      is_required: true,
      maps_to: "readiness",
      sort_order: 6,
    },
  ];
}

export type SegmiqClientAcquisitionTemplate = {
  name: string;
  intro: InstantFormIntro;
  completion: InstantFormCompletion;
  questions: InstantFormQuestion[];
};

export function getSegmiqClientAcquisitionTemplate(): SegmiqClientAcquisitionTemplate {
  return {
    name: SEGMIQ_CLIENT_ACQUISITION_FORM_NAME,
    intro: SEGMIQ_CLIENT_ACQUISITION_INTRO,
    completion: SEGMIQ_CLIENT_ACQUISITION_COMPLETION,
    questions: buildSegmiqClientAcquisitionQuestions(),
  };
}

/** Deterministic 0–100 fit score from Segmiq inbound qualification answers. */
export function scoreSegmiqInboundQualification(formData: Record<string, unknown>): number {
  const business =
    String(formData.project_type ?? formData["What type of business do you run?"] ?? "").toLowerCase();
  const market = String(formData.location ?? formData["Which country is your business mainly based in?"] ?? "");
  const volume = String(formData.timeline ?? formData["Roughly how many new enquiries do you get per month?"] ?? "");
  const source = String(
    formData.lead_source ?? formData["Where do most of your leads come from today?"] ?? ""
  ).toLowerCase();
  const pain = String(
    formData.pain_point ?? formData["What's the biggest problem you're trying to fix?"] ?? ""
  ).toLowerCase();
  const readiness = String(
    formData.readiness ?? formData["Are you looking to get started soon, or just researching?"] ?? ""
  ).toLowerCase();

  let score = 0;

  if (business && !business.includes("not trade/service")) score += 20;
  else if (business) return Math.min(30, score + 10);

  if (["Zimbabwe", "Zambia", "South Africa", "Kenya"].includes(market)) score += 15;

  if (volume.includes("500") || volume.includes("200")) score += 20;
  else if (volume.includes("50")) score += 15;
  else if (volume.includes("20–50") || volume.includes("20-50")) score += 8;

  if (
    source.includes("facebook") ||
    source.includes("whatsapp") ||
    source.includes("mix")
  ) {
    score += 15;
  } else if (source.includes("don't get leads")) {
    score += 8;
  }

  if (pain.includes("just exploring")) score += 3;
  else if (pain) score += 15;

  if (readiness.includes("demo this week")) score += 15;
  else if (readiness.includes("roi")) score += 10;
  else if (readiness.includes("researching")) score += 5;

  return Math.min(100, score);
}
