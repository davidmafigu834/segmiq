import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugifyFormName } from "@/lib/instant-form-helpers";
import { z } from "zod";

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  slug: z.string().min(1).max(80).optional(),
  status: z.enum(["draft", "published"]).optional(),
  form_type: z.enum(["more_volume", "higher_intent"]).optional(),
  intro: z.record(z.unknown()).optional(),
  questions: z.array(z.record(z.unknown())).optional(),
  consents: z.array(z.record(z.unknown())).optional(),
  privacy: z.record(z.unknown()).optional(),
  completion: z.record(z.unknown()).optional(),
});

export async function PATCH(req: Request, { params }: { params: { clientId: string; formId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.role !== "AGENCY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("instant_forms")
    .select("id, client_id")
    .eq("id", params.formId)
    .eq("client_id", params.clientId)
    .maybeSingle();

  if (!existing) return NextResponse.json({ error: "Form not found" }, { status: 404 });

  const updates: Record<string, unknown> = {
    ...parsed.data,
    updated_at: new Date().toISOString(),
  };

  if (parsed.data.slug) {
    updates.slug = slugifyFormName(parsed.data.slug);
    const { data: conflict } = await supabase
      .from("instant_forms")
      .select("id")
      .eq("slug", updates.slug as string)
      .neq("id", params.formId)
      .maybeSingle();
    if (conflict) {
      return NextResponse.json({ error: "Slug already in use" }, { status: 409 });
    }
  }

  const { data, error } = await supabase
    .from("instant_forms")
    .update(updates)
    .eq("id", params.formId)
    .eq("client_id", params.clientId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ form: data });
}

export async function DELETE(_req: Request, { params }: { params: { clientId: string; formId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.role !== "AGENCY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("instant_forms")
    .delete()
    .eq("id", params.formId)
    .eq("client_id", params.clientId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
