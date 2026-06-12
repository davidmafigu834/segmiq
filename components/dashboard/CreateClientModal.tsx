"use client";



import { useCallback, useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import { ChevronLeft, X } from "lucide-react";

import { CRM_PLANS } from "@/lib/onboarding/constants";



const PLAN_LABELS: Record<(typeof CRM_PLANS)[number], string> = {

  starter: "Starter",

  professional: "Professional",

  business: "Business",

};



export function CreateClientModal({ open, onClose }: { open: boolean; onClose: () => void }) {

  const router = useRouter();

  const [soloOperator, setSoloOperator] = useState(false);

  const [plan, setPlan] = useState<(typeof CRM_PLANS)[number]>("starter");

  const [ownerEmail, setOwnerEmail] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [success, setSuccess] = useState<string | null>(null);



  const reset = useCallback(() => {

    setSoloOperator(false);

    setPlan("starter");

    setOwnerEmail("");

    setError(null);

    setSuccess(null);

    setSubmitting(false);

  }, []);



  useEffect(() => {

    if (!open) {

      reset();

      return;

    }

    setError(null);

    setSuccess(null);

  }, [open, reset]);



  if (!open) return null;



  async function handleSubmit(e: React.FormEvent) {

    e.preventDefault();

    setError(null);

    setSuccess(null);



    if (!ownerEmail.trim()) {

      setError("Owner email is required.");

      return;

    }



    setSubmitting(true);

    try {

      const res = await fetch("/api/clients", {

        method: "POST",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify({

          mode: soloOperator ? "solo" : "team",

          plan,

          ownerEmail: ownerEmail.trim(),

        }),

      });

      const j = (await res.json().catch(() => ({}))) as {

        error?: string;

        client?: { id?: string };

        emailSent?: boolean;

      };

      if (!res.ok) {

        setError(typeof j.error === "string" ? j.error : "Could not create client");

        return;

      }

      const id = j.client?.id;

      if (!id) {

        setError("Created but no client id returned.");

        return;

      }

      setSuccess(

        j.emailSent

          ? "Onboarding link sent. The client can complete setup from their email."

          : "Client shell created, but the email failed to send. Resend the link from the client overview."

      );

      setTimeout(() => {

        onClose();

        reset();

        router.push(`/dashboard/clients/${id}`);

        router.refresh();

      }, 1200);

    } finally {

      setSubmitting(false);

    }

  }



  return (

    <div className="fixed inset-0 z-[60] flex flex-col bg-surface-overlay md:items-center md:justify-center md:px-4 md:py-8">

      <div className="flex h-full w-full flex-col border border-border bg-surface-card shadow-lg md:h-auto md:max-h-[90vh] md:max-w-lg md:rounded-lg">

        <header className="flex h-14 items-center gap-3 border-b border-border px-4 md:h-auto md:border-b-0 md:px-6 md:pt-6">

          <button type="button" className="flex h-9 w-9 items-center justify-center md:hidden" onClick={onClose} aria-label="Back">

            <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />

          </button>

          <h2 className="min-w-0 flex-1 truncate font-display text-xl text-ink-primary">New client</h2>

          <button

            type="button"

            className="hidden text-ink-tertiary hover:text-ink-primary md:block"

            onClick={onClose}

            aria-label="Close"

          >

            <X className="h-5 w-5" strokeWidth={1.5} />

          </button>

        </header>

        <form onSubmit={(e) => void handleSubmit(e)} className="flex min-h-0 flex-1 flex-col">

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-4 md:px-6 md:pt-2">

            <p className="mt-2 text-sm text-ink-secondary">

              Choose solo or team mode and plan, then send a self-serve onboarding link. The client completes

              company details, account setup, branding, and (for team) their sales roster.

            </p>

            <div className="mt-6 space-y-4">

              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface-card-alt px-4 py-3">

                <input

                  type="checkbox"

                  className="mt-1 h-4 w-4 accent-[var(--accent)]"

                  checked={soloOperator}

                  onChange={(e) => setSoloOperator(e.target.checked)}

                />

                <span>

                  <span className="block text-[13px] font-semibold text-ink-primary">Solo operator</span>

                  <span className="block text-[12px] text-ink-secondary">

                    One owner runs the whole business — no manager or sales team.

                  </span>

                </span>

              </label>



              <div>

                <label className="mb-1 block text-[12px] font-medium text-ink-secondary">Plan *</label>

                <select

                  className="input-base h-11 w-full text-base md:h-10 md:text-sm"

                  value={plan}

                  onChange={(e) => setPlan(e.target.value as (typeof CRM_PLANS)[number])}

                  required

                >

                  {CRM_PLANS.map((p) => (

                    <option key={p} value={p}>

                      {PLAN_LABELS[p]}

                    </option>

                  ))}

                </select>

              </div>



              <div>

                <label className="mb-1 block text-[12px] font-medium text-ink-secondary">Owner email *</label>

                <input

                  type="email"

                  className="input-base h-11 w-full text-base md:h-10 md:text-sm"

                  value={ownerEmail}

                  onChange={(e) => setOwnerEmail(e.target.value)}

                  required

                  autoFocus

                  placeholder="owner@company.com"

                />

                <p className="mt-1 text-xs text-ink-tertiary">

                  We&apos;ll email them a link to complete setup. They choose their password during onboarding.

                </p>

              </div>



              {error ? <p className="text-sm text-[var(--status-lost-fg)]">{error}</p> : null}

              {success ? <p className="text-sm text-[var(--success-fg)]">{success}</p> : null}

            </div>

          </div>

          <div className="safe-bottom mt-auto flex justify-end gap-2 border-t border-border p-4 md:px-6 md:pb-6">

            <button type="button" className="btn-ghost h-11 flex-1 md:h-9 md:flex-none" onClick={onClose} disabled={submitting}>

              Cancel

            </button>

            <button type="submit" className="btn-primary h-11 flex-1 md:h-9 md:flex-none" disabled={submitting}>

              {submitting ? "Sending…" : "Send onboarding link"}

            </button>

          </div>

        </form>

      </div>

    </div>

  );

}


