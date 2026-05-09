import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const INDUSTRIES = [
  "Construction", "Solar Installation", "Landscaping", "Electrical",
  "Plumbing", "Interior Design", "Roofing", "Fencing", "Events", "Architecture", "Other",
];

const patchSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  industry: z.enum(INDUSTRIES as [string, ...string[]]).optional(),
  logo_url: z.string().url().nullable().optional(),
  logo_key: z.string().min(1).optional(),
});

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.clientId) return NextResponse.json({ error: "No client associated" }, { status: 400 });

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.name) update.name = parsed.data.name.trim();
  if (parsed.data.industry) update.industry = parsed.data.industry;
  if (parsed.data.logo_url !== undefined) update.logo_url = parsed.data.logo_url;
  if (parsed.data.logo_key !== undefined) update.logo_key = parsed.data.logo_key;

  if (Object.keys(update).length === 1) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("clients")
    .update(update)
    .eq("id", session.clientId)
    .select("id, name, industry, slug, logo_url")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
