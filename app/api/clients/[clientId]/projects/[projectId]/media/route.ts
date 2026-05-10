import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessClient } from "@/lib/auth/permissions";

export async function GET(_req: Request, { params }: { params: { clientId: string; projectId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role, session.clientId, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("project_media")
    .select("*")
    .eq("project_id", params.projectId)
    .eq("client_id", params.clientId)
    .order("display_order", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request, { params }: { params: { clientId: string; projectId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role, session.clientId, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as {
    storage_key: string;
    public_url: string;
    type?: string;
    caption?: string;
    file_size_bytes?: number;
    display_order?: number;
    thumbnail_url?: string;
    duration_seconds?: number;
  };

  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("project_media")
    .select("display_order")
    .eq("project_id", params.projectId)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = (existing?.display_order as number | null ?? -1) + 1;

  const { data, error } = await supabase
    .from("project_media")
    .insert({
      project_id: params.projectId,
      client_id: params.clientId,
      type: body.type ?? "photo",
      storage_key: body.storage_key,
      public_url: body.public_url,
      caption: body.caption ?? null,
      file_size_bytes: body.file_size_bytes ?? null,
      display_order: body.display_order ?? nextOrder,
      thumbnail_url: body.thumbnail_url ?? null,
      duration_seconds: body.duration_seconds ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
