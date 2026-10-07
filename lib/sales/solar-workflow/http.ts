import { NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth/getAuthFromRequest";
import type { SolarActor } from "./service";

export async function solarActor(req: Request): Promise<SolarActor | null> {
  const session = await getAuthFromRequest(req);
  if (!session?.userId || !session.clientId || !session.role) return null;
  return { userId: session.userId, role: session.role, clientId: session.clientId };
}

export function solarError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}
