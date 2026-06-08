/**
 * Self-hosted health checks. Each function probes one component and returns whether it's up
 * plus a latency. The cron route runs these on a schedule and records results in status_checks.
 */

import { createAdminClient } from "@/lib/supabase/admin";

export type CheckResult = { key: string; ok: boolean; latencyMs: number };

async function timed(key: string, fn: () => Promise<boolean>): Promise<CheckResult> {
  const start = Date.now();
  try {
    const ok = await Promise.race([
      fn(),
      new Promise<boolean>((_, rej) => setTimeout(() => rej(new Error("timeout")), 8000)),
    ]);
    return { key, ok, latencyMs: Date.now() - start };
  } catch {
    return { key, ok: false, latencyMs: Date.now() - start };
  }
}

async function pingUrl(url: string): Promise<boolean> {
  const res = await fetch(url, { method: "GET", cache: "no-store" });
  return res.ok;
}

const BASE = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || "https://segmiq.com";
const CLOUD = process.env.NEXT_PUBLIC_CLOUD_URL || "https://cloud.segmiq.com";

async function checkDatabase(): Promise<boolean> {
  const { error } = await createAdminClient().from("status_components").select("key").limit(1);
  return !error;
}

async function checkEmail(): Promise<boolean> {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

async function checkWhatsApp(): Promise<boolean> {
  const token = process.env.META_WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) return false;
  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${phoneId}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function checkApiAndDb(): Promise<boolean> {
  const [healthOk, dbOk] = await Promise.all([
    pingUrl(`${BASE}/api/health`),
    checkDatabase(),
  ]);
  return healthOk && dbOk;
}

export async function runHealthChecks(): Promise<CheckResult[]> {
  return Promise.all([
    timed("website", () => pingUrl(BASE)),
    timed("crm", checkApiAndDb),
    timed("dashboards", () => pingUrl(`${BASE}/api/health`)),
    timed("api", checkApiAndDb),
    timed("cloud", () => pingUrl(CLOUD)),
    timed("forms", () => pingUrl(`${BASE}/api/health`)),
    timed("email", checkEmail),
    timed("whatsapp", checkWhatsApp),
  ]);
}
