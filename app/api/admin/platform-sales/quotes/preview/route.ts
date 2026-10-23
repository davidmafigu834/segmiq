import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/require-agency-admin";
import { quoteInputSchema } from "@/lib/platform-sales/schemas";
import { previewPlatformQuote } from "@/lib/platform-sales/service";
import { assertSameOrigin } from "@/lib/platform-sales/http";
export async function POST(request: Request) {
  const auth = await requireSuperAdmin();
  if ("error" in auth || auth.session.isImpersonating)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    assertSameOrigin(request);
    const input = quoteInputSchema.parse(await request.json());
    return NextResponse.json(
      await previewPlatformQuote(input, auth.session.userId),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Preview failed" },
      { status: 400 },
    );
  }
}
