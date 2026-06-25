import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canModifyLead } from "@/lib/auth/permissions";
import { sendWhatsApp } from "@/lib/messaging/provider";
import { logDocumentSent } from "@/lib/lead-events";
import { persistLeadScore } from "@/lib/lead-scoring";
import { firstName, regionFromDialCode } from "@/lib/messaging/whatsapp-vars";

type AssetType =
  | "PORTFOLIO"
  | "PROJECT"
  | "PRICING_PACKAGE"
  | "DOCUMENT"
  | "TESTIMONIALS"
  | "CUSTOM_MESSAGE";

export async function POST(req: Request, { params }: { params: { leadId: string } }) {
  const check = await canModifyLead(params.leadId, req);
  if (!check.allowed) {
    return NextResponse.json({ error: check.reason }, { status: check.status });
  }

  const supabase = createAdminClient();
  const body = (await req.json()) as {
    assetType: AssetType;
    assetId?: string;
    customMessage?: string;
  };
  const { assetType, assetId, customMessage } = body;

  // Fetch full lead (phone + name) — canModifyLead only returns client_id/assigned_to_id
  const { data: lead } = await supabase
    .from("leads")
    .select("id, client_id, phone, name, assigned_to_id")
    .eq("id", params.leadId)
    .single();

  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  if (!lead.phone) {
    return NextResponse.json(
      { error: "Lead has no phone number — cannot send WhatsApp" },
      { status: 400 }
    );
  }

  const clientId = lead.client_id as string;
  const leadPhone = lead.phone as string;
  const prospectFirst = firstName(lead.name as string | null);

  const { data: client } = await supabase
    .from("clients")
    .select("name, slug, dial_code")
    .eq("id", clientId)
    .single();
  const companyName = (client?.name as string | null) ?? "";
  const clientSlug = (client?.slug as string | null) ?? "";
  const region = regionFromDialCode(client?.dial_code as string | null);

  const { data: profile } = await supabase
    .from("client_profiles")
    .select("slug, is_published")
    .eq("client_id", clientId)
    .maybeSingle();
  const profileSlug =
    profile?.is_published && profile?.slug ? (profile.slug as string) : clientSlug;

  let repLabel = companyName;
  if (lead.assigned_to_id) {
    const { data: rep } = await supabase
      .from("users")
      .select("name")
      .eq("id", lead.assigned_to_id as string)
      .maybeSingle();
    const repName = (rep?.name as string | null)?.trim();
    if (repName) repLabel = `${firstName(repName)} at ${companyName}`;
  }

  const actor = {
    id: check.userId,
    name: "Unknown",
    role: check.role,
  };

  let documentName = "";
  let documentUrl = "";

  try {
    switch (assetType) {
      case "PORTFOLIO": {
        if (!profileSlug) {
          return NextResponse.json({ error: "Portfolio page is not published" }, { status: 400 });
        }
        await sendWhatsApp({
          to: leadPhone,
          template: "SEND_PORTFOLIO",
          variables: { "1": prospectFirst, "2": companyName, "3": region },
          urlButtonParam: profileSlug,
          fallbackBody: `Hi ${prospectFirst}, here's a look at work ${companyName} has completed across ${region}.`,
          context: { userId: check.userId, leadId: lead.id as string, clientId, notificationType: "DOCUMENT_SENT" },
        });
        documentName = "Portfolio";
        documentUrl = profileSlug;
        break;
      }

      case "PROJECT": {
        if (!assetId) return NextResponse.json({ error: "Project ID required" }, { status: 400 });
        const { data: project } = await supabase
          .from("projects")
          .select("id, title, slug, location, description")
          .eq("id", assetId)
          .eq("client_id", clientId)
          .single();
        if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

        const projectSlug = (project.slug as string | null) || (project.title as string).toLowerCase().replace(/\s+/g, "-");
        const projectPath = profileSlug ? `${profileSlug}/projects/${projectSlug}` : projectSlug;
        const projectDesc =
          (project.description as string | null)?.trim() ||
          (project.title as string);
        const projectLocation = (project.location as string | null)?.trim() || region;

        await sendWhatsApp({
          to: leadPhone,
          template: "SEND_PROJECT",
          variables: {
            "1": prospectFirst,
            "2": projectDesc,
            "3": projectLocation,
          },
          urlButtonParam: projectPath,
          fallbackBody: `Hi ${prospectFirst}, here's a project from ${companyName}: ${project.title as string}`,
          context: { userId: check.userId, leadId: lead.id as string, clientId, notificationType: "DOCUMENT_SENT" },
        });
        documentName = project.title as string;
        documentUrl = projectPath;
        break;
      }

      case "PRICING_PACKAGE": {
        if (!assetId) return NextResponse.json({ error: "Package ID required" }, { status: 400 });
        const { data: pkg } = await supabase
          .from("pricing_packages")
          .select("*")
          .eq("id", assetId)
          .eq("client_id", clientId)
          .single();
        if (!pkg) return NextResponse.json({ error: "Package not found" }, { status: 404 });

        const currency = (pkg.currency as string | null) ?? "USD";
        const priceFrom = pkg.price_from as number | null;
        const priceTo = pkg.price_to as number | null;
        const priceLabel = pkg.price_label as string | null;
        const priceDisplay = priceLabel
          ? priceLabel
          : priceFrom && priceTo
          ? `${currency} ${priceFrom.toLocaleString()} – ${priceTo.toLocaleString()}`
          : priceFrom
          ? `starting from ${currency} ${priceFrom.toLocaleString()} fully installed`
          : "Contact us for pricing";

        const packageSlug = (pkg.slug as string | null) || "";
        const pricingPath =
          profileSlug && packageSlug ? `${profileSlug}/p/${packageSlug}` : packageSlug || profileSlug;

        await sendWhatsApp({
          to: leadPhone,
          template: "SEND_PRICING_PACKAGE",
          variables: {
            "1": prospectFirst,
            "2": pkg.name as string,
            "3": (pkg.price_note as string | null)?.trim() || priceDisplay,
          },
          urlButtonParam: pricingPath || undefined,
          fallbackBody: `Hi ${prospectFirst}, here are the details for our ${pkg.name as string} package — ${priceDisplay}.`,
          context: { userId: check.userId, leadId: lead.id as string, clientId, notificationType: "DOCUMENT_SENT" },
        });
        documentName = `Pricing: ${pkg.name as string}`;
        documentUrl = pricingPath;
        break;
      }

      case "TESTIMONIALS": {
        if (!profileSlug) {
          return NextResponse.json(
            { error: "Portfolio page required to share testimonials" },
            { status: 400 }
          );
        }
        await sendWhatsApp({
          to: leadPhone,
          template: "SEND_TESTIMONIALS",
          variables: { "1": prospectFirst, "2": companyName, "3": region },
          urlButtonParam: profileSlug,
          fallbackBody: `Hi ${prospectFirst}, here's what clients have said about working with ${companyName}.`,
          context: { userId: check.userId, leadId: lead.id as string, clientId, notificationType: "DOCUMENT_SENT" },
        });
        documentName = "Testimonials";
        documentUrl = profileSlug;
        break;
      }

      case "DOCUMENT": {
        if (!assetId) return NextResponse.json({ error: "Document ID required" }, { status: 400 });
        const { data: doc } = await supabase
          .from("client_documents")
          .select("*")
          .eq("id", assetId)
          .eq("client_id", clientId)
          .single();
        if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

        await sendWhatsApp({
          to: leadPhone,
          template: "SEND_DOCUMENT",
          variables: {
            "1": prospectFirst,
            "2": doc.name as string,
            "3": (doc.description as string | null)?.trim() || doc.name as string,
          },
          fallbackBody: `Hi ${prospectFirst}, please find the ${doc.name as string} attached above.`,
          context: { userId: check.userId, leadId: lead.id as string, clientId, notificationType: "DOCUMENT_SENT" },
        });
        documentName = doc.name as string;
        documentUrl = doc.file_url as string;
        break;
      }

      case "CUSTOM_MESSAGE": {
        const msg = customMessage?.trim() ?? "";
        if (!msg) return NextResponse.json({ error: "Custom message is required" }, { status: 400 });
        await sendWhatsApp({
          to: leadPhone,
          template: "SEND_CUSTOM_MESSAGE",
          variables: { "1": prospectFirst, "2": repLabel, "3": msg },
          fallbackBody: `Hi ${prospectFirst}, a quick note from ${repLabel}: ${msg}`,
          context: { userId: check.userId, leadId: lead.id as string, clientId, notificationType: "DOCUMENT_SENT" },
        });
        documentName = "Custom message";
        documentUrl = "";
        break;
      }

      default:
        return NextResponse.json({ error: "Unknown asset type" }, { status: 400 });
    }
  } catch (err) {
    console.error("[send-asset] WhatsApp error:", err);
    return NextResponse.json({ error: "Failed to send WhatsApp message" }, { status: 500 });
  }

  // Log the send event — never blocks response
  await logDocumentSent({
    leadId: lead.id as string,
    clientId,
    actor,
    documentType: assetType,
    documentName,
    url: documentUrl || null,
  });

  void persistLeadScore(lead.id as string);

  return NextResponse.json({ success: true, logged: true });
}
