import { z } from "zod";
export const prospectSchema = z.object({
  organisationName: z.string().trim().min(2).max(200),
  legalName: z.string().trim().max(200).nullable().optional(),
  tradingName: z.string().trim().max(200).nullable().optional(),
  industry: z.string().trim().max(120).nullable().optional(),
  contactName: z.string().trim().min(2).max(160),
  contactPosition: z.string().trim().max(120).nullable().optional(),
  email: z.string().trim().email().max(254).nullable().optional(),
  phone: z.string().trim().max(80).nullable().optional(),
  address: z.string().trim().max(500).nullable().optional(),
  source: z.string().trim().max(120).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});
export const quoteInputSchema = z.object({
  prospectId: z.string().uuid(),
  crmSku: z.enum(["crm_starter", "crm_growth"]),
  seats: z.number().int().positive().max(10000),
  aiSku: z.enum(["agentic_business", "agentic_scale"]).nullable(),
  serviceSkus: z
    .array(
      z.enum([
        "onboarding_one_business",
        "onboarding_two_businesses",
        "onboarding_three_businesses",
        "ai_activation_standard",
      ]),
    )
    .max(4),
  discount: z
    .object({
      kind: z.enum(["fixed", "percent"]),
      value: z.number().int().nonnegative(),
      scope: z.enum(["recurring", "one_time"]),
      reason: z.string().trim().min(3).max(300),
    })
    .nullable(),
  taxRateBasisPoints: z.number().int().min(0).max(10000),
  validUntil: z.string().date(),
  notes: z.string().trim().max(2000).nullable().optional(),
});
export const recipientResponseSchema = z.object({
  action: z.enum(["accept", "decline", "request_changes"]),
  name: z.string().trim().max(160).optional(),
  title: z.string().trim().max(160).optional(),
  authorityConfirmed: z.boolean().default(false),
  correlationId: z.string().uuid(),
});
