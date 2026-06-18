import { NextResponse } from "next/server";
import { SignJWT } from "jose";
import { verifyCredentials } from "@/lib/auth";

export const dynamic = "force-dynamic";

const THIRTY_DAYS_SEC = 30 * 24 * 60 * 60;

export async function POST(req: Request) {
  let body: { email?: string; password?: string };
  try {
    body = (await req.json()) as { email?: string; password?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { email, password } = body;
  if (!email || !password) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await verifyCredentials(email, password);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const token = await new SignJWT({
    userId: user.id,
    role: user.role,
    clientId: user.clientId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + THIRTY_DAYS_SEC)
    .sign(new TextEncoder().encode(secret));

  return NextResponse.json({
    token,
    user: {
      clientId: user.clientId,
      role: user.role,
      name: user.name,
    },
  });
}
