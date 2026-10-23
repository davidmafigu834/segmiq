import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/require-agency-admin";
import { quoteInputSchema } from "@/lib/platform-sales/schemas";
import { createPlatformQuote } from "@/lib/platform-sales/service";
import { assertSameOrigin } from "@/lib/platform-sales/http";
import { platformSalesEnabled } from "@/lib/platform-sales/flags";
export async function POST(request: Request) {
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
    const input = quoteInputSchema.parse(await request.json());
    return NextResponse.json(
      await createPlatformQuote(input, auth.session.userId),
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Quote creation failed",
      },
      { status: 400 },
    );
  }
}
