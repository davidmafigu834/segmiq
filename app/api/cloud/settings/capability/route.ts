import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageCloudSettings } from "@/lib/auth/permissions";
import {
  CLIENT_CAPABILITY_COLUMNS,
  isMissingCapabilityColumnError,
  parseClientCapabilityProfile,
  type ClientCapabilityProfile,
} from "@/lib/cloud/client-capability";

export const dynamic = "force-dynamic";

const certificationSchema = z.object({
  name: z.string(),
  issuing_body: z.string(),
  issued_year: z.string(),
  certificate_url: z.string(),
});

const teamMemberSchema = z.object({
  name: z.string(),
  role: z.string(),
  bio: z.string(),
  photo_url: z.string(),
});

const capabilityStatSchema = z.object({
  label: z.string(),
  value: z.string(),
  stated_as_of: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const patchSchema = z.object({
  capability_tagline: z.string().max(500).nullable().optional(),
  years_in_operation: z.number().int().min(1).max(300).nullable().optional(),
  industries_served: z.array(z.string().min(1).max(80)).max(30).optional(),
  certifications: z.array(certificationSchema).max(30).optional(),
  team_members: z.array(teamMemberSchema).max(30).optional(),
  capability_stats: z.array(capabilityStatSchema).max(30).optional(),
});

const SELECT_COLS = CLIENT_CAPABILITY_COLUMNS.join(", ");

function emptyProfile(): ClientCapabilityProfile {
  return {
    capability_tagline: null,
    years_in_operation: null,
    industries_served: [],
    certifications: [],
    team_members: [],
    capability_stats: [],
  };
}

function sanitizePatch(body: z.infer<typeof patchSchema>) {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if ("capability_tagline" in body) {
    const tagline = body.capability_tagline?.trim() ?? "";
    update.capability_tagline = tagline || null;
  }
  if ("years_in_operation" in body) {
    update.years_in_operation = body.years_in_operation ?? null;
  }
  if (body.industries_served) {
    update.industries_served = body.industries_served.map((s) => s.trim()).filter(Boolean);
  }
  if (body.certifications) {
    update.certifications = body.certifications
      .map((c) => ({
        name: c.name.trim(),
        issuing_body: c.issuing_body.trim(),
        issued_year: c.issued_year.trim(),
        certificate_url: c.certificate_url.trim(),
      }))
      .filter((c) => c.name || c.issuing_body || c.issued_year || c.certificate_url);
  }
  if (body.team_members) {
    update.team_members = body.team_members
      .map((m) => ({
        name: m.name.trim(),
        role: m.role.trim(),
        bio: m.bio.trim(),
        photo_url: m.photo_url.trim(),
      }))
      .filter((m) => m.name || m.role || m.bio || m.photo_url);
  }
  if (body.capability_stats) {
    update.capability_stats = body.capability_stats
      .map((s) => ({
        label: s.label.trim(),
        value: s.value.trim(),
        stated_as_of: s.stated_as_of.trim(),
      }))
      .filter((s) => s.label && s.value && s.stated_as_of);
  }

  return update;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.clientId) return NextResponse.json({ error: "No client associated" }, { status: 400 });
  if (!canManageCloudSettings(session, session.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("clients")
    .select(SELECT_COLS)
    .eq("id", session.clientId)
    .single();

  if (error) {
    if (isMissingCapabilityColumnError(error.message)) {
      return NextResponse.json(emptyProfile());
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) return NextResponse.json(emptyProfile());

  return NextResponse.json(
    parseClientCapabilityProfile(data as unknown as Record<string, unknown>)
  );
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.clientId) return NextResponse.json({ error: "No client associated" }, { status: 400 });
  if (!canManageCloudSettings(session, session.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const update = sanitizePatch(parsed.data);
  if (Object.keys(update).length === 1) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("clients")
    .update(update)
    .eq("id", session.clientId)
    .select(SELECT_COLS)
    .single();

  if (error) {
    if (isMissingCapabilityColumnError(error.message)) {
      return NextResponse.json(
        {
          error:
            "Database migration 066_client_capability_profile.sql is required for company capability fields.",
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) return NextResponse.json(emptyProfile());

  return NextResponse.json(
    parseClientCapabilityProfile(data as unknown as Record<string, unknown>)
  );
}
