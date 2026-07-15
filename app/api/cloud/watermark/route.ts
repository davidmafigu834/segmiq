import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canManageCloudSettings } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveClientLogoKey } from "@/lib/watermark/storage-keys";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || !session?.clientId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageCloudSettings(session, session.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("client_profiles")
    .select("watermark_enabled, watermark_position, watermark_opacity, watermark_size")
    .eq("client_id", session.clientId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const typedData = data as {
    watermark_enabled?: boolean;
    watermark_position?: string;
    watermark_opacity?: number;
    watermark_size?: string;
  } | null;

  return NextResponse.json({
    enabled: typedData?.watermark_enabled ?? false,
    position: typedData?.watermark_position ?? "bottom-right",
    opacity: typedData?.watermark_opacity ?? 40,
    size: typedData?.watermark_size ?? "small",
  });
}

const patchSchema = z.object({
  enabled: z.boolean().optional(),
  position: z.enum(["bottom-right", "bottom-left", "bottom-center", "center"]).optional(),
  opacity: z.number().int().min(10).max(90).optional(),
  size: z.enum(["small", "medium", "large"]).optional(),
});

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId || !session?.clientId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageCloudSettings(session, session.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.enabled !== undefined) update.watermark_enabled = parsed.data.enabled;
  if (parsed.data.position !== undefined) update.watermark_position = parsed.data.position;
  if (parsed.data.opacity !== undefined) update.watermark_opacity = parsed.data.opacity;
  if (parsed.data.size !== undefined) update.watermark_size = parsed.data.size;

  const supabase = createAdminClient();

  if (parsed.data.enabled) {
    const { data: client } = await supabase
      .from("clients")
      .select("logo_key, logo_url")
      .eq("id", session.clientId)
      .maybeSingle();

    const logoKey = resolveClientLogoKey(
      client as { logo_key?: string | null; logo_url?: string | null } | null
    );
    if (!logoKey) {
      return NextResponse.json(
        { error: "Upload a company logo before enabling watermark." },
        { status: 400 }
      );
    }

    if (!(client as { logo_key?: string | null } | null)?.logo_key) {
      await supabase
        .from("clients")
        .update({ logo_key: logoKey, updated_at: new Date().toISOString() })
        .eq("id", session.clientId);
    }
  }

  const { data: existing } = await supabase
    .from("client_profiles")
    .select("id")
    .eq("client_id", session.clientId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("client_profiles")
      .update(update)
      .eq("client_id", session.clientId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { data: client } = await supabase
      .from("clients")
      .select("slug")
      .eq("id", session.clientId)
      .maybeSingle();
    const slug = ((client?.slug as string | undefined)?.trim() || session.clientId) as string;
    const { error } = await supabase.from("client_profiles").insert({
      client_id: session.clientId,
      slug,
      is_published: false,
      ...update,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
