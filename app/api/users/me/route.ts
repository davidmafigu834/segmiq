import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSession } from "@/lib/api-guards";
import { getManagerPrefs, parseSalesPrefs } from "@/lib/notification-prefs";
import { normalizeToE164 } from "@/lib/phone-validate";

export const dynamic = "force-dynamic";

const salespersonNotifSchema = z.object({
  whatsapp: z.boolean(),
  email: z.boolean(),
  followUpReminders: z.boolean(),
});

const managerChannelSchema = z.object({
  whatsapp: z.boolean(),
  email: z.boolean(),
});

const managerNotifSchema = z.object({
  newLead: managerChannelSchema,
  dealWon: managerChannelSchema,
  uncontactedLead: managerChannelSchema,
  weeklyDigest: z.object({ email: z.boolean() }),
});

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  phone: z.string().optional().nullable(),
  avatar_url: z.string().max(2000).optional().nullable(),
  notification_prefs: z.union([salespersonNotifSchema, managerNotifSchema]).optional(),
});

export async function GET() {
  const g = await requireSession();
  if ("error" in g) return g.error;

  const supabase = createAdminClient();
  const { data: user, error } = await supabase
    .from("users")
    .select("id, name, email, phone, avatar_url, notification_prefs, role, client_id")
    .eq("id", g.session.userId)
    .single();

  if (error || !user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const role = user.role as string;
  const prefs =
    role === "CLIENT_MANAGER"
      ? getManagerPrefs((user as { notification_prefs?: unknown }).notification_prefs)
      : parseSalesPrefs((user as { notification_prefs?: unknown }).notification_prefs);

  let clientName: string | null = null;
  const clientId: string | null = (user.client_id as string | null) ?? null;
  if (clientId) {
    const { data: c } = await supabase.from("clients").select("name").eq("id", clientId).maybeSingle();
    clientName = (c?.name as string) ?? null;
  }

  const { data: agencyAdmins } = await supabase
    .from("users")
    .select("name, email, phone")
    .eq("role", "SUPER_ADMIN")
    .eq("is_active", true)
    .limit(1);

  return NextResponse.json({
    user: {
      ...user,
      notification_prefs: prefs,
    },
    clientName,
    agencyContact: agencyAdmins?.[0] ?? null,
  });
}

export async function PATCH(req: Request) {
  const g = await requireSession();
  if ("error" in g) return g.error;

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const body = parsed.data;
  const update: Record<string, unknown> = {};

  if (body.name !== undefined) update.name = body.name.trim();
  if (body.phone !== undefined) {
    if (body.phone === null || body.phone === "") {
      update.phone = null;
    } else {
      const norm = normalizeToE164(body.phone.trim());
      if (!norm) {
        return NextResponse.json(
          { error: "Phone number looks invalid. Use international format like +263 77 123 4567." },
          { status: 400 }
        );
      }
      update.phone = norm;
    }
  }
  if (body.avatar_url !== undefined) update.avatar_url = body.avatar_url || null;

  if (body.notification_prefs !== undefined) {
    const role = g.session.role;
    if (role === "CLIENT_MANAGER") {
      const v = managerNotifSchema.safeParse(body.notification_prefs);
      if (!v.success) {
        return NextResponse.json({ error: "Invalid notification preferences" }, { status: 400 });
      }
      update.notification_prefs = v.data;
    } else {
      const v = salespersonNotifSchema.safeParse(body.notification_prefs);
      if (!v.success) {
        return NextResponse.json({ error: "Invalid notification preferences" }, { status: 400 });
      }
      update.notification_prefs = v.data;
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No changes" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: user, error } = await supabase.from("users").update(update).eq("id", g.session.userId).select("*").single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const roleOut = user.role as string;
  const prefsOut =
    roleOut === "CLIENT_MANAGER"
      ? getManagerPrefs((user as { notification_prefs?: unknown }).notification_prefs)
      : parseSalesPrefs((user as { notification_prefs?: unknown }).notification_prefs);

  return NextResponse.json({ user: { ...user, notification_prefs: prefsOut } });
}
