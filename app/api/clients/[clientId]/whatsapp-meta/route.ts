import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { clientId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Salespeople and client managers can only read their own client; agency can read any
  const supabase = createAdminClient();
  if (session.role !== "SUPER_ADMIN") {
    if (!session.clientId || session.clientId !== params.clientId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { data: client } = await supabase
    .from("clients")
    .select("name, industry, dial_code")
    .eq("id", params.clientId)
    .maybeSingle();

  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(client);
}
