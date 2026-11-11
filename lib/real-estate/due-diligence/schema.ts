import { z } from "zod";
import {
  ACTING_CAPACITIES,
  DOCUMENT_TYPES,
  MARITAL_STATUSES,
  PROPERTY_TYPES,
  SELLER_KINDS,
  TENURE_TYPES,
} from "@/lib/real-estate/due-diligence/types";

const requiredText = (label: string, max: number) =>
  z.string().trim().min(2, `Enter the ${label}.`).max(max);

export const sellerSchema = z.object({
  fullName: requiredText("seller's full name", 160),
  idNumber: z
    .string()
    .trim()
    .min(5, "Enter the national ID number.")
    .max(30)
    .regex(/^[0-9A-Za-z\s-]+$/, "Use letters and numbers only for the ID number."),
  phone: z.string().trim().min(7, "Enter a phone number.").max(24),
  email: z.string().trim().email("Enter a valid email.").max(160).or(z.literal("")),
  maritalStatus: z.enum(MARITAL_STATUSES),
  sellerKind: z.enum(SELLER_KINDS),
  companyName: z.string().trim().max(180),
  actingCapacity: z.enum(ACTING_CAPACITIES),
  representativeName: z.string().trim().max(160),
}).superRefine((value, ctx) => {
  if (value.sellerKind === "company" && value.companyName.trim().length < 2) {
    ctx.addIssue({ code: "custom", path: ["companyName"], message: "Enter the company name." });
  }
  if (value.actingCapacity === "representative" && value.representativeName.trim().length < 2) {
    ctx.addIssue({ code: "custom", path: ["representativeName"], message: "Enter the representative's name." });
  }
});

export const propertySchema = z.object({
  address: requiredText("property address", 240),
  standNumber: requiredText("stand number", 60),
  suburb: requiredText("suburb", 80),
  city: requiredText("city", 80),
  propertyType: z.enum(PROPERTY_TYPES),
  tenureType: z.enum(TENURE_TYPES),
  askingPriceUsd: z.number().nonnegative().max(1_000_000_000).nullable(),
  localAuthority: z.string().trim().max(120),
});

export const mandateDraftSchema = z.object({
  seller: sellerSchema,
  property: propertySchema,
});

export type MandateDraft = z.infer<typeof mandateDraftSchema>;

export const documentTypeSchema = z.enum(DOCUMENT_TYPES);

export const reviewSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("note"),
    note: z.string().trim().min(2, "Write the note.").max(2000),
  }),
  z.object({
    action: z.literal("override"),
    checkCode: z.string().trim().min(2).max(80),
    status: z.enum(["pass", "warning", "fail"]),
    note: z.string().trim().min(8, "Explain the override in a sentence.").max(2000),
  }),
  z.object({
    action: z.literal("revert_override"),
    checkCode: z.string().trim().min(2).max(80),
  }),
  z.object({
    action: z.literal("clear"),
    note: z.string().trim().min(8, "Record why this file is cleared.").max(2000),
  }),
  z.object({
    action: z.literal("reject"),
    note: z.string().trim().min(8, "Record why this file is rejected.").max(2000),
  }),
]);

export type ReviewCommand = z.infer<typeof reviewSchema>;

export const ACCEPTED_DOCUMENT_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
export const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;
