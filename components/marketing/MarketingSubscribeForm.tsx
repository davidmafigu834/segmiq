"use client";

import { useRouter } from "next/navigation";
import { ML } from "@/lib/marketing-links";
import { m } from "@/components/marketing/marketingTheme";

/** Routes newsletter/status signup to the contact page until a list provider is wired. */
export default function MarketingSubscribeForm({
  subject,
  placeholder = "you@company.co.zw",
  className,
}: {
  subject: string;
  placeholder?: string;
  className?: string;
}) {
  const router = useRouter();

  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const email = new FormData(e.currentTarget).get("email");
        const q = email ? `?subject=${encodeURIComponent(subject)}&email=${encodeURIComponent(String(email))}` : "";
        router.push(`${ML.contact}${q}`);
      }}
    >
      <input
        name="email"
        type="email"
        required
        className={`flex-1 rounded-full bg-white/[0.04] border ${m.border} px-4 py-3 text-sm outline-none placeholder:text-white/40`}
        placeholder={placeholder}
      />
      <button
        type="submit"
        className="px-6 py-3 rounded-full bg-[#D4FF4F] text-black font-semibold hover:bg-[#c8f040] whitespace-nowrap"
      >
        Subscribe
      </button>
    </form>
  );
}
