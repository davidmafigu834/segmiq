import { NextResponse } from "next/server";
import {
  openPlatformOffer,
  respondToPlatformOffer,
} from "@/lib/platform-sales/public-service";
import { recipientResponseSchema } from "@/lib/platform-sales/schemas";
import { assertSameOrigin } from "@/lib/platform-sales/http";
import { platformSalesEnabled } from "@/lib/platform-sales/flags";
export async function GET(
  _: Request,
  { params }: { params: { token: string } },
) {
  if (!platformSalesEnabled("quotes"))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const offer = await openPlatformOffer(params.token);
    return offer
      ? NextResponse.json({ offer })
      : NextResponse.json(
          { error: "Not found or no longer active" },
          { status: 404 },
        );
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
export async function POST(
  request: Request,
  { params }: { params: { token: string } },
) {
  if (!platformSalesEnabled("quotes"))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    assertSameOrigin(request);
    const input = recipientResponseSchema.parse(await request.json());
    return NextResponse.json({
      status: await respondToPlatformOffer(params.token, input),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Response failed" },
      { status: 400 },
    );
  }
}
