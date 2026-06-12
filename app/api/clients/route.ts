import { NextResponse } from "next/server";

import { z } from "zod";

import { randomBytes } from "crypto";

import { createAdminClient } from "@/lib/supabase/admin";

import { requireRoles } from "@/lib/api-guards";

import { CRM_PLANS } from "@/lib/onboarding/constants";

import { createOnboardingToken, onboardingLink } from "@/lib/onboarding/tokens";

import { sendEmail } from "@/lib/email/resend";

import { onboardingLinkEmail } from "@/lib/email/templates/onboarding-link";

import { ONBOARDING_TOKEN_TTL_DAYS } from "@/lib/onboarding/constants";



export const dynamic = "force-dynamic";



export async function GET() {

  const g = await requireRoles(["AGENCY_ADMIN", "CLIENT_MANAGER", "SALESPERSON"]);

  if ("error" in g) return g.error;

  const supabase = createAdminClient();

  if (g.session.role !== "AGENCY_ADMIN") {

    if (!g.session.clientId) return NextResponse.json([], { status: 200 });

    const { data } = await supabase

      .from("clients")

      .select("id, name, slug")

      .eq("id", g.session.clientId)

      .eq("is_active", true)

      .maybeSingle();

    return NextResponse.json(data ? [data] : []);

  }

  const { data, error } = await supabase

    .from("clients")

    .select("id, name, slug, setup_status")

    .eq("is_active", true)

    .or("is_archived.is.null,is_archived.eq.false")

    .order("name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);

}



const createSchema = z.object({

  mode: z.enum(["team", "solo"]),

  plan: z.enum(CRM_PLANS),

  ownerEmail: z.string().email(),

});



function placeholderSlug(): string {

  return `pending-${randomBytes(6).toString("hex")}`;

}



export async function POST(req: Request) {

  const g = await requireRoles(["AGENCY_ADMIN"]);

  if ("error" in g) return g.error;



  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));

  if (!parsed.success) {

    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });

  }



  const ownerEmail = parsed.data.ownerEmail.toLowerCase().trim();

  const supabase = createAdminClient();



  const { data: emailDupe } = await supabase.from("users").select("id").eq("email", ownerEmail).maybeSingle();

  if (emailDupe) {

    return NextResponse.json({ error: "Owner email is already registered" }, { status: 400 });

  }



  const { data: client, error } = await supabase

    .from("clients")

    .insert({

      name: "Pending setup",

      industry: "Pending",

      slug: placeholderSlug(),

      mode: parsed.data.mode,

      plan: parsed.data.plan,

      owner_email: ownerEmail,

      setup_status: "pending",

      is_active: false,

    })

    .select("*")

    .single();



  if (error || !client) {

    console.error("[POST /api/clients]", error);

    return NextResponse.json({ error: error?.message ?? "Failed to create client" }, { status: 500 });

  }



  let onboardingToken: string;

  try {

    const created = await createOnboardingToken(client.id as string);

    onboardingToken = created.token;

  } catch (tokenErr) {

    await supabase.from("clients").delete().eq("id", client.id as string);

    console.error("[POST /api/clients] token create", tokenErr);

    return NextResponse.json({ error: "Failed to create onboarding link" }, { status: 500 });

  }



  const link = onboardingLink(onboardingToken);

  const { subject, html } = onboardingLinkEmail({

    link,

    expiresInDays: ONBOARDING_TOKEN_TTL_DAYS,

  });

  const emailResult = await sendEmail({ to: ownerEmail, subject, html });

  if (!emailResult.success) {

    console.error("[POST /api/clients] onboarding email failed:", emailResult.error);

  }



  return NextResponse.json({

    client,

    onboardingLink: link,

    emailSent: emailResult.success,

  });

}


