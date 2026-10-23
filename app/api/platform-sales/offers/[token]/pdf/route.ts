import { NextResponse } from "next/server";
import { recipientQuoteDownload } from "@/lib/platform-sales/public-service";
import { platformSalesEnabled } from "@/lib/platform-sales/flags";
export async function GET(
  _: Request,
  { params }: { params: { token: string } },
) {
  if (!platformSalesEnabled("quotes"))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    return NextResponse.redirect(await recipientQuoteDownload(params.token), {
      status: 302,
    });
  } catch {
    return NextResponse.json(
      { error: "Not found or no longer active" },
      { status: 404 },
    );
  }
}
