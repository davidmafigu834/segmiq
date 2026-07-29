import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { canAccessClient } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).nullable().optional(),
  total_units: z.number().int().nullable().optional(),
  completion_date: z.string().nullable().optional(),
  location: z.string().max(300).nullable().optional(),
});

export async function GET(req: Request, { params }: { params: { clientId: string } }) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;

  const supabase = createAdminClient();
  const { data: developments, error } = await supabase
    .from("developments")
    .select("*")
    .eq("client_id", params.clientId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: listings } = await supabase
    .from("listings")
    .select("id, development_id, status")
    .eq("client_id", params.clientId)
    .not("development_id", "is", null);

  const inventory = (developments ?? []).map((d) => {
    const units = (listings ?? []).filter((l) => l.development_id === d.id);
    return {
      ...d,
      inventory: {
        total_listed: units.length,
        available: units.filter((u) => u.status === "available").length,
        reserved: units.filter((u) => u.status === "reserved").length,
        sold: units.filter((u) => u.status === "sold").length,
        under_offer: units.filter((u) => u.status === "under_offer").length,
        let: units.filter((u) => u.status === "let").length,
      },
    };
  });

  return NextResponse.json({ developments: inventory });
}

export async function POST(req: Request, { params }: { params: { clientId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role, session.clientId, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: client } = await supabase
    .from("clients")
    .select("business_type")
    .eq("id", params.clientId)
    .maybeSingle();
  if (!client || client.business_type !== "real_estate") {
    return NextResponse.json({ error: "Developments are only available for real estate clients" }, { status: 403 });
  }

  const now = new Date().toISOString();
  const body = parsed.data;
  const { data, error } = await supabase
    .from("developments")
    .insert({
      client_id: params.clientId,
      name: body.name.trim(),
      description: body.description?.trim() || null,
      total_units: body.total_units ?? null,
      completion_date: body.completion_date || null,
      location: body.location?.trim() || null,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ development: data }, { status: 201 });
}
