import { NextResponse } from "next/server";
import { journeyListingPhoto } from "@/lib/real-estate/workflow/journey-links";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Streams the listing photograph for a valid viewing link. The storage key stays on the server. */
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const result = await journeyListingPhoto(params.token);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return new NextResponse(Buffer.from(result.bytes), {
    headers: { "Content-Type": result.contentType, "Cache-Control": "private, no-store" },
  });
}
