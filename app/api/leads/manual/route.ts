import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAgencyAdmin } from "@/lib/auth/permissions";
import { createLead } from "@/lib/leads/createLead";
import { normalizeToE164 } from "@/lib/phone-validate";
import { processLeadIntelligence } from "@/lib/lead-intelligence";

const manualLeadSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().min(1).max(200),
  phone: z.string().min(3).max(40),
  email: z.string().max(200).optional(),
  budget: z.string().max(200).optional(),
  projectType: z.string().max(200).optional(),
  timeline: z.string().max(200).optional(),
  notes: z.string().max(5000).optional(),
  assignMode: z.enum(["round_robin", "specific"]),
  assigneeId: z.string().uuid().optional().nullable(),
  sendNotifications: z.boolean(),
});

export async function POST(req: Request) {
  const check = await requireAgencyAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const parsed = manualLeadSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const {
    clientId,
    name,
    phone,
    email,
    budget,
    projectType,
    timeline,
    notes,
    assignMode,
    assigneeId,
    sendNotifications,
  } = parsed.data;

  const normalizedPhone = normalizeToE164(phone.trim(), process.env.DEFAULT_COUNTRY_CODE || "US");
  if (!normalizedPhone) {
    return NextResponse.json({ error: "Invalid phone number format", field: "phone" }, { status: 400 });
  }

  if (assignMode === "specific" && (!assigneeId || assigneeId === "")) {
    return NextResponse.json({ error: "Salesperson required", field: "assigneeId" }, { status: 400 });
  }

  const emailTrim = email?.trim();
  if (emailTrim) {
    const em = z.string().email().safeParse(emailTrim);
    if (!em.success) {
      return NextResponse.json({ error: "Invalid email", field: "email" }, { status: 400 });
    }
  }

  const formData: Record<string, unknown> = {
    Name: name,
    Phone: normalizedPhone,
  };
  if (emailTrim) formData.Email = emailTrim;
  if (budget?.trim()) formData.Budget = budget.trim();
  if (projectType?.trim()) formData["Project type"] = projectType.trim();
  if (timeline?.trim()) formData.Timeline = timeline.trim();
  if (notes?.trim()) formData.Notes = notes.trim();

  const result = await createLead({
    clientId,
    source: "MANUAL",
    formData,
    overrideAssigneeId: assignMode === "specific" ? assigneeId! : undefined,
    skipNotifications: !sendNotifications,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // Fire and forget — do not await, do not block response
  processLeadIntelligence(result.leadId).catch((err) =>
    console.error("Lead intelligence processing failed:", err)
  );

  return NextResponse.json({ ok: true, leadId: result.leadId });
}
