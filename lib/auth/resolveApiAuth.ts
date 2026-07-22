import { getServerSession } from "next-auth";
import { jwtVerify } from "jose";
import { authOptions } from "@/lib/auth";
import type { UserRole } from "@/types";

export type ApiAuth = {
  userId: string;
  role: UserRole;
  clientId: string | null;
  alsoSells?: boolean;
};

function getSecret(): Uint8Array | null {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return null;
  return new TextEncoder().encode(secret);
}

async function verifyBearerToken(req: Request): Promise<ApiAuth | null> {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;

  const token = header.slice(7).trim();
  if (!token) return null;

  const secret = getSecret();
  if (!secret) return null;

  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    const userId = payload.userId;
    const role = payload.role;
    const clientId = payload.clientId;
    const alsoSells = payload.alsoSells;
    if (typeof userId !== "string" || typeof role !== "string") return null;
    return {
      userId,
      role: role as UserRole,
      clientId: typeof clientId === "string" ? clientId : clientId === null ? null : null,
      alsoSells: typeof alsoSells === "boolean" ? alsoSells : Boolean(alsoSells),
    };
  } catch {
    return null;
  }
}

/** Cookie session first (web unchanged), then Bearer JWT for the field app. */
export async function resolveApiAuth(req: Request): Promise<ApiAuth | null> {
  const session = await getServerSession(authOptions);
  if (session?.userId) {
    return {
      userId: session.userId,
      role: session.role,
      clientId: session.clientId ?? null,
      alsoSells: session.alsoSells,
    };
  }
  return verifyBearerToken(req);
}
