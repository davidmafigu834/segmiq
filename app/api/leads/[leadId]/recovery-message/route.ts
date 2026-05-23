import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canReadLead } from "@/lib/auth/permissions";
import { callClaude } from "@/lib/ai/claude";

export async function POST(
  _req: Request,
  { params }: { params: { leadId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await canReadLead(params.leadId);
  if (!access.ok) {
    return NextResponse.json(
      { error: "Not found" },
      { status: access.status === 401 ? 401 : 404 }
    );
  }

  const supabase = createAdminClient();

  const { data: lead } = await supabase
    .from("leads")
    .select("id, name, client_id, form_data, status, source")
    .eq("id", params.leadId)
    .single();

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const { data: lastCall } = await supabase
    .from("call_logs")
    .select("outcome, notes, created_at")
    .eq("lead_id", params.leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: sentEvents } = await supabase
    .from("lead_events")
    .select("event_data")
    .eq("lead_id", params.leadId)
    .eq("event_type", "DOCUMENT_SENT");

  const assetsSent = (sentEvents ?? [])
    .map((e) => (e.event_data as Record<string, unknown>)?.document_type)
    .filter((x): x is string => typeof x === "string");

  let companyName = "our team";
  const { data: clientRow } = await supabase
    .from("clients")
    .select("name")
    .eq("id", lead.client_id as string)
    .maybeSingle();
  if (clientRow?.name) companyName = clientRow.name as string;

  const firstName = ((lead.name as string | null) ?? "").split(" ")[0] || "there";
  const formData = (lead.form_data as Record<string, unknown> | null) ?? {};
  const projectType =
    (formData.project_type as string | undefined) ??
    (formData.service_type as string | undefined) ??
    "your project";

  const context = `
Lead first name: ${firstName}
What they enquired about: ${projectType}
Company name: ${companyName}
Lead status: ${lead.status as string}
Last call: ${
    lastCall
      ? `${lastCall.outcome as string} — "${(lastCall.notes as string | null) ?? "no notes"}"`
      : "no calls made yet"
  }
Assets already sent: ${assetsSent.length > 0 ? assetsSent.join(", ") : "none"}
  `.trim();

  try {
    const message = await callClaude({
      system: `You write short, warm WhatsApp re-engagement messages for salespeople at service businesses.
The message should feel personal and genuine — not like a template.
Keep it under 100 words.
Plain text only. No formatting. No bullet points.
Do not start with "Hi" — vary the opening.
Reference something specific about what they enquired about.
End with an open question that is easy to answer.
Do not mention that you are following up — just pick up the conversation naturally.`,
      userMessage: `Write a re-engagement WhatsApp message for a stale lead.\n\n${context}`,
      maxTokens: 150,
    });

    return NextResponse.json({ message });
  } catch (err) {
    console.error("[recovery-message] Claude call failed:", err);
    return NextResponse.json({ error: "Failed to generate message" }, { status: 503 });
  }
}
