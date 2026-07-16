import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { postLoginPath } from "@/lib/auth/post-login-redirect";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const callbackUrl = searchParams.get("callbackUrl");

  if (
    (session.role === "SALESPERSON" || session.role === "CLIENT_MANAGER") &&
    !session.clientId
  ) {
    return NextResponse.json(
      { error: "no_client", message: "Account is not linked to a client workspace." },
      { status: 403 }
    );
  }

  return NextResponse.json({
    home: postLoginPath({
      role: session.role,
      clientMode: session.clientMode,
      clientId: session.clientId,
      callbackUrl,
    }),
  });
}
