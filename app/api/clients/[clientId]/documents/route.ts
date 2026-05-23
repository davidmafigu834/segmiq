import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessClient } from "@/lib/auth/permissions";

export async function GET(_req: Request, { params }: { params: { clientId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role, session.clientId, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("client_documents")
    .select("*")
    .eq("client_id", params.clientId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  return NextResponse.json({ documents: data ?? [] });
}

export async function POST(req: Request, { params }: { params: { clientId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role, session.clientId, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const body = (await req.json()) as {
    name: string;
    description?: string;
    file_url: string;
    storage_key?: string;
    file_type?: string;
    file_size_bytes?: number;
  };

  const { data, error } = await supabase
    .from("client_documents")
    .insert({
      client_id: params.clientId,
      name: body.name,
      description: body.description ?? null,
      file_url: body.file_url,
      storage_key: body.storage_key ?? null,
      file_type: body.file_type ?? null,
      file_size_bytes: body.file_size_bytes ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ document: data }, { status: 201 });
}
