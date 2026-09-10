import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { postLoginPath } from "@/lib/auth/post-login-redirect";
import { mustEnrollMfa } from "@/lib/auth/mfa/service";
import { isSuperAdminRole } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

function mfaEnrolmentHome(role: string): string {
  if (isSuperAdminRole(role)) {
    return "/dashboard/settings?tab=account&enrollMfa=1";
  }
  if (role === "SALESPERSON") {
    return "/sales/profile";
  }
  return "/client/settings/security";
}

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

  // Safe MFA enrolment gate (platform SUPER_ADMIN + org policy).
  if (
    session.mfaEnrolmentRequired ||
    (await mustEnrollMfa(session.userId, session.role, {
      clientId: session.clientId,
    }))
  ) {
    return NextResponse.json({
      home: mfaEnrolmentHome(session.role),
    });
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
