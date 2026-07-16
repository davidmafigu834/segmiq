import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Check, Sparkles } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { postLoginPath } from "@/lib/auth/post-login-redirect";
import { LoginForm } from "./LoginForm";

const HIGHLIGHTS = [
  "WhatsApp capture, AI scoring and daily coaching",
  "Agency, manager and rep portals in one workspace",
  "Every contact tracked from first touch to closed win",
];

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  if (session?.userId && session.clientId) {
    redirect(
      postLoginPath({
        role: session.role,
        clientMode: session.clientMode,
        clientId: session.clientId,
      })
    );
  }

  return (
    <div className="login-shell grid min-h-screen min-h-[100svh] bg-[#0C0C0C] lg:grid-cols-[1.08fr_0.92fr]">
      <aside className="relative hidden overflow-hidden border-r border-white/[0.06] lg:flex lg:flex-col lg:justify-between lg:p-10 xl:p-14">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(55% 45% at 10% 0%, rgba(212,255,79,0.16), transparent 58%), radial-gradient(45% 40% at 100% 100%, rgba(61,214,140,0.08), transparent 55%)",
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
          aria-hidden
        />

        <div className="relative flex items-center justify-between gap-4">
          <Link href="/" className="inline-flex transition-opacity hover:opacity-85">
            <Image
              src="/segmiq-wordmark.png"
              alt="Segmiq"
              width={150}
              height={26}
              className="h-6 w-auto"
              priority
            />
          </Link>
          <Link
            href="/"
            className="text-[12px] font-medium text-white/40 transition-colors hover:text-white/70"
          >
            segmiq.com
          </Link>
        </div>

        <div className="relative max-w-[520px]">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#D4FF4F]/20 bg-[#D4FF4F]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#D4FF4F]">
            <Sparkles className="h-3 w-3" aria-hidden />
            Revenue platform for service teams
          </div>

          <h2 className="mt-6 font-display text-[38px] leading-[1.06] tracking-tight text-white xl:text-[46px]">
            Sign in to the workspace your{" "}
            <span className="text-[#D4FF4F]">sales team</span> actually uses.
          </h2>

          <ul className="mt-8 space-y-3.5">
            {HIGHLIGHTS.map((h) => (
              <li key={h} className="flex items-start gap-3">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#D4FF4F] text-[#0A0B0D]">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                <span className="text-[14px] leading-relaxed text-white/55">{h}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center gap-3 text-[12px] text-white/35">
          <div className="flex -space-x-2">
            {["TM", "GN", "FK"].map((initials) => (
              <span
                key={initials}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#0C0C0C] bg-[#1a1a1a] text-[9px] font-bold text-white/70"
              >
                {initials}
              </span>
            ))}
          </div>
          <span>
            Trusted by agencies and service businesses across Africa
          </span>
        </div>
      </aside>

      <main className="relative flex items-center justify-center bg-[var(--bg-primary)] px-4 py-10 sm:px-8 lg:bg-[#0f0f0f]">
        <div
          className="pointer-events-none absolute inset-0 lg:hidden"
          style={{
            backgroundImage:
              "radial-gradient(70% 50% at 50% 0%, rgba(212,255,79,0.08), transparent 60%)",
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 hidden lg:block"
          style={{
            backgroundImage:
              "radial-gradient(60% 55% at 100% 0%, rgba(212,255,79,0.06), transparent 55%), radial-gradient(50% 40% at 0% 100%, rgba(255,255,255,0.03), transparent 50%)",
          }}
          aria-hidden
        />
        <LoginForm />
      </main>
    </div>
  );
}
