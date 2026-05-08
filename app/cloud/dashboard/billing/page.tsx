"use client";

import { useEffect, useState } from "react";
import { Check, Zap, Building2, Rocket, Loader2 } from "lucide-react";

type Plan = { id: string; name: string; price: string; storage: string; features: string[]; icon: React.ElementType; accent: string };

const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    price: "$20",
    storage: "20 GB",
    icon: Zap,
    accent: "text-[#666660]",
    features: ["Unlimited projects", "Public share links", "Basic watermarking", "Public profile page", "Mobile PWA app", "Up to 3 members"],
  },
  {
    id: "professional",
    name: "Professional",
    price: "$49",
    storage: "100 GB",
    icon: Rocket,
    accent: "text-[#3D7A00]",
    features: ["Everything in Starter", "Custom logo watermark", "Project analytics", "AI photo enhancement", "Priority support", "Up to 10 members"],
  },
  {
    id: "business",
    name: "Business",
    price: "$99",
    storage: "500 GB",
    icon: Building2,
    accent: "text-[#1A4A7A]",
    features: ["Everything in Professional", "Custom domain", "Video URL embeds", "Testimonials manager", "CSV data export", "Unlimited members"],
  },
];

const PLAN_ORDER: Record<string, number> = { starter: 0, professional: 1, business: 2 };

export default function BillingPage() {
  const [currentPlan, setCurrentPlan] = useState<string>("starter");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/cloud/storage/usage")
      .then((r) => r.json())
      .then((d: { plan?: string }) => { const raw = d.plan ?? "starter"; setCurrentPlan(raw === "free" ? "starter" : raw); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const planCardStyles: Record<string, { gradient: string; border: string; text: string; subtext: string; checkColor: string }> = {
    starter:      { gradient: "bg-gradient-to-br from-[#F8F8F4] via-[#F0F0EA] to-[#E8E8E0]", border: "border-[#D0D0C0]/40", text: "text-[#0a0a0a]", subtext: "text-[#666660]", checkColor: "text-[#666660]" },
    professional: { gradient: "bg-gradient-to-br from-[#F8FFF0] via-[#EFFFDC] to-[#DCFFB8]", border: "border-[#B8F060]/40", text: "text-[#1A3D00]", subtext: "text-[#3D7A00]", checkColor: "text-[#3D7A00]" },
    business:     { gradient: "bg-gradient-to-br from-[#F0F8FF] via-[#DCF0FF] to-[#C4E4FF]", border: "border-[#7BC8FF]/40", text: "text-[#001A3D]", subtext: "text-[#1A4A7A]", checkColor: "text-[#1A4A7A]" },
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0] font-cloud-body px-5 py-4 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <p className="font-cloud-display text-[22px] text-[#0a0a0a]">Billing</p>
          <p className="mt-0.5 text-[13px] text-[#999990] font-cloud-body">Manage your plan and storage.</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-5 w-5 animate-spin text-[#0a0a0a]/20" />
          </div>
        ) : (
          <>
            {(
              <div className="mb-6 rounded-[20px] border border-[#D0D0C0]/40 bg-gradient-to-br from-[#F8F8F4] via-[#F0F0EA] to-[#E8E8E0] p-5">
                <p className="mb-0.5 text-[10px] font-bold tracking-[0.08em] text-[#999990] uppercase font-cloud-body">Current plan</p>
                <p className="font-cloud-display text-[20px] text-[#0a0a0a] capitalize">{currentPlan}</p>
                <p className="mt-1 text-[12px] text-[#999990] font-cloud-body">Your next billing date and invoice history will appear here.</p>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              {PLANS.map((plan) => {
                const isActive = plan.id === currentPlan;
                const Icon = plan.icon;
                const s = planCardStyles[plan.id] ?? planCardStyles.starter;
                return (
                  <div
                    key={plan.id}
                    className={`relative flex flex-col rounded-[20px] border p-5 transition-all ${s.gradient} ${s.border} ${isActive ? "ring-2 ring-[#D4FF4F] ring-offset-2 ring-offset-[#F5F5F0]" : ""}`}
                  >
                    {isActive && (
                      <span className="absolute right-4 top-4 rounded-full bg-[#D4FF4F] px-2 py-0.5 text-[11px] font-bold text-black font-cloud-body">
                        Current
                      </span>
                    )}
                    <div className="mb-4 flex items-center gap-2.5">
                      <Icon className={`h-5 w-5 ${plan.accent}`} strokeWidth={1.5} />
                      <span className={`text-[15px] font-semibold font-cloud-body ${s.text}`}>{plan.name}</span>
                    </div>
                    <div className="mb-5">
                      <span className={`font-cloud-display text-[32px] ${s.text}`}>{plan.price}</span>
                      <span className={`ml-1 text-[13px] font-cloud-body ${s.subtext}`}>/ mo</span>
                    </div>
                    <ul className="mb-6 flex-1 space-y-2">
                      {plan.features.map((f) => (
                        <li key={f} className={`flex items-start gap-2 text-[13px] font-cloud-body ${s.subtext}`}>
                          <Check className={`mt-0.5 h-3.5 w-3.5 flex-shrink-0 ${s.checkColor}`} />
                          {f}
                        </li>
                      ))}
                    </ul>
                    {!isActive && (
                      <button
                        disabled
                        className="mt-auto w-full rounded-xl border border-black/[0.1] bg-white/50 py-2.5 text-[13px] font-semibold text-[#999990] transition-colors disabled:cursor-not-allowed font-cloud-body"
                        title="Billing coming soon"
                      >
                        {(PLAN_ORDER[plan.id] ?? 0) > (PLAN_ORDER[currentPlan] ?? 0) ? "Upgrade" : "Downgrade"} — coming soon
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-6 rounded-[20px] border border-[#D0D0C0]/40 bg-gradient-to-br from-[#F8F8F4] via-[#F0F0EA] to-[#E8E8E0] p-5">
              <p className="text-[12px] font-bold text-[#666660] tracking-[0.06em] uppercase mb-1 font-cloud-body">Payment history</p>
              <p className="text-[13px] text-[#999990] font-cloud-body">No payment history yet. Your invoices will appear here once billing is active.</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
