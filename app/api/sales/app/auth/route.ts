import { NextResponse } from "next/server";
import { SignJWT } from "jose";
import { verifyCredentials } from "@/lib/auth";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";

export const dynamic = "force-dynamic";

const THIRTY_DAYS_SEC = 30 * 24 * 60 * 60;

function parseLoginBody(parsed: unknown): { email?: string; password?: string } {
  let body: unknown = parsed;
  if (typeof body === "string") {
    body = JSON.parse(body) as unknown;
  }
  // Capacitor Android may wrap the payload as { value: { email, password } }.
  if (body && typeof body === "object" && "value" in body) {
    const wrapped = (body as { value?: unknown }).value;
    if (wrapped !== undefined) {
      body = typeof wrapped === "string" ? (JSON.parse(wrapped) as unknown) : wrapped;
    }
  }
  return body as { email?: string; password?: string };
}

export async function POST(req: Request) {
  let body: { email?: string; password?: string };
  try {
    body = parseLoginBody(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await verifyCredentials(email, password);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canActAsSalesperson(user)) {
    return NextResponse.json(
      { error: "Segmiq Sales is for salesperson and selling manager accounts only." },
      { status: 403 }
    );
  }

  if (!user.clientId) {
    return NextResponse.json(
      { error: "Your account is not linked to a client." },
      { status: 403 }
    );
  }

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const token = await new SignJWT({
    userId: user.id,
    role: user.role,
    clientId: user.clientId,
    clientMode: user.clientMode,
    alsoSells: user.alsoSells,
    name: user.name,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + THIRTY_DAYS_SEC)
    .sign(new TextEncoder().encode(secret));

  return NextResponse.json({
    token,
    user: {
      userId: user.id,
      name: user.name,
      clientId: user.clientId,
      role: user.role,
      clientMode: user.clientMode,
      alsoSells: user.alsoSells,
    },
  });
}
