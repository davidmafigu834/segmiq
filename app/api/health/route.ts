import { NextResponse } from "next/server";
import { fetchAuthFirstRow } from "@/lib/supabase/auth-rest";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = await fetchAuthFirstRow<{ id: string }>("users", "select=id&limit=1", 5_000);
  return NextResponse.json({
    ok: db.ok,
    ts: new Date().toISOString(),
    db: db.ok ? "up" : "down",
    dbReason: db.ok ? null : db.reason,
    dbStatus: db.ok ? null : db.status ?? null,
  });
}
