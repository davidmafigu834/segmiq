import { NextResponse } from "next/server";
import { requireSessionFromRequest } from "@/lib/api-guards";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const USER_VISIBLE_EVENTS = new Set([
  "LOGIN_SUCCESS",
  "LOGIN_FAILED",
  "LOGOUT",
  "SESSION_CREATED",
  "SESSION_REVOKED",
  "SESSIONS_REVOKED_OTHERS",
  "SESSIONS_REVOKED_ALL",
  "LOGOUT_ALL",
  "PASSWORD_CHANGED",
  "PASSWORD_RESET",
  "MFA_ENABLED",
  "MFA_DISABLED",
  "MFA_CHALLENGE_SUCCESS",
  "MFA_CHALLENGE_FAILED",
  "RECOVERY_CODE_USED",
  "RECOVERY_CODES_REGENERATED",
  "EMAIL_CHANGED",
  "STEP_UP_SUCCESS",
]);

/** Own-account security activity only. No cross-user / no impersonation platform events. */
export async function GET(req: Request) {
  const g = await requireSessionFromRequest(req);
  if ("error" in g) return g.error;

  const url = new URL(req.url);
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? "20") || 20));
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? "0") || 0);

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("security_events")
    .select("id, event_type, created_at, metadata, user_agent")
    .eq("user_id", g.session.userId)
    .in("event_type", [...USER_VISIBLE_EVENTS])
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: "Failed to load activity" }, { status: 500 });
  }

  const events = (data ?? []).map((row) => ({
    id: row.id,
    type: row.event_type,
    createdAt: row.created_at,
    // Do not expose raw IP; optional safe label from metadata only
    summary: summarizeEvent(row.event_type as string),
  }));

  return NextResponse.json({ events, limit, offset });
}

function summarizeEvent(type: string): string {
  switch (type) {
    case "LOGIN_SUCCESS":
      return "Successful sign-in";
    case "LOGIN_FAILED":
      return "Unsuccessful sign-in attempt";
    case "SESSION_CREATED":
      return "New device signed in";
    case "LOGOUT":
      return "Signed out";
    case "SESSION_REVOKED":
    case "SESSIONS_REVOKED_OTHERS":
      return "Session signed out";
    case "SESSIONS_REVOKED_ALL":
    case "LOGOUT_ALL":
      return "Signed out everywhere";
    case "PASSWORD_CHANGED":
      return "Password changed";
    case "PASSWORD_RESET":
      return "Password reset";
    case "MFA_ENABLED":
      return "Two-step verification enabled";
    case "MFA_DISABLED":
      return "Two-step verification disabled";
    case "MFA_CHALLENGE_SUCCESS":
      return "Two-step verification succeeded";
    case "MFA_CHALLENGE_FAILED":
      return "Two-step verification failed";
    case "RECOVERY_CODE_USED":
      return "Recovery code used";
    case "RECOVERY_CODES_REGENERATED":
      return "Recovery codes regenerated";
    case "EMAIL_CHANGED":
      return "Email address changed";
    case "STEP_UP_SUCCESS":
      return "Security verification completed";
    default:
      return type;
  }
}
