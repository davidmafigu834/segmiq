import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/require-agency-admin";
import { adminQuoteDownload } from "@/lib/platform-sales/service";
export async function GET(
  _: Request,
  { params }: { params: { quoteId: string } },
) {
  const auth = await requireSuperAdmin();
  if ("error" in auth || auth.session.isImpersonating)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.redirect(await adminQuoteDownload(params.quoteId), {
      status: 302,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "PDF unavailable" },
      { status: 404 },
    );
  }
}
