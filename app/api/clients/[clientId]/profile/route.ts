import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isClientSlugAvailable, isProfileSlugAvailable } from "@/lib/clients/slug";

export async function GET(_req: Request, { params }: { params: { clientId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("client_profiles")
    .select("*")
    .eq("client_id", params.clientId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(req: Request, { params }: { params: { clientId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as Record<string, unknown>;
  const allowed = ["slug", "headline", "subheadline", "hero_image_key", "hero_image_url", "cta_text", "form_title", "is_published"];
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (key in body) patch[key] = body[key];
  }

  const supabase = createAdminClient();

  if (typeof patch.slug === "string" && patch.slug.trim()) {
    const nextSlug = patch.slug.trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(nextSlug)) {
      return NextResponse.json({ error: "Slug may only contain lowercase letters, numbers, and hyphens" }, { status: 400 });
    }
    patch.slug = nextSlug;

    const clientSlugOk = await isClientSlugAvailable(supabase, nextSlug, params.clientId);
    const profileSlugOk = await isProfileSlugAvailable(supabase, nextSlug, params.clientId);
    if (!clientSlugOk || !profileSlugOk) {
      return NextResponse.json(
        { error: "This profile URL is already in use by another client. Choose a different slug." },
        { status: 409 }
      );
    }
  }

  const { data: existing } = await supabase
    .from("client_profiles")
    .select("id")
    .eq("client_id", params.clientId)
    .maybeSingle();

  let data, error;
  if (existing) {
    ({ data, error } = await supabase
      .from("client_profiles")
      .update(patch)
      .eq("client_id", params.clientId)
      .select()
      .single());
  } else {
    const { data: client } = await supabase
      .from("clients")
      .select("slug")
      .eq("id", params.clientId)
      .maybeSingle();
    ({ data, error } = await supabase
      .from("client_profiles")
      .insert({ client_id: params.clientId, slug: (patch.slug ?? (client?.slug as string)) as string, ...patch })
      .select()
      .single());
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
