"use client";

import { useEffect, useState } from "react";
import { Check, Zap, Building2, Rocket, Loader2 } from "lucide-react";

const SUPPORT_WHATSAPP = "27000000000"; // Replace with actual Leadstaq support WhatsApp number (no + prefix)

type Plan = { id: string; name: string; monthlyPrice: number; annualPrice: number; annualMonthly: number; saving: number; storage: string; team: string; features: string[]; icon: React.ElementType; accent: string };

const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    monthlyPrice: 20, annualPrice: 200, annualMonthly: 16.67, saving: 40,
    storage: "50 GB", team: "Up to 3 members",
    icon: Zap,
    accent: "text-[#666660]",
    features: ["Unlimited projects", "Public share links", "Basic watermarking", "Public profile page", "Mobile PWA app", "Up to 3 members"],
  },
  {
    id: "professional",
    name: "Professional",
    monthlyPrice: 49, annualPrice: 490, annualMonthly: 40.83, saving: 98,
    storage: "200 GB", team: "Up to 10 members",
    icon: Rocket,
    accent: "text-[#3D7A00]",
    features: ["Everything in Starter", "Custom logo watermark", "Project analytics", "AI photo enhancement", "Priority support", "Up to 10 members"],
  },
  {
    id: "business",
    name: "Business",
    monthlyPrice: 99, annualPrice: 990, annualMonthly: 82.50, saving: 198,
    storage: "1 TB", team: "Unlimited members",
    icon: Building2,
    accent: "text-[#1A4A7A]",
    features: ["Everything in Professional", "Custom domain", "Video URL embeds", "Testimonials manager", "CSV data export", "Unlimited members"],
  },
];

const PLAN_ORDER: Record<string, number> = { starter: 0, professional: 1, business: 2 };

export default function BillingPage() {
  const [currentPlan, setCurrentPlan] = useState<string>("starter");
  const [loading, setLoading] = useState(true);
  const [annual, setAnnual] = useState(false);

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

            <div className="mb-5 flex items-center justify-center">
              <button
                onClick={() => setAnnual(false)}
                style={{ height: 40, padding: "0 20px", background: !annual ? "#1C1410" : "#FFFFFF", color: !annual ? "#D4FF4F" : "#8C7B6B", border: "0.5px solid rgba(28,20,16,0.12)", borderRight: "none", borderRadius: "10px 0 0 10px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                className="font-cloud-body"
              >
                Monthly
              </button>
              <button
                onClick={() => setAnnual(true)}
                style={{ height: 40, padding: "0 20px", background: annual ? "#1C1410" : "#FFFFFF", color: annual ? "#D4FF4F" : "#8C7B6B", border: "0.5px solid rgba(28,20,16,0.12)", borderRadius: "0 10px 10px 0", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
                className="font-cloud-body"
              >
                Annual
                <span style={{ background: "#D4FF4F", color: "#1C1410", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, letterSpacing: "0.04em" }} className="font-cloud-body">
                  2 months free
                </span>
              </button>
            </div>
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
                    <div className="mb-0">
                      <span className={`font-cloud-display text-[32px] ${s.text}`}>
                        ${annual ? Math.floor(plan.annualMonthly) : plan.monthlyPrice}
                      </span>
                      <span className={`ml-1 text-[13px] font-cloud-body ${s.subtext}`}>/ mo</span>
                    </div>
                    <p className={`mb-1 text-[12px] font-cloud-body ${s.subtext}`}>
                      {annual ? `$${plan.annualPrice}/yr · billed annually` : "billed monthly"}
                    </p>
                    {annual ? (
                      <p className={`mb-4 text-[12px] font-bold font-cloud-body ${s.subtext}`}>
                        Save ${plan.saving}/yr
                      </p>
                    ) : (
                      <div className="mb-5" />
                    )}
                    <ul className="mb-6 flex-1 space-y-2">
                      {plan.features.map((f) => (
                        <li key={f} className={`flex items-start gap-2 text-[13px] font-cloud-body ${s.subtext}`}>
                          <Check className={`mt-0.5 h-3.5 w-3.5 flex-shrink-0 ${s.checkColor}`} />
                          {f}
                        </li>
                      ))}
                    </ul>
                    {!isActive && (
                      <a
                        href={`https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(`Hi, I'd like to upgrade my Leadstaq Cloud account to the ${plan.name} plan (${annual ? `$${plan.annualPrice}/year` : `$${plan.monthlyPrice}/month`}, billed ${annual ? "annually" : "monthly"}). My account email is `)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`mt-auto block w-full rounded-xl py-2.5 text-center text-[13px] font-semibold font-cloud-body transition-colors ${
                          (PLAN_ORDER[plan.id] ?? 0) > (PLAN_ORDER[currentPlan] ?? 0)
                            ? "bg-[#1C1410] text-[#D4FF4F] hover:bg-[#2C2418]"
                            : "border border-black/[0.1] bg-white/50 text-[#999990] hover:bg-white"
                        }`}
                      >
                        {(PLAN_ORDER[plan.id] ?? 0) > (PLAN_ORDER[currentPlan] ?? 0) ? "Upgrade" : "Downgrade"} to {plan.name} · {annual ? `$${plan.annualPrice}/yr` : `$${plan.monthlyPrice}/mo`}
                      </a>
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
