import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canReadLead } from "@/lib/auth/permissions";
import { getObject } from "@/lib/storage/r2";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { messageId: string } }) {
  const supabase = createAdminClient();
  const { data: row, error } = await supabase
    .from("whatsapp_messages")
    .select("lead_id, media_url, media_storage_key, media_mime_type")
    .eq("id", params.messageId)
    .maybeSingle();

  if (error || !row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const access = await canReadLead(row.lead_id as string, req);
  if (!access.ok) {
    return NextResponse.json({ error: "Not found" }, { status: access.status === 401 ? 401 : 404 });
  }

  const publicUrl = (row.media_url as string | null)?.trim();
  if (publicUrl) {
    return NextResponse.redirect(publicUrl, 302);
  }

  const storageKey = (row.media_storage_key as string | null)?.trim();
  if (!storageKey) {
    return NextResponse.json({ error: "Media unavailable" }, { status: 404 });
  }

  try {
    const buffer = await getObject(storageKey);
    const mimeType = (row.media_mime_type as string | null) ?? "application/octet-stream";
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Could not load media" }, { status: 500 });
  }
}
