import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCompanyBrainManager } from "@/lib/company-brain/access";
import { recordBrainAudit } from "@/lib/company-brain/audit";
import { computeBrainReadiness } from "@/lib/company-brain/readiness";
import { loadCompanyBrainSnapshot, upsertBrainSettings } from "@/lib/company-brain/store";
import { BUSINESS_KINDS, CUSTOMER_MODELS, EMOJI_POLICIES, RESPONSE_LENGTHS, VOICE_TONES } from "@/lib/company-brain/types";

function asEnum<T extends string>(values: readonly T[]) {
  return z.enum(values as unknown as [T, ...T[]]);
}

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const access = await requireCompanyBrainManager(req);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  try {
    const snapshot = await loadCompanyBrainSnapshot(access.clientId);
    const readiness = computeBrainReadiness(snapshot);
    return NextResponse.json({ snapshot, readiness });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const settingsSchema = z
  .object({
    tradingName: z.string().max(160).nullable(),
    businessKind: asEnum(BUSINESS_KINDS).nullable(),
    customerModel: asEnum(CUSTOMER_MODELS).nullable(),
    agentBusinessExplanation: z.string().max(4000).nullable(),
    languages: z.array(z.string().max(40)).max(8),
    primaryOffering: z.string().max(400).nullable(),
    catalogueCustomerType: z.string().max(400).nullable(),
    typicalOrderType: z.string().max(400).nullable(),
    weDoNotNormallySell: z.string().max(800).nullable(),
    specialSellingConditions: z.string().max(800).nullable(),
    pricingGuidance: z.string().max(2000).nullable(),
    neverEstimatePrices: z.boolean(),
    creditOffered: z.boolean(),
    paymentPlansOffered: z.boolean(),
    nonstandardTermsRequireApproval: z.boolean(),
    paymentGuidance: z.string().max(2000).nullable(),
    supportOffered: z.boolean(),
    supportHoursNote: z.string().max(400).nullable(),
    supportDestinationType: z.enum(["USER", "TEAM", "SUPPORT_QUEUE", "OWNER", "ADMIN"]).nullable(),
    supportDestinationId: z.string().uuid().nullable(),
    supportCategories: z.array(z.string().max(80)).max(20),
    supportIntakeFields: z
      .array(z.object({ key: z.string().max(60), label: z.string().max(120), required: z.boolean().optional() }))
      .max(20),
    autonomousTroubleshooting: z.boolean(),
    warrantyBoundaries: z.string().max(1000).nullable(),
    voicePrimary: asEnum(VOICE_TONES),
    voiceSecondary: asEnum(VOICE_TONES).nullable(),
    responseLength: asEnum(RESPONSE_LENGTHS),
    emojiPolicy: asEnum(EMOJI_POLICIES),
    greetingStyle: z.string().max(400).nullable(),
    preferredTerms: z.array(z.object({ prefer: z.string().max(40), avoid: z.string().max(40) })).max(20),
    claimsToAvoid: z.array(z.string().max(200)).max(20),
    quoteFollowUpBusinessDays: z.number().int().min(1).max(30),
    secondFollowUpBusinessDays: z.number().int().min(1).max(60),
    maxAutonomousFollowUps: z.number().int().min(0).max(10),
    defaultEscalationMessage: z.string().max(400).nullable(),
  })
  .partial();

export async function PATCH(req: Request) {
  const access = await requireCompanyBrainManager(req);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const parsed = settingsSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid settings" }, { status: 400 });
  }
  try {
    const settings = await upsertBrainSettings(access.clientId, parsed.data);
    await recordBrainAudit({
      clientId: access.clientId,
      actorId: access.userId,
      action: "SETTINGS_UPDATED",
      entityType: "company_brain_settings",
      entityId: access.clientId,
      summary: "Company Brain settings updated",
      payload: { keys: Object.keys(parsed.data) },
    });
    const snapshot = await loadCompanyBrainSnapshot(access.clientId);
    return NextResponse.json({ settings, readiness: computeBrainReadiness(snapshot) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
