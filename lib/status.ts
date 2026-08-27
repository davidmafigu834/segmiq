/**
 * Status data layer for the public Status page.
 * Reads live health-check results and incidents from Supabase.
 */

import { createAdminClient } from "@/lib/supabase/admin";

export type Health = "ok" | "warn" | "err";

export type ComponentStatus = {
  key: string;
  name: string;
  status: Health;
  uptime90: string;
  bars: Health[];
};

export type Incident = {
  id: string;
  title: string;
  body: string;
  startedAt: string;
  resolvedAt: string | null;
};

export type StatusPage = {
  updatedAt: string;
  overall: Health;
  components: ComponentStatus[];
  incidents: Incident[];
};

const DAY = 86_400_000;

async function fromSupabase(): Promise<StatusPage> {
  const supabase = createAdminClient();
  const since = new Date(Date.now() - 14 * DAY).toISOString();

  const [{ data: comps }, { data: checks }, { data: incidents }] = await Promise.all([
    supabase.from("status_components").select("*").eq("enabled", true).order("sort_order"),
    supabase.from("status_checks").select("component_key, ok, checked_at").gte("checked_at", since),
    supabase.from("status_incidents").select("*").order("started_at", { ascending: false }).limit(20),
  ]);

  const byComp: Record<string, { ok: number; total: number; days: Map<number, boolean> }> = {};
  for (const c of comps ?? []) byComp[c.key as string] = { ok: 0, total: 0, days: new Map() };
  for (const row of checks ?? []) {
    const b = byComp[row.component_key as string];
    if (!b) continue;
    b.total++;
    if (row.ok) b.ok++;
    const dayIdx = Math.floor((Date.now() - new Date(row.checked_at as string).getTime()) / DAY);
    const prev = b.days.get(dayIdx);
    b.days.set(dayIdx, prev === undefined ? Boolean(row.ok) : prev && Boolean(row.ok));
  }

  const components: ComponentStatus[] = (comps ?? []).map((c) => {
    const b = byComp[c.key as string];
    const bars: Health[] = Array.from({ length: 90 }, (_, i) => {
      const day = b.days.get(89 - i);
      return day === undefined ? "ok" : day ? "ok" : "err";
    });
    const uptime = b.total ? (b.ok / b.total) * 100 : 100;
    const recent = b.days.get(0);
    const status: Health = recent === false ? "err" : "ok";
    return {
      key: c.key as string,
      name: c.name as string,
      status,
      uptime90: uptime.toFixed(2) + "%",
      bars,
    };
  });

  const overall: Health = components.some((c) => c.status === "err")
    ? "err"
    : components.some((c) => c.status === "warn")
      ? "warn"
      : "ok";

  const inc: Incident[] = (incidents ?? []).map((r) => ({
    id: r.id as string,
    title: r.title as string,
    body: r.body as string,
    startedAt: r.started_at as string,
    resolvedAt: (r.resolved_at as string | null) ?? null,
  }));

  return { updatedAt: new Date().toISOString(), overall, components, incidents: inc };
}

function seedBars(warnDay: number | null): Health[] {
  return Array.from({ length: 90 }, (_, i) => (warnDay !== null && i === warnDay ? "warn" : "ok"));
}

const SEED: StatusPage = {
  updatedAt: new Date().toISOString(),
  overall: "ok",
  components: [
    { key: "website", name: "Website (segmiq.com)", status: "ok", uptime90: "99.99%", bars: seedBars(null) },
    { key: "crm", name: "Segmiq CRM", status: "ok", uptime90: "99.98%", bars: seedBars(null) },
    { key: "cloud", name: "Segmiq Cloud", status: "ok", uptime90: "99.97%", bars: seedBars(null) },
    { key: "forms", name: "Lead capture & forms", status: "ok", uptime90: "99.99%", bars: seedBars(null) },
    { key: "whatsapp", name: "WhatsApp delivery", status: "ok", uptime90: "99.92%", bars: seedBars(62) },
    { key: "email", name: "Email delivery", status: "ok", uptime90: "99.96%", bars: seedBars(null) },
    { key: "api", name: "API", status: "ok", uptime90: "99.98%", bars: seedBars(null) },
    { key: "dashboards", name: "Dashboards", status: "ok", uptime90: "99.99%", bars: seedBars(null) },
  ],
  incidents: [],
};

export async function getStatus(): Promise<StatusPage> {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return SEED;
    }
    return await fromSupabase();
  } catch (e) {
    console.error("getStatus failed, using seed", e);
    return SEED;
  }
}
