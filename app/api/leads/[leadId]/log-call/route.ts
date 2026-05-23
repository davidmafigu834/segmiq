import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canModifyLead } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyDealWon } from "@/lib/notifications";
import { getManagerPrefs } from "@/lib/notification-prefs";
import { background } from "@/lib/background";
import { logCallLogged } from "@/lib/lead-events";
import type { CallOutcome, LeadRow, LeadStatus } from "@/types";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

function buildLostCallNotes(notes: string | undefined, lostReason: string): string {
  const r = lostReason.trim();
  const n = (notes ?? "").trim();
  if (!n) return r;
  return `Reason: ${r}\n\n${n}`;
}

const logCallSchema = z
  .object({
    outcome: z.enum(["ANSWERED", "NO_ANSWER", "FOLLOW_UP", "WON", "LOST", "NOT_QUALIFIED"]),
    notes: z.string().optional(),
    followUpDate: z.union([z.string(), z.null()]).optional(),
    dealValue: z.number().nullable().optional(),
    lostReason: z.string().max(500).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.outcome === "FOLLOW_UP") {
      const raw = data.followUpDate;
      if (raw == null || (typeof raw === "string" && raw.trim() === "")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["followUpDate"],
          message: "Follow-up date is required when outcome is FOLLOW_UP",
        });
        return;
      }
      const followUp = new Date(typeof raw === "string" ? raw : String(raw));
      if (isNaN(followUp.getTime())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["followUpDate"],
          message: "Follow-up date must be a valid date",
        });
        return;
      }
      if (followUp.getTime() < Date.now() - 60_000) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["followUpDate"],
          message: "Follow-up date cannot be in the past",
        });
      }
    }
    if (data.outcome === "LOST") {
      const raw = data.lostReason;
      if (raw == null || (typeof raw === "string" && raw.trim() === "")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["lostReason"],
          message: "Please provide a reason the deal was lost.",
        });
      }
    }
    if (data.outcome === "WON") {
      const v = data.dealValue;
      if (v == null || typeof v !== "number" || !Number.isFinite(v) || v <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["dealValue"],
          message: "Enter a positive deal value",
        });
      }
    }
  });

function statusFromOutcome(o: CallOutcome): LeadStatus | null {
  switch (o) {
    case "ANSWERED":
    case "NO_ANSWER":
    case "FOLLOW_UP":
      return "CONTACTED";
    case "WON":
      return "WON";
    case "LOST":
      return "LOST";
    case "NOT_QUALIFIED":
      return "NOT_QUALIFIED";
    default:
      return null;
  }
}

export async function POST(req: Request, { params }: { params: { leadId: string } }) {
  const leadId = params.leadId;
  const supabase = createAdminClient();

  let raw: Record<string, unknown>;
  try {
    raw = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const magicTokenRaw = raw.magicToken;
  const magicToken = typeof magicTokenRaw === "string" ? magicTokenRaw.trim() : "";
  const bodyForZod = { ...raw };
  delete bodyForZod.magicToken;
  const parsed = logCallSchema.safeParse(bodyForZod);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue.path[0];
    return NextResponse.json(
      {
        error: issue.message,
        ...(typeof path === "string" ? { field: path } : {}),
      },
      { status: 400 }
    );
  }

  const { outcome, notes, followUpDate, dealValue, lostReason } = parsed.data;

  let actorUserId: string;

  if (magicToken) {
    const { data: tokenLead } = await supabase
      .from("leads")
      .select("id, assigned_to_id, magic_token_expires_at")
      .eq("id", leadId)
      .eq("magic_token", magicToken)
      .maybeSingle();

    if (!tokenLead) {
      return NextResponse.json({ error: "Invalid magic token" }, { status: 403 });
    }
    const exp = tokenLead.magic_token_expires_at as string | null;
    if (exp && new Date(exp) < new Date()) {
      return NextResponse.json({ error: "Magic token expired" }, { status: 403 });
    }
    const assignee = tokenLead.assigned_to_id as string | null;
    if (!assignee) {
      return NextResponse.json({ error: "Lead has no assignee" }, { status: 403 });
    }
    actorUserId = assignee;
  } else {
    const gate = await canModifyLead(leadId);
    if (!gate.allowed) {
      return NextResponse.json({ error: gate.reason }, { status: gate.status });
    }
    const session = await getServerSession(authOptions);
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    actorUserId = session.userId;
  }

  const { data: lead } = await supabase.from("leads").select("*").eq("id", leadId).maybeSingle();
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let callLogNotes: string | null = notes?.trim() ? notes.trim() : null;
  if (outcome === "LOST") {
    callLogNotes = buildLostCallNotes(notes, lostReason as string);
  }

  await supabase.from("call_logs").insert({
    lead_id: leadId,
    user_id: actorUserId,
    outcome,
    notes: callLogNotes,
    follow_up_date: outcome === "FOLLOW_UP" ? (followUpDate as string) : null,
  });

  // Log CALL_LOGGED event (fire-and-forget)
  background("logCallLogged", async () => {
    const { data: actorForLog } = await supabase
      .from("users")
      .select("name, role")
      .eq("id", actorUserId)
      .maybeSingle();
    await logCallLogged({
      leadId,
      clientId: (lead as { client_id: string }).client_id,
      actor: {
        id: actorUserId,
        name: (actorForLog as { name: string } | null)?.name || "Unknown",
        role: (actorForLog as { role: string } | null)?.role || "SALESPERSON",
      },
      outcome,
      notes: callLogNotes,
      followUpDate: outcome === "FOLLOW_UP" ? (followUpDate as string | null) : null,
    });
  });

  const nextStatus = statusFromOutcome(outcome);
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (nextStatus) updates.status = nextStatus;
  if (outcome === "FOLLOW_UP") {
    updates.follow_up_date = followUpDate as string;
  }
  if (outcome === "LOST") {
    updates.lost_reason = (lostReason as string).trim();
    updates.follow_up_date = null;
  }
  if (outcome === "WON") {
    if (dealValue != null) updates.deal_value = dealValue;
  }

  const { data: updated } = await supabase.from("leads").update(updates).eq("id", leadId).select("*").single();

  if (outcome === "WON" && updated) {
    const { data: actorRow } = await supabase.from("users").select("id, name, email, phone").eq("id", actorUserId).maybeSingle();

    const { data: mgr } = await supabase
      .from("users")
      .select("id, name, email, phone")
      .eq("client_id", (updated as { client_id: string }).client_id)
      .eq("role", "CLIENT_MANAGER")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    const { data: clientRow } = await supabase
      .from("clients")
      .select("name, twilio_whatsapp_override, manager_notification_prefs")
      .eq("id", (updated as { client_id: string }).client_id)
      .maybeSingle();

    const spLite = {
      id: actorUserId,
      name: (actorRow?.name as string) || "Rep",
      phone: (actorRow?.phone as string | null) ?? null,
      email: (actorRow?.email as string | null) ?? null,
    };

    background("notifyDealWon", () =>
      notifyDealWon(
        updated as LeadRow,
        spLite,
        mgr
          ? {
              id: mgr.id as string,
              name: mgr.name as string,
              phone: (mgr.phone as string | null) ?? null,
              email: (mgr.email as string | null) ?? null,
            }
          : null,
        (clientRow?.twilio_whatsapp_override as string | null) ?? null,
        (clientRow?.name as string) ?? "Client",
        getManagerPrefs((clientRow as { manager_notification_prefs?: unknown } | null)?.manager_notification_prefs)
      )
    );
  }

  return NextResponse.json({ lead: updated });
}
