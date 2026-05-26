import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRoles } from "@/lib/api-guards";
import { getDefaultResponseHoursForNewClients } from "@/lib/agency-settings";
import { seedPredefinedSegments } from "@/lib/audience-segments";

export const dynamic = "force-dynamic";

export async function GET() {
  const g = await requireRoles(["AGENCY_ADMIN", "CLIENT_MANAGER", "SALESPERSON"]);
  if ("error" in g) return g.error;
  const supabase = createAdminClient();
  if (g.session.role !== "AGENCY_ADMIN") {
    if (!g.session.clientId) return NextResponse.json([], { status: 200 });
    const { data } = await supabase
      .from("clients")
      .select("id, name, slug")
      .eq("id", g.session.clientId)
      .eq("is_active", true)
      .maybeSingle();
    return NextResponse.json(data ? [data] : []);
  }
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, slug")
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

const createSchema = z.object({
  name: z.string().min(1).max(200),
  industry: z.string().min(1).max(120),
  slug: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/),
});

export async function POST(req: Request) {
  const g = await requireRoles(["AGENCY_ADMIN"]);
  if ("error" in g) return g.error;

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: taken } = await supabase.from("clients").select("id").eq("slug", parsed.data.slug).maybeSingle();
  if (taken) {
    return NextResponse.json({ error: "Slug already in use" }, { status: 400 });
  }

  const defaultHours = await getDefaultResponseHoursForNewClients();

  const { data: client, error } = await supabase
    .from("clients")
    .insert({
      name: parsed.data.name.trim(),
      industry: parsed.data.industry.trim(),
      slug: parsed.data.slug.trim(),
      response_time_limit_hours: defaultHours,
    })
    .select("*")
    .single();

  if (error || !client) {
    console.error("[POST /api/clients]", error);
    return NextResponse.json({ error: error?.message ?? "Failed to create client" }, { status: 500 });
  }

  await supabase.from("form_schemas").insert({
    client_id: client.id as string,
    form_title: "Contact us",
    fields: [],
  });

  await supabase.from("client_profiles").insert({
    client_id: client.id as string,
    slug: parsed.data.slug.trim(),
    is_published: false,
  });

  // Fire-and-forget: seed predefined audience segments for the new client
  seedPredefinedSegments(client.id as string).catch((err) =>
    console.error("[POST /api/clients] seedPredefinedSegments failed:", err)
  );

  return NextResponse.json({ client });
}
