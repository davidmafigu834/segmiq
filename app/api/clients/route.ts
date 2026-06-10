import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRoles } from "@/lib/api-guards";
import { getDefaultResponseHoursForNewClients } from "@/lib/agency-settings";
import { seedPredefinedSegments } from "@/lib/audience-segments";
import { hashPassword } from "@/lib/password";
import { normalizeToE164 } from "@/lib/phone-validate";
import { sendEmail } from "@/lib/email/resend";
import { inviteSalespersonEmail } from "@/lib/email/templates/invite-salesperson";

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
    .select("id, name, slug")
    .eq("is_active", true)
    .or("is_archived.is.null,is_archived.eq.false")
    .order("name", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

const createSchema = z
  .object({
    name: z.string().min(1).max(200),
    industry: z.string().min(1).max(120),
    slug: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/),
    mode: z.enum(["team", "solo"]).optional().default("team"),
    owner: z
      .object({
        name: z.string().min(1).max(120),
        email: z.string().email(),
        phone: z.string().min(1).max(32),
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === "solo" && !data.owner) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Owner details required for solo clients", path: ["owner"] });
    }
    if (data.mode === "team" && data.owner) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Owner must not be set for team clients", path: ["owner"] });
    }
  });

export async function POST(req: Request) {
  const g = await requireRoles(["AGENCY_ADMIN"]);
  if ("error" in g) return g.error;

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: taken } = await supabase.from("clients").select("id").eq("slug", parsed.data.slug).maybeSingle();
  if (taken) {
    return NextResponse.json({ error: "Slug already in use" }, { status: 400 });
  }

  const defaultHours = await getDefaultResponseHoursForNewClients();
  const mode = parsed.data.mode ?? "team";

  const { data: client, error } = await supabase
    .from("clients")
    .insert({
      name: parsed.data.name.trim(),
      industry: parsed.data.industry.trim(),
      slug: parsed.data.slug.trim(),
      response_time_limit_hours: defaultHours,
      mode,
    })
    .select("*")
    .single();

  if (error || !client) {
    console.error("[POST /api/clients]", error);
    return NextResponse.json({ error: error?.message ?? "Failed to create client" }, { status: 500 });
  }

  await supabase.from("form_schemas").insert({
    client_id: client.id as string,
    form_title: "Contact us",
    fields: [],
  });

  await supabase.from("client_profiles").insert({
    client_id: client.id as string,
    slug: parsed.data.slug.trim(),
    is_published: false,
  });

  // Fire-and-forget: seed predefined audience segments for the new client
  seedPredefinedSegments(client.id as string).catch((err) =>
    console.error("[POST /api/clients] seedPredefinedSegments failed:", err)
  );

  let ownerUser: { id: string; email: string } | null = null;
  let temporaryPassword: string | null = null;
  let ownerEmailSent = false;

  if (mode === "solo" && parsed.data.owner) {
    const owner = parsed.data.owner;
    const email = owner.email.toLowerCase().trim();
    const phoneNorm = normalizeToE164(owner.phone.trim());
    if (!phoneNorm) {
      return NextResponse.json(
        { error: "Owner phone is required. Use international format like +263 77 123 4567." },
        { status: 400 }
      );
    }

    const { data: dupe } = await supabase.from("users").select("id").eq("email", email).maybeSingle();
    if (dupe) {
      return NextResponse.json({ error: "Owner email already registered" }, { status: 400 });
    }

    temporaryPassword = randomBytes(12).toString("base64url").slice(0, 16);
    const hash = await hashPassword(temporaryPassword);

    const { data: user, error: userErr } = await supabase
      .from("users")
      .insert({
        name: owner.name.trim(),
        email,
        phone: phoneNorm,
        password: hash,
        role: "SALESPERSON",
        client_id: client.id as string,
        is_active: true,
        round_robin_order: 0,
      })
      .select("id, email")
      .single();

    if (userErr || !user) {
      console.error("[POST /api/clients] solo owner insert", userErr);
      return NextResponse.json({ error: userErr?.message ?? "Failed to create owner account" }, { status: 500 });
    }

    ownerUser = user as { id: string; email: string };
    const loginUrl = `${process.env.NEXTAUTH_URL}/login`;
    const { subject, html } = inviteSalespersonEmail({
      inviteeName: owner.name.trim(),
      invitedByName: g.session.user?.name || "Segmiq",
      clientName: parsed.data.name.trim(),
      role: "SALESPERSON",
      email,
      temporaryPassword,
      loginUrl,
    });
    const emailResult = await sendEmail({ to: email, subject, html });
    ownerEmailSent = emailResult.success;
    if (!emailResult.success) {
      console.error("[POST /api/clients] solo owner invite email failed:", emailResult.error);
    }
  }

  return NextResponse.json({
    client,
    owner: ownerUser,
    temporaryPassword,
    ownerEmailSent,
  });
}
