"use client";

import { useEffect, useState } from "react";
import { Check, Zap, Building2, Rocket } from "lucide-react";
import { CloudAdminGate } from "@/app/cloud/components/CloudAdminGate";
import { CloudPage } from "@/app/cloud/components/CloudPage";
import { SkeletonBilling } from "@/app/cloud/components/SkeletonCard";

const SUPPORT_WHATSAPP = "27000000000"; // Replace with actual Segmiq support WhatsApp number (no + prefix)

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

  return (
    <CloudAdminGate>
    <CloudPage>
        {loading ? (
          <SkeletonBilling />
        ) : (
          <>
            <div className="cloud-card--ink cloud-card mb-6 p-5">
              <p className="cloud-section-label mb-1 text-white/45">Current plan</p>
              <p className="font-cloud-display text-[24px] capitalize text-white">{currentPlan}</p>
              <p className="mt-1 text-[12px] text-white/55">
                Your next billing date and invoice history will appear here.
              </p>
            </div>

            <div className="mb-5 flex items-center justify-center">
              <div className="cloud-card inline-flex overflow-hidden p-1">
                <button
                  type="button"
                  onClick={() => setAnnual(false)}
                  className={`h-9 rounded-[8px] px-4 text-[13px] font-bold transition-colors ${
                    !annual
                      ? "bg-[var(--cloud-ink)] text-[var(--cloud-accent)]"
                      : "text-[var(--cloud-text-secondary)]"
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setAnnual(true)}
                  className={`flex h-9 items-center gap-2 rounded-[8px] px-4 text-[13px] font-bold transition-colors ${
                    annual
                      ? "bg-[var(--cloud-ink)] text-[var(--cloud-accent)]"
                      : "text-[var(--cloud-text-secondary)]"
                  }`}
                >
                  Annual
                  <span className="rounded-full bg-[var(--cloud-accent)] px-2 py-0.5 text-[10px] font-bold text-[var(--cloud-ink)]">
                    Save
                  </span>
                </button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {PLANS.map((plan) => {
                const isActive = plan.id === currentPlan;
                const Icon = plan.icon;
                return (
                  <div
                    key={plan.id}
                    className={`cloud-card relative flex flex-col p-5 transition-all ${
                      isActive ? "ring-2 ring-[var(--cloud-accent)] ring-offset-2 ring-offset-[var(--cloud-bg)]" : ""
                    }`}
                  >
                    {isActive && (
                      <span className="absolute right-4 top-4 rounded-full bg-[var(--cloud-accent)] px-2 py-0.5 text-[11px] font-bold text-[var(--cloud-ink)]">
                        Current
                      </span>
                    )}
                    <div className="mb-4 flex items-center gap-2.5">
                      <Icon className={`h-5 w-5 ${plan.accent}`} strokeWidth={1.5} />
                      <span className="text-[15px] font-semibold text-[var(--cloud-text-primary)]">{plan.name}</span>
                    </div>
                    <div>
                      <span className="font-cloud-display text-[32px] text-[var(--cloud-text-primary)]">
                        ${annual ? Math.floor(plan.annualMonthly) : plan.monthlyPrice}
                      </span>
                      <span className="ml-1 text-[13px] text-[var(--cloud-text-secondary)]">/ mo</span>
                    </div>
                    <p className="mb-1 text-[12px] text-[var(--cloud-text-secondary)]">
                      {annual ? `$${plan.annualPrice}/yr · billed annually` : "billed monthly"}
                    </p>
                    {annual ? (
                      <p className="mb-4 text-[12px] font-bold text-[var(--cloud-text-secondary)]">
                        Save ${plan.saving}/yr
                      </p>
                    ) : (
                      <div className="mb-5" />
                    )}
                    <ul className="mb-6 flex-1 space-y-2">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-[13px] text-[var(--cloud-text-secondary)]">
                          <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[var(--cloud-text-primary)]" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    {!isActive && (
                      <a
                        href={`https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(`Hi, I'd like to upgrade my Segmiq Cloud account to the ${plan.name} plan (${annual ? `$${plan.annualPrice}/year` : `$${plan.monthlyPrice}/month`}, billed ${annual ? "annually" : "monthly"}). My account email is `)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`mt-auto block w-full rounded-[var(--cloud-radius-sm)] py-2.5 text-center text-[13px] font-semibold transition-colors ${
                          (PLAN_ORDER[plan.id] ?? 0) > (PLAN_ORDER[currentPlan] ?? 0)
                            ? "bg-[var(--cloud-ink)] text-[var(--cloud-accent)] hover:bg-[#161a22]"
                            : "border border-[var(--cloud-border)] bg-[var(--cloud-surface-muted)] text-[var(--cloud-text-secondary)] hover:bg-white"
                        }`}
                      >
                        {(PLAN_ORDER[plan.id] ?? 0) > (PLAN_ORDER[currentPlan] ?? 0) ? "Upgrade" : "Downgrade"} to {plan.name} · {annual ? `$${plan.annualPrice}/yr` : `$${plan.monthlyPrice}/mo`}
                      </a>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="cloud-card mt-6 p-5">
              <p className="cloud-section-label">Payment history</p>
              <p className="text-[13px] text-[var(--cloud-text-secondary)]">
                No payment history yet. Your invoices will appear here once billing is active.
              </p>
            </div>
          </>
        )}
    </CloudPage>
    </CloudAdminGate>
  );
}
