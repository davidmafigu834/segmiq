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
  const { data, error } = await supabase
    .from("pricing_packages")
    .select("*")
    .eq("client_id", params.clientId)
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ packages: data ?? [] });
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
    price_from?: number | null;
    price_to?: number | null;
    price_label?: string;
    currency?: string;
    includes?: string[];
    is_featured?: boolean;
    display_order?: number;
    valid_until?: string | null;
  };

  const { data, error } = await supabase
    .from("pricing_packages")
    .insert({
      client_id: params.clientId,
      name: body.name,
      description: body.description ?? null,
      price_from: body.price_from ?? null,
      price_to: body.price_to ?? null,
      price_label: body.price_label ?? null,
      currency: body.currency ?? "USD",
      includes: body.includes ?? [],
      is_featured: body.is_featured ?? false,
      display_order: body.display_order ?? 0,
      valid_until: body.valid_until ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ package: data }, { status: 201 });
}
