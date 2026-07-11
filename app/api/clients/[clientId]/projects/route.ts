import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/auth/resolveApiAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessClient } from "@/lib/auth/permissions";
import { fetchProjectsForClient } from "@/lib/cloud/project-queries";
import { isMissingMagazineColumnError, projectRowSelect } from "@/lib/cloud/project-columns";

export async function GET(req: Request, { params }: { params: { clientId: string } }) {
  const auth = await resolveApiAuth(req);
  if (!auth?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(auth.role, auth.clientId, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { data, error } = await fetchProjectsForClient(supabase, params.clientId);

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
  const { data: inserted, error } = await supabase
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
    .select("id")
    .single();

  if (error || !inserted) return NextResponse.json({ error: error?.message ?? "Insert failed" }, { status: 500 });

  let row = await supabase
    .from("projects")
    .select(projectRowSelect(true))
    .eq("id", inserted.id as string)
    .eq("client_id", params.clientId)
    .single();

  if (row.error && isMissingMagazineColumnError(row.error.message)) {
    row = await supabase
      .from("projects")
      .select(projectRowSelect(false))
      .eq("id", inserted.id as string)
      .eq("client_id", params.clientId)
      .single();
  }

  if (row.error) return NextResponse.json({ error: row.error.message }, { status: 500 });
  return NextResponse.json(row.data, { status: 201 });
}
