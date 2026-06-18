import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/auth/resolveApiAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessClient } from "@/lib/auth/permissions";

export async function GET(req: Request, { params }: { params: { clientId: string } }) {
  const auth = await resolveApiAuth(req);
  if (!auth?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(auth.role, auth.clientId, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*, project_media(id, public_url, display_order, caption, storage_key, milestone_id), project_milestones(id, is_completed)")
    .eq("client_id", params.clientId)
    .order("display_order", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request, { params }: { params: { clientId: string } }) {
  const auth = await resolveApiAuth(req);
  if (!auth?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(auth.role, auth.clientId, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as {
    title: string;
    category?: string;
    location?: string;
    completion_date?: string;
    description?: string;
    is_featured?: boolean;
    is_public?: boolean;
  };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({
      client_id: params.clientId,
      title: body.title,
      category: body.category ?? null,
      location: body.location ?? null,
      completion_date: body.completion_date ?? null,
      description: body.description ?? null,
      is_featured: body.is_featured ?? false,
      is_public: body.is_public ?? true,
      display_order: 0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
