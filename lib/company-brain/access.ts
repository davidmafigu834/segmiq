import { resolveApiAuth } from "@/lib/auth/resolveApiAuth";

export async function requireCompanyBrainManager(req: Request): Promise<
  | { ok: true; clientId: string; userId: string; role: string }
  | { ok: false; status: number; error: string }
> {
  const auth = await resolveApiAuth(req);
  if (!auth) return { ok: false, status: 401, error: "Unauthorized" };
  const url = new URL(req.url);
  const requested = url.searchParams.get("clientId");
  if (auth.role === "SUPER_ADMIN") {
    const clientId = requested ?? auth.clientId;
    if (!clientId) return { ok: false, status: 400, error: "clientId required" };
    return { ok: true, clientId, userId: auth.userId, role: auth.role };
  }
  if (auth.role !== "CLIENT_MANAGER" || !auth.clientId) {
    return { ok: false, status: 403, error: "Only company managers can manage Company Brain" };
  }
  if (requested && requested !== auth.clientId) {
    return { ok: false, status: 403, error: "Forbidden" };
  }
  return { ok: true, clientId: auth.clientId, userId: auth.userId, role: auth.role };
}
