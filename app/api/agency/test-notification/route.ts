import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRoles } from "@/lib/api-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsApp } from "@/lib/messaging/provider";
import { sendEmailWithLog } from "@/lib/messaging/email";

export const dynamic = "force-dynamic";

const postBodySchema = z
  .object({
    /** When set and non-empty, send the test email here instead of the admin's login email. */
    testEmail: z.string().max(320).optional(),
  })
  .strict();

export async function POST(req: Request) {
  const g = await requireRoles(["AGENCY_ADMIN"]);
  if ("error" in g) return g.error;

  const raw = await req.json().catch(() => ({}));
  const parsed = postBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: user } = await supabase.from("users").select("phone, email, name").eq("id", g.session.userId).single();

  const results: {
    ok: boolean;
    provider: "meta-cloud-api";
    whatsapp: "ok" | "skipped" | "error";
    email: "ok" | "skipped" | "error";
    /** When email was sent, the address it was delivered to (override or account). */
    emailTo?: string | null;
    detail?: string;
  } = {
    ok: true,
    provider: "meta-cloud-api",
    whatsapp: "skipped",
    email: "skipped",
  };

  const phone = (user?.phone as string | null)?.trim();
  if (phone) {
    const wa = await sendWhatsApp({
      to: phone,
      template: "NEW_LEAD_MANAGER",
      variables: {
        "1": (user?.name as string) || "You",
        "2": "Segmiq test",
      },
      fallbackBody: `Test message from Segmiq — notifications are working.`,
      context: {
        userId: g.session.userId,
        leadId: null,
        clientId: null,
        notificationType: "TEST",
      },
    });
    if (wa.ok) results.whatsapp = "ok";
    else {
      results.whatsapp = "error";
      results.detail = wa.error;
    }
  }

  const overrideRaw = parsed.data.testEmail?.trim() ?? "";
  let emailTo: string | null = null;
  if (overrideRaw) {
    const emailCheck = z.string().email().safeParse(overrideRaw);
    if (!emailCheck.success) {
      return NextResponse.json({ error: "Invalid test email address" }, { status: 400 });
    }
    emailTo = emailCheck.data;
  } else {
    emailTo = (user?.email as string | null)?.trim() || null;
  }

  const sendFrom = process.env.RESEND_FROM_EMAIL;
  if (emailTo && sendFrom) {
    const mail = await sendEmailWithLog({
      mail: {
        to: emailTo,
        from: sendFrom,
        subject: "Segmiq test email",
        text: "Test email — your Resend integration is working.",
      },
      context: {
        userId: g.session.userId,
        leadId: null,
        clientId: null,
        notificationType: "TEST",
      },
    });
    if (mail.ok) {
      results.email = "ok";
      results.emailTo = emailTo;
    } else {
      results.email = "error";
      if (!results.detail) results.detail = mail.error;
    }
  }

  return NextResponse.json(results);
}
