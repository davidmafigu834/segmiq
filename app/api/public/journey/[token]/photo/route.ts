import { NextResponse } from "next/server";
import { journeyListingPhoto } from "@/lib/real-estate/workflow/journey-links";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Streams the listing photograph for a valid viewing link. The storage key stays on the server. */
export async function GET(req: Request, { params }: { params: { token: string } }) {
  const raw = new URL(req.url).searchParams.get("index");
  const index = raw == null || raw === "" ? 0 : Number(raw);
  const result = await journeyListingPhoto(params.token, index);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return new NextResponse(Buffer.from(result.bytes), {
    headers: { "Content-Type": result.contentType, "Cache-Control": "private, no-store" },
  });
}
