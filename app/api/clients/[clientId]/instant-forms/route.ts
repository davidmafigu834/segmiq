import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugifyFormName, defaultInstantFormQuestions } from "@/lib/instant-form-helpers";
import { getSegmiqClientAcquisitionTemplate } from "@/lib/instant-form-templates/segmiq-client-acquisition";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  template: z.enum(["segmiq_client_acquisition"]).optional(),
  publish: z.boolean().optional(),
  linkWhatsApp: z.boolean().optional(),
});

async function uniqueSlug(supabase: ReturnType<typeof createAdminClient>, base: string): Promise<string> {
  const slug = slugifyFormName(base);
  let attempt = 0;
  while (attempt < 20) {
    const candidate = attempt === 0 ? slug : `${slug}-${attempt + 1}`;
    const { data } = await supabase.from("instant_forms").select("id").eq("slug", candidate).maybeSingle();
    if (!data) return candidate;
    attempt++;
  }
  return `${slug}-${Date.now()}`;
}

export async function GET(_req: Request, { params }: { params: { clientId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.role !== "AGENCY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("instant_forms")
    .select("id, name, slug, status, form_type, submission_count, created_at, updated_at")
    .eq("client_id", params.clientId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ forms: data ?? [] });
}

export async function POST(req: Request, { params }: { params: { clientId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.role !== "AGENCY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const template =
    parsed.data.template === "segmiq_client_acquisition"
      ? getSegmiqClientAcquisitionTemplate()
      : null;
  const name = parsed.data.name ?? template?.name ?? "Untitled form";
  const supabase = createAdminClient();
  const slug = await uniqueSlug(supabase, name);
  const publish = parsed.data.publish === true;

  const { data, error } = await supabase
    .from("instant_forms")
    .insert({
      client_id: params.clientId,
      name,
      slug,
      status: publish ? "published" : "draft",
      form_type: template ? "higher_intent" : "more_volume",
      intro: template?.intro ?? {
        headline: name,
        body: "Fill in your details and we'll be in touch shortly.",
        layout: "paragraph",
        button_text: "Get started",
      },
      questions: template?.questions ?? defaultInstantFormQuestions(),
      consents: [
        {
          id: randomUUID(),
          label: "I agree to be contacted about my enquiry.",
          is_required: true,
        },
      ],
      privacy: {
        link_text: "Privacy Policy",
        disclaimer: "By submitting this form, you agree to our",
      },
      completion: template?.completion ?? {
        headline: "Thank you!",
        body: "We've received your information. Our team will be in touch soon.",
        cta_type: "none",
      },
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (parsed.data.linkWhatsApp && data?.id) {
    await supabase
      .from("clients")
      .update({
        whatsapp_qualification_enabled: true,
        whatsapp_instant_form_id: data.id as string,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.clientId);
  }

  return NextResponse.json({ form: data });
}
