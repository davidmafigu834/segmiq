import { NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth/getAuthFromRequest";
import type { WorkProjectActor } from "@/lib/work-projects/access";
import type { ServiceResult } from "@/lib/work-projects/service";

export async function workProjectActor(req: Request): Promise<WorkProjectActor | null> {
  const session = await getAuthFromRequest(req);
  if (!session?.userId || !session.role) return null;
  return {
    userId: session.userId,
    role: session.role,
    clientId: session.clientId ?? null,
  };
}

export function workProjectError(result: Extract<ServiceResult<unknown>, { ok: false }>) {
  return NextResponse.json({ error: result.error }, { status: result.status });
}
