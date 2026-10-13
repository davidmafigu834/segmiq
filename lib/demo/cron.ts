import { NextResponse } from "next/server";
import { isDemoDeployment } from "@/lib/demo/deployment";

/**
 * Skip the whole scheduler only on an isolated demo deployment.
 * The shared production app must keep running jobs for paying customers.
 */
export function demoCronSkip(): NextResponse | null {
  if (!isDemoDeployment()) return null;
  return NextResponse.json({ ok: true, skipped: "demo-deployment" });
}

/**
 * Drop demo organisations from a small query double.
 * Do not pass a Supabase builder through this generic: that instantiation overflows the type checker.
 * Production queries chain `.neq("workspace_mode", "demo")` directly.
 */
export function excludeDemoWorkspaces<Q extends { neq: (column: string, value: string) => Q }>(query: Q): Q {
  return query.neq("workspace_mode", "demo");
}
