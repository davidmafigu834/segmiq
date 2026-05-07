"use client";

import { useEffect, useState } from "react";
import { Check, Zap, Building2, Rocket, Loader2 } from "lucide-react";

type Plan = { id: string; name: string; price: string; storage: string; features: string[]; icon: React.ElementType; accent: string };

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    storage: "5 GB",
    icon: Zap,
    accent: "text-white/50",
    features: ["5 GB storage", "10 projects", "Public portfolio page", "Project share links", "1 team member"],
  },
  {
    id: "professional",
    name: "Professional",
    price: "$29",
    storage: "50 GB",
    icon: Rocket,
    accent: "text-[#D4FF4F]",
    features: ["50 GB storage", "Unlimited projects", "Logo watermarking", "Priority support", "5 team members", "Analytics"],
  },
  {
    id: "business",
    name: "Business",
    price: "$79",
    storage: "200 GB",
    icon: Building2,
    accent: "text-blue-400",
    features: ["200 GB storage", "Unlimited projects & team", "Custom domain", "White-label portfolio", "Advanced analytics", "Dedicated support"],
  },
];

export default function BillingPage() {
  const [currentPlan, setCurrentPlan] = useState<string>("free");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/cloud/storage/usage")
      .then((r) => r.json())
      .then((d: { plan?: string }) => setCurrentPlan(d.plan ?? "free"))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="px-6 py-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <h1 className="text-[15px] font-semibold text-white">Billing</h1>
          <p className="mt-1 text-[13px] text-white/40">
            Manage your plan and storage.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-5 w-5 animate-spin text-white/30" />
          </div>
        ) : (
          <>
            {currentPlan !== "free" && (
              <div className="mb-8 rounded-2xl border border-white/[0.08] bg-[#111] p-6">
                <p className="mb-1 text-[12px] font-medium uppercase tracking-wide text-white/40">Current plan</p>
                <p className="text-[20px] font-semibold text-white capitalize">{currentPlan}</p>
                <p className="mt-1 text-[13px] text-white/40">Your next billing date and invoice history will appear here.</p>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              {PLANS.map((plan) => {
                const isActive = plan.id === currentPlan;
                const Icon = plan.icon;
                return (
                  <div
                    key={plan.id}
                    className={`relative flex flex-col rounded-2xl border p-5 transition-all ${
                      isActive
                        ? "border-[#D4FF4F]/30 bg-[#D4FF4F]/5"
                        : "border-white/[0.08] bg-[#111]"
                    }`}
                  >
                    {isActive && (
                      <span className="absolute right-4 top-4 rounded-full bg-[#D4FF4F] px-2 py-0.5 text-[11px] font-bold text-black">
                        Current
                      </span>
                    )}
                    <div className="mb-4 flex items-center gap-2.5">
                      <Icon className={`h-5 w-5 ${plan.accent}`} strokeWidth={1.5} />
                      <span className="text-[15px] font-semibold text-white">{plan.name}</span>
                    </div>
                    <div className="mb-5">
                      <span className="text-[28px] font-bold text-white">{plan.price}</span>
                      {plan.id !== "free" && <span className="ml-1 text-[13px] text-white/40">/ mo</span>}
                    </div>
                    <ul className="mb-6 flex-1 space-y-2">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-[13px] text-white/60">
                          <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[#D4FF4F]" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    {!isActive && (
                      <button
                        disabled
                        className="mt-auto w-full rounded-xl border border-white/10 py-2.5 text-[13px] font-medium text-white/50 hover:bg-white/5 transition-colors disabled:cursor-not-allowed"
                        title="Billing coming soon"
                      >
                        {plan.id === "free" ? "Downgrade" : "Upgrade"} — coming soon
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-8 rounded-2xl border border-white/[0.06] bg-[#111] p-5">
              <p className="text-[13px] font-medium text-white/60 mb-1">Payment history</p>
              <p className="text-[13px] text-white/30">No payment history yet. Your invoices will appear here once billing is active.</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
