import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRoles } from "@/lib/api-guards";
import { CRM_PLANS, ONBOARDING_COUNTRIES } from "@/lib/onboarding/constants";
import { activateClientFromProgress } from "@/lib/onboarding/finish";

export const dynamic = "force-dynamic";

const countryCodes = ONBOARDING_COUNTRIES.map((c) => c.code) as [string, ...string[]];

const manualClientSchema = z.object({
  mode: z.enum(["team", "solo"]),
  plan: z.enum(CRM_PLANS),
  ownerEmail: z.string().email(),
  password: z.string().min(8).max(128),
  companyName: z.string().min(1).max(200),
  industry: z.string().min(1).max(120),
  country: z.enum(countryCodes as ["ZW", "ZM", "ZA", "KE"]),
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only"),
  website: z.string().max(500).optional(),
  ownerName: z.string().min(1).max(120),
  ownerPhone: z.string().max(40).optional(),
});

function placeholderSlug(): string {
  return `pending-${randomBytes(6).toString("hex")}`;
}

export async function POST(req: Request) {
  const g = await requireRoles(["AGENCY_ADMIN"]);
  if ("error" in g) return g.error;

  const parsed = manualClientSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const ownerEmail = data.ownerEmail.toLowerCase().trim();
  const slug = data.slug.trim().toLowerCase();
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
      mode: data.mode,
      plan: data.plan,
      owner_email: ownerEmail,
      setup_status: "pending",
      is_active: false,
    })
    .select("*")
    .single();

  if (error || !client) {
    console.error("[POST /api/clients/manual]", error);
    return NextResponse.json({ error: error?.message ?? "Failed to create client" }, { status: 500 });
  }

  const clientId = client.id as string;

  const result = await activateClientFromProgress({
    clientId,
    mode: data.mode,
    ownerEmail,
    password: data.password,
    progress: {
      company: {
        name: data.companyName.trim(),
        industry: data.industry.trim(),
        country: data.country,
        website: data.website?.trim() || undefined,
        slug,
      },
      account: {
        ownerName: data.ownerName.trim(),
        phone: data.ownerPhone?.trim() || undefined,
      },
      branding: { logoUrl: null },
      team: [],
    },
  });

  if (!result.ok) {
    await supabase.from("clients").delete().eq("id", clientId);
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { data: activeClient } = await supabase.from("clients").select("*").eq("id", clientId).single();

  return NextResponse.json({
    client: activeClient,
    ownerUserId: result.ownerUserId,
    ownerRole: result.ownerRole,
  });
}
