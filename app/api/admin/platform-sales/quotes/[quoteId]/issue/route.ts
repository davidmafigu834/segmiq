import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/require-agency-admin";
import { issuePlatformQuote } from "@/lib/platform-sales/service";
import { assertSameOrigin } from "@/lib/platform-sales/http";
import { platformSalesEnabled } from "@/lib/platform-sales/flags";
export async function POST(
  request: Request,
  { params }: { params: { quoteId: string } },
) {
  const auth = await requireSuperAdmin();
  if ("error" in auth || auth.session.isImpersonating)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!platformSalesEnabled("quotes"))
    return NextResponse.json(
      { error: "Platform sales quotes are disabled" },
      { status: 409 },
    );
  try {
    assertSameOrigin(request);
    return NextResponse.json(
      await issuePlatformQuote(
        params.quoteId,
        auth.session.userId,
        new URL(request.url).origin,
      ),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Issue failed" },
      { status: 400 },
    );
  }
}
