import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const patchSchema = z.object({
  fields: z.array(z.record(z.unknown())).optional(),
  thank_you_message: z.string().optional(),
  form_title: z.string().optional(),
  submit_button_text: z.string().optional(),
  opening_message: z.string().optional(),
});

export async function PATCH(req: Request, { params }: { params: { clientId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.role !== "AGENCY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const supabase = createAdminClient();
  const updates = {
    ...parsed.data,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("form_schemas")
    .upsert(
      { client_id: params.clientId, ...updates },
      { onConflict: "client_id" }
    )
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ form: data });
}
