import { DOCUMENT_TYPES } from "@/lib/real-estate/due-diligence/types";

export const EXTRACTION_SYSTEM_PROMPT = `You read documents for a Zimbabwe estate agent doing sale-mandate due diligence.
Return only the JSON object requested. Do not invent a name, ID number, stand number, deed number, date, or authority.
Use null when a field is not visible. An empty string is not allowed for missing fields.

Documents you may see:
- Zimbabwe National ID (metal or plastic). The number looks like 8 or 9 digits, one letter, then 2 digits, often printed with hyphens.
- A title deed or diagram deed from the Deeds Registry. Capture the holder, deed number, stand or lot, township or suburb, and the local description.
- A cession or agreement of sale with a local authority (City of Harare, Bulawayo, Mutare, Gweru, and others) or with a developer.
- A rates clearance or utility clearance from a local authority.
- A power of attorney, company resolution, subdivision permit, development permit, or certificate of compliance.
- A Surveyor General diagram.

Rules:
- Classify the document. If it is a brochure, photo of a house, or something you cannot place, use "unknown".
- Do not treat a marketing brochure as a title deed.
- Set quality to "suspicious" when the image looks altered, has mismatched type, a cut-off seal, or conflicting names on one page. Explain that in quality_notes and red_flags.
- Set quality to "poor" when the page is too dark, cropped, or blurred to trust every field. Still return the fields you can read.
- Set quality to "readable" when a careful reader could rely on the page.
- confidence is your confidence in the classification, from 0 to 1.
- other_names lists other holders printed on the document, not the main full_name.
- agreement_number is the cession, agreement of sale, or permit number. deed_number is only for a deed.
- expiry_date is the rates or permit expiry when printed. Use null if the page has no expiry.
- restrictions lists caveats, mortgage bonds, interdicts, endorsements, or other burdens you can actually read. Use an empty list when none are visible. Do not invent a bond.
- Dates must be ISO YYYY-MM-DD or null. Do not guess a year.`;

export function extractionUserText(declaredType: string, fileName: string): string {
  return `The agent filed "${fileName}" as ${declaredType}. Classify it yourself. Allowed document_type values: ${DOCUMENT_TYPES.join(", ")}, unknown.`;
}

export const EXTRACTION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["document_type", "confidence", "quality", "quality_notes", "red_flags", "fields"],
  properties: {
    document_type: {
      type: "string",
      enum: [...DOCUMENT_TYPES, "unknown"],
    },
    confidence: { type: "number" },
    quality: { type: "string", enum: ["readable", "poor", "suspicious"] },
    quality_notes: { type: "string" },
    red_flags: { type: "array", items: { type: "string" } },
    fields: {
      type: "object",
      additionalProperties: false,
      required: [
        "full_name",
        "other_names",
        "id_number",
        "date_of_birth",
        "property_description",
        "stand_number",
        "suburb",
        "city",
        "deed_number",
        "local_authority",
        "issue_date",
        "expiry_date",
        "developer_name",
        "permit_number",
        "agreement_number",
        "restrictions",
      ],
      properties: {
        full_name: { type: ["string", "null"] },
        other_names: { type: "array", items: { type: "string" } },
        id_number: { type: ["string", "null"] },
        date_of_birth: { type: ["string", "null"] },
        property_description: { type: ["string", "null"] },
        stand_number: { type: ["string", "null"] },
        suburb: { type: ["string", "null"] },
        city: { type: ["string", "null"] },
        deed_number: { type: ["string", "null"] },
        local_authority: { type: ["string", "null"] },
        issue_date: { type: ["string", "null"] },
        expiry_date: { type: ["string", "null"] },
        developer_name: { type: ["string", "null"] },
        permit_number: { type: ["string", "null"] },
        agreement_number: { type: ["string", "null"] },
        restrictions: { type: "array", items: { type: "string" } },
      },
    },
  },
} as const;
