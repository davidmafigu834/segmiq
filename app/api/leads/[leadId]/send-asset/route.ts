import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canModifyLead } from "@/lib/auth/permissions";
import { sendWhatsApp } from "@/lib/messaging/provider";
import { logDocumentSent } from "@/lib/lead-events";

type AssetType =
  | "PORTFOLIO"
  | "PROJECT"
  | "PRICING_PACKAGE"
  | "DOCUMENT"
  | "TESTIMONIALS"
  | "CUSTOM_MESSAGE";

export async function POST(req: Request, { params }: { params: { leadId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const check = await canModifyLead(params.leadId);
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
    .select("id, client_id, phone, name")
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
  const firstName = ((lead.name as string | null) ?? "there").split(" ")[0]!;

  // Fetch client name
  const { data: client } = await supabase
    .from("clients")
    .select("name")
    .eq("id", clientId)
    .single();
  const companyName = (client?.name as string | null) ?? "";

  // Fetch client profile for portfolio URL
  const { data: profile } = await supabase
    .from("client_profiles")
    .select("slug, is_published")
    .eq("client_id", clientId)
    .maybeSingle();
  const portfolioUrl =
    profile?.is_published && profile?.slug
      ? `${process.env.NEXT_PUBLIC_APP_DOMAIN ?? "https://leadstaq.tech"}/p/${profile.slug as string}`
      : null;

  const actor = {
    id: session.userId,
    name: session.user?.name ?? "Unknown",
    role: session.role ?? "UNKNOWN",
  };

  let documentName = "";
  let documentUrl = "";

  try {
    switch (assetType) {
      case "PORTFOLIO": {
        if (!portfolioUrl) {
          return NextResponse.json({ error: "Portfolio page is not published" }, { status: 400 });
        }
        await sendWhatsApp({
          to: leadPhone,
          template: "SEND_PORTFOLIO",
          variables: { "1": firstName, "2": companyName, "3": portfolioUrl },
          fallbackBody: `Hi ${firstName}, here are our completed projects from ${companyName}: ${portfolioUrl}`,
          context: { userId: session.userId, leadId: lead.id as string, clientId, notificationType: "DOCUMENT_SENT" },
        });
        documentName = "Portfolio";
        documentUrl = portfolioUrl;
        break;
      }

      case "PROJECT": {
        if (!assetId) return NextResponse.json({ error: "Project ID required" }, { status: 400 });
        const { data: project } = await supabase
          .from("projects")
          .select("id, title")
          .eq("id", assetId)
          .eq("client_id", clientId)
          .single();
        if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

        const projectUrl = `${process.env.NEXT_PUBLIC_APP_DOMAIN ?? "https://leadstaq.tech"}/cloud/share/${assetId}`;
        await sendWhatsApp({
          to: leadPhone,
          template: "SEND_PROJECT",
          variables: {
            "1": firstName,
            "2": companyName,
            "3": project.title as string,
            "4": projectUrl,
          },
          fallbackBody: `Hi ${firstName}, here is a project from ${companyName}: ${project.title as string} — ${projectUrl}`,
          context: { userId: session.userId, leadId: lead.id as string, clientId, notificationType: "DOCUMENT_SENT" },
        });
        documentName = project.title as string;
        documentUrl = projectUrl;
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
          ? `From ${currency} ${priceFrom.toLocaleString()}`
          : "Contact us for pricing";

        const includesArr = (pkg.includes as string[] | null) ?? [];
        const includesList = includesArr.slice(0, 5).map((item: string) => `• ${item}`).join("\n") ||
          "See details with our team";

        await sendWhatsApp({
          to: leadPhone,
          template: "SEND_PRICING_PACKAGE",
          variables: {
            "1": firstName,
            "2": companyName,
            "3": pkg.name as string,
            "4": priceDisplay,
            "5": includesList,
            "6": portfolioUrl ?? "",
          },
          fallbackBody: `Hi ${firstName}, here is pricing for ${pkg.name as string} from ${companyName}: ${priceDisplay}`,
          context: { userId: session.userId, leadId: lead.id as string, clientId, notificationType: "DOCUMENT_SENT" },
        });
        documentName = `Pricing: ${pkg.name as string}`;
        documentUrl = portfolioUrl ?? "";
        break;
      }

      case "TESTIMONIALS": {
        if (!portfolioUrl) {
          return NextResponse.json(
            { error: "Portfolio page required to share testimonials" },
            { status: 400 }
          );
        }
        const testimonialsUrl = `${portfolioUrl}#testimonials`;
        await sendWhatsApp({
          to: leadPhone,
          template: "SEND_TESTIMONIALS",
          variables: { "1": firstName, "2": companyName, "3": testimonialsUrl },
          fallbackBody: `Hi ${firstName}, here is what clients say about ${companyName}: ${testimonialsUrl}`,
          context: { userId: session.userId, leadId: lead.id as string, clientId, notificationType: "DOCUMENT_SENT" },
        });
        documentName = "Testimonials";
        documentUrl = testimonialsUrl;
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
            "1": firstName,
            "2": companyName,
            "3": doc.name as string,
            "4": doc.file_url as string,
          },
          fallbackBody: `Hi ${firstName}, ${companyName} shared a document: ${doc.name as string} — ${doc.file_url as string}`,
          context: { userId: session.userId, leadId: lead.id as string, clientId, notificationType: "DOCUMENT_SENT" },
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
          variables: { "1": firstName, "2": companyName, "3": msg },
          fallbackBody: `Hi ${firstName}, a message from ${companyName}: ${msg}`,
          context: { userId: session.userId, leadId: lead.id as string, clientId, notificationType: "DOCUMENT_SENT" },
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

  return NextResponse.json({ success: true, logged: true });
}
