import { CheckCircle2, AlertTriangle, XCircle, Bell } from "lucide-react";
import JsonLd from "@/components/seo/JsonLd";
import { getStatus, type Health } from "@/lib/status";
import { breadcrumbLd, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Status",
  description: "Live status of Segmiq services.",
  path: "/status",
});

export const revalidate = 60;

const OVERALL: Record<Health, { label: string; color: string; bg: string; border: string }> = {
  ok: { label: "All systems operational", color: "#1f9d5a", bg: "#eaf7ef", border: "rgba(31,157,90,.25)" },
  warn: { label: "Degraded performance", color: "#b3791a", bg: "#fbf3e3", border: "rgba(179,121,26,.25)" },
  err: { label: "Service disruption", color: "#cc2f2f", bg: "#fbecec", border: "rgba(204,47,47,.25)" },
};

const PILL: Record<Health, { label: string; color: string; bg: string }> = {
  ok: { label: "Operational", color: "#1f9d5a", bg: "rgba(31,157,90,.10)" },
  warn: { label: "Degraded", color: "#b3791a", bg: "rgba(230,179,77,.14)" },
  err: { label: "Outage", color: "#cc2f2f", bg: "rgba(224,122,122,.14)" },
};

const BAR: Record<Health, string> = { ok: "#1f9d5a", warn: "#e6b34d", err: "#e07a7a" };

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default async function StatusPage() {
  const s = await getStatus();
  const o = OVERALL[s.overall];
  const OverallIcon = s.overall === "ok" ? CheckCircle2 : s.overall === "warn" ? AlertTriangle : XCircle;
  const activeIncidents = s.incidents.filter((it) => !it.resolvedAt);

  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Status", path: "/status" }])} />
      <section className="pt-14 pb-6">
        <div className="mx-auto max-w-[1100px] px-5 max-w-[880px]">
          <div className="text-xs tracking-widest font-semibold text-[#8a8a8a]">SYSTEM STATUS</div>
          <h1 className="mt-3 text-[34px] sm:text-[42px] leading-[1.06] font-extrabold tracking-tight">Segmiq status</h1>
          <div className="mt-6 rounded-2xl border p-5 flex items-center gap-3" style={{ background: o.bg, borderColor: o.border }}>
            <OverallIcon className="w-6 h-6" style={{ color: o.color }} />
            <div>
              <div className="font-semibold" style={{ color: o.color }}>{o.label}</div>
              <div className="text-[13px] text-[#5b5b5b]">As of {fmt(s.updatedAt)}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="pb-12">
        <div className="mx-auto max-w-[1100px] px-5 max-w-[880px]">
          <div className="flex items-center justify-between">
            <h2 className="text-[18px] font-bold">Current status by component</h2>
            <div className="hidden sm:flex items-center gap-3 text-[12px] text-[#8a8a8a]">
              <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ background: BAR.ok }} /> Operational</span>
              <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ background: BAR.warn }} /> Degraded</span>
              <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ background: BAR.err }} /> Outage</span>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-black/[0.08] divide-y divide-black/[0.08]">
            {s.components.map((c) => {
              const p = PILL[c.status];
              return (
                <div key={c.key} className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium">{c.name}</div>
                    <span className="text-xs font-semibold rounded-full px-2.5 py-1" style={{ color: p.color, background: p.bg }}>{p.label}</span>
                  </div>
                  <div className="mt-3 flex items-end gap-[2px]">
                    {c.bars.map((b, i) => (
                      <span key={i} className="flex-1 min-w-[2px] h-7 rounded-[2px]" style={{ background: BAR[b] }} />
                    ))}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-[#8a8a8a]">
                    <span>90 days ago</span><span>{c.uptime90} uptime</span><span>Today</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="pb-12">
        <div className="mx-auto max-w-[1100px] px-5 max-w-[880px]">
          <h2 className="text-[18px] font-bold">Past incidents</h2>
          <div className="mt-5 space-y-4">
            {activeIncidents.length === 0 && s.incidents.length === 0 && (
              <div className="rounded-2xl border border-black/[0.08] p-5">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: BAR.ok }} />
                  <div className="font-semibold">No incidents reported</div>
                </div>
                <div className="text-[12px] text-[#8a8a8a] mt-0.5 ml-[18px]">Today</div>
                <p className="text-sm text-[#5b5b5b] mt-2 ml-[18px]">All components are operating normally.</p>
              </div>
            )}
            {s.incidents.map((it) => (
              <div key={it.id} className="rounded-2xl border border-black/[0.08] p-5">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#9aa0a6]" />
                  <div className="font-semibold">{it.title}</div>
                </div>
                <div className="text-[12px] text-[#8a8a8a] mt-0.5 ml-[18px]">
                  {fmt(it.startedAt)}{it.resolvedAt ? " · resolved" : " · ongoing"}
                </div>
                <p className="text-sm text-[#5b5b5b] mt-2 ml-[18px]">{it.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pb-20">
        <div className="mx-auto max-w-[1100px] px-5 max-w-[880px]">
          <div className="rounded-2xl bg-[#0C0C0C] text-white p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid place-items-center w-10 h-10 rounded-lg bg-[#181818] text-[#D4FF4F]"><Bell className="w-5 h-5" /></span>
              <div>
                <div className="font-semibold">Get status updates</div>
                <p className="text-[13px] text-white/70">Be notified if a component goes down or comes back.</p>
              </div>
            </div>
            <form className="flex gap-2 w-full sm:w-auto">
              <input type="email" className="flex-1 sm:w-[220px] rounded-full bg-[#181818] border border-white/10 px-4 py-2.5 text-sm outline-none placeholder:text-white/40" placeholder="you@company.co.zw" />
              <button type="submit" className="px-5 py-2.5 rounded-full bg-[#D4FF4F] text-black font-semibold hover:bg-[#c8f040] whitespace-nowrap">Subscribe</button>
            </form>
          </div>
        </div>
      </section>
    </>
  );
}
