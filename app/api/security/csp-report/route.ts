import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkDbRateLimit } from "@/lib/auth/db-rate-limit";
import { clientIpFromRequest } from "@/lib/auth/user-sessions";

export const dynamic = "force-dynamic";

const MAX_BODY = 16_384;
const MAX_REPORTS = 20;

type CspReport = {
  "csp-report"?: Record<string, unknown>;
  body?: Record<string, unknown>;
};

function sanitizeUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const u = new URL(raw);
    // Strip query/hash — public tokens must not land in logs.
    return `${u.origin}${u.pathname}`.slice(0, 500);
  } catch {
    return raw.replace(/[?#].*$/, "").slice(0, 500);
  }
}

/**
 * CSP Report-Only / Report-To collector (Phase 6.1).
 * Public, rate-limited, size-capped. Does not enable CSP_ENFORCE.
 */
export async function POST(req: Request) {
  const ip = clientIpFromRequest(req);
  const rl = await checkDbRateLimit({
    key: `csp-report:${ip}`,
    limit: 60,
    windowMs: 60_000,
  }).catch(() => ({ ok: true as const }));
  if (!rl.ok) {
    return new NextResponse(null, { status: 204 });
  }

  const len = Number(req.headers.get("content-length") || "0");
  if (len > MAX_BODY) {
    return new NextResponse(null, { status: 413 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const reports: Array<Record<string, unknown>> = [];
  if (Array.isArray(raw)) {
    for (const item of raw.slice(0, MAX_REPORTS)) {
      if (item && typeof item === "object") reports.push(item as Record<string, unknown>);
    }
  } else if (raw && typeof raw === "object") {
    const o = raw as CspReport;
    if (o["csp-report"] && typeof o["csp-report"] === "object") {
      reports.push(o["csp-report"]);
    } else if (o.body && typeof o.body === "object") {
      reports.push(o.body);
    } else {
      reports.push(raw as Record<string, unknown>);
    }
  }

  try {
    const supabase = createAdminClient();
    for (const r of reports.slice(0, MAX_REPORTS)) {
      const violated = sanitizeUrl(r["violated-directive"] ?? r.effectiveDirective ?? r.directive);
      const blocked = sanitizeUrl(r["blocked-uri"] ?? r.blockedURL ?? r.blockedUri);
      const doc = sanitizeUrl(r["document-uri"] ?? r.documentURL ?? r.documentUri);
      // Structured warn only — no cookies/tokens.
      console.warn(
        "[csp-report]",
        JSON.stringify({
          violated,
          blocked,
          document: doc,
          disposition: r.disposition ?? null,
        })
      );
      void supabase.from("csp_violation_reports").insert({
        violated_directive: typeof r["violated-directive"] === "string"
          ? String(r["violated-directive"]).slice(0, 200)
          : null,
        blocked_uri: blocked,
        document_uri: doc,
        user_agent: (req.headers.get("user-agent") || "").slice(0, 300) || null,
        created_at: new Date().toISOString(),
      });
    }
  } catch {
    /* table may not exist yet — logging still happened */
  }

  return new NextResponse(null, { status: 204 });
}
