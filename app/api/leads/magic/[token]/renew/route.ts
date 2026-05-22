import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import crypto from "crypto";
import { sendWhatsApp } from "@/lib/messaging/provider";
import { sendEmail } from "@/lib/email/resend";
import { magicLinkRenewalEmail } from "@/lib/email/templates/magic-link-renewal";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: { token: string } }
) {
  const supabase = createAdminClient();
  const { token } = params;

  const { data: lead } = await supabase
    .from("leads")
    .select(
      `id,
      magic_token,
      magic_token_expires_at,
      name,
      status,
      is_archived,
      assigned_to_id,
      client_id,
      users!leads_assigned_to_id_fkey (
        id, name, phone, email
      )`
    )
    .eq("magic_token", token)
    .maybeSingle();

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  if (lead.is_archived) {
    return NextResponse.json({ error: "This lead has been archived" }, { status: 400 });
  }

  const now = new Date();
  const expiresAt = lead.magic_token_expires_at
    ? new Date(lead.magic_token_expires_at as string)
    : null;

  const isExpired = !expiresAt || expiresAt < now;

  if (!isExpired) {
    // Rate limit: if token was just renewed (expires within 10 min of 7 days from now) reject
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const justRenewed = expiresAt.getTime() > sevenDaysFromNow.getTime() - 10 * 60 * 1000;

    if (justRenewed) {
      return NextResponse.json(
        { error: "A new link was just sent. Please check your WhatsApp and email." },
        { status: 429 }
      );
    }

    // Token is still valid — return the existing link without resending
    const siteUrl = (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
    const existingLink = `${siteUrl}/lead/${token}`;
    return NextResponse.json({
      success: true,
      renewed: false,
      message: "Token is still valid",
      magicLink: existingLink,
    });
  }

  // Generate new token — valid for 7 days
  const newToken = crypto.randomBytes(32).toString("hex");
  const newExpiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const { error: updateError } = await supabase
    .from("leads")
    .update({
      magic_token: newToken,
      magic_token_expires_at: newExpiresAt.toISOString(),
    })
    .eq("id", lead.id as string);

  if (updateError) {
    console.error("[renew] Failed to update magic token:", updateError);
    return NextResponse.json({ error: "Failed to generate new link" }, { status: 500 });
  }

  const salesperson = lead.users as unknown as { id: string; name: string; phone: string | null; email: string | null } | null;

  const siteUrl = (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const magicLink = `${siteUrl}/lead/${newToken}`;

  let whatsappSent = false;
  if (salesperson?.phone) {
    try {
      const result = await sendWhatsApp({
        to: salesperson.phone,
        template: "MAGIC_LINK_RENEWAL",
        variables: {
          "1": salesperson.name || "there",
          "2": (lead.name as string) || "Unknown",
          "3": magicLink,
        },
        fallbackBody: `Hi ${salesperson.name || "there"}, your Leadstaq link for ${lead.name || "your lead"} has been renewed. Open it here: ${magicLink}`,
        context: {
          userId: salesperson.id,
          leadId: lead.id as string,
          clientId: lead.client_id as string,
          notificationType: "MAGIC_LINK_RENEWAL",
        },
      });
      whatsappSent = result.ok;
    } catch (err) {
      console.error("[renew] WhatsApp send failed:", err);
    }
  }

  let emailSent = false;
  if (salesperson?.email) {
    try {
      const { subject, html } = magicLinkRenewalEmail({
        salespersonName: salesperson.name || "there",
        leadName: (lead.name as string) || "Unknown",
        magicLink,
        expiresAt: newExpiresAt,
      });
      const emailResult = await sendEmail({
        to: salesperson.email,
        subject,
        html,
      });
      emailSent = emailResult.success;
    } catch (err) {
      console.error("[renew] Email send failed:", err);
    }
  }

  return NextResponse.json({
    success: true,
    renewed: true,
    whatsappSent,
    emailSent,
    magicLink,
  });
}
