import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canAccessClient } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(_req: Request, { params }: { params: { clientId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role, session.clientId, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("testimonials")
    .select("*")
    .eq("client_id", params.clientId)
    .order("display_order", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request, { params }: { params: { clientId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role, session.clientId, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as {
    author_name: string;
    author_role?: string;
    content: string;
    rating?: number;
    photo_url?: string;
    video_url?: string;
    is_featured?: boolean;
    display_order?: number;
  };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("testimonials")
    .insert({
      client_id: params.clientId,
      author_name: body.author_name,
      author_role: body.author_role ?? null,
      content: body.content,
      rating: body.rating ?? null,
      photo_url: body.photo_url ?? null,
      video_url: body.video_url ?? null,
      is_featured: body.is_featured ?? false,
      display_order: body.display_order ?? 0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
