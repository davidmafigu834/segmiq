"use client";

import { useFormState, useFormStatus } from "react-dom";
import { submitMarketingForm, type SubmitResult } from "@/app/(marketing)/contact/actions";

const MARKETS = ["Zimbabwe", "Zambia", "South Africa", "Kenya", "Other"];
const INDUSTRIES = ["Construction", "Solar", "Roofing", "Electrical", "Landscaping", "Other trade"];
const TEAM_SIZES = ["1–5 salespeople", "6–15 salespeople", "16+ salespeople"];
const VOLUMES = ["Under 50", "50–200", "200–500", "500+"];

const field = "w-full border border-black/[0.08] rounded-xl px-3.5 py-2.5 text-sm bg-white outline-none focus:border-black/35 transition-colors";
const label = "text-[13px] font-semibold mb-1.5 block";

function SubmitButton({ label: text }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="mt-5 w-full sm:w-auto px-7 py-3 rounded-full bg-[#D4FF4F] text-black font-semibold hover:bg-[#c8f040] disabled:opacity-60">
      {pending ? "Sending…" : text}
    </button>
  );
}

export default function ContactForm({
  type = "demo",
  source = "/contact",
  submitLabel = "Book my demo",
}: {
  type?: "demo" | "partner" | "career";
  source?: string;
  submitLabel?: string;
}) {
  const [state, action] = useFormState<SubmitResult | null, FormData>(submitMarketingForm, null);

  if (state?.ok) {
    return (
      <div className="rounded-2xl border border-black/[0.08] p-8 text-center">
        <div className="text-[20px] font-extrabold">Thanks — we&apos;ve got it.</div>
        <p className="mt-2 text-sm text-[#5b5b5b]">We&apos;ll reply on WhatsApp, usually within a working day.</p>
      </div>
    );
  }

  return (
    <form action={action} className="rounded-2xl border border-black/[0.08] p-6 sm:p-8">
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="source" value={source} />
      <input type="text" name="company_url" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

      <div className="grid sm:grid-cols-2 gap-4">
        <div><label className={label}>Full name</label><input name="name" required className={field} placeholder="Tendai Moyo" /></div>
        <div><label className={label}>Company</label><input name="company" className={field} placeholder="Your business" /></div>
        <div><label className={label}>Work email</label><input name="email" type="email" required className={field} placeholder="you@company.co.zw" /></div>
        <div><label className={label}>WhatsApp number</label><input name="phone" className={field} placeholder="+263 …" /></div>
        <div><label className={label}>Market</label><select name="market" className={field}>{MARKETS.map((m) => <option key={m}>{m}</option>)}</select></div>
        <div><label className={label}>Industry</label><select name="industry" className={field}>{INDUSTRIES.map((m) => <option key={m}>{m}</option>)}</select></div>
        <div><label className={label}>Sales team size</label><select name="teamSize" className={field}>{TEAM_SIZES.map((m) => <option key={m}>{m}</option>)}</select></div>
        <div><label className={label}>Roughly how many leads a month?</label><select name="leadVolume" className={field}>{VOLUMES.map((m) => <option key={m}>{m}</option>)}</select></div>
      </div>
      <div className="mt-4">
        <label className={label}>What are you hoping to fix?</label>
        <textarea name="message" rows={4} className={field} placeholder="e.g. leads come in on Facebook but we're slow to follow up, and quotes go cold." />
      </div>

      {state?.error && <p className="mt-3 text-sm text-[#cc2f2f]">{state.error}</p>}

      <SubmitButton label={submitLabel} />
      <p className="mt-3 text-xs text-[#8a8a8a]">We&apos;ll only use these details to contact you about Segmiq. No spam.</p>
    </form>
  );
}
