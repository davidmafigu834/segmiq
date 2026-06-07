import Image from "next/image";
import { Check } from "lucide-react";
import { LoginForm } from "./LoginForm";

const HIGHLIGHTS = [
  "WhatsApp lead capture, AI scoring & daily coaching",
  "Agency, manager and rep portals in one workspace",
  "Every lead tracked from first touch to closed win",
];

export default function LoginPage() {
  return (
    <div className="grid min-h-screen min-h-[100svh] bg-surface-canvas lg:grid-cols-[1.05fr_1fr]">
      {/* ── Brand panel (desktop only) ── */}
      <aside className="relative hidden overflow-hidden border-r border-border lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        {/* lime glow */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(60% 50% at 15% 0%, rgba(212,255,79,0.14), transparent 60%), radial-gradient(50% 50% at 100% 100%, rgba(212,255,79,0.06), transparent 55%)",
          }}
          aria-hidden
        />
        {/* dot grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
          aria-hidden
        />

        <div className="relative">
          <Image
            src="/segmiq-wordmark.png"
            alt="Segmiq"
            width={150}
            height={26}
            className="h-6 w-auto"
            priority
          />
        </div>

        <div className="relative max-w-[460px]">
          <h2 className="font-display text-[40px] leading-[1.08] tracking-tight text-[var(--text-on-dark)] xl:text-[48px]">
            The lead platform your sales team will actually use.
          </h2>
          <ul className="mt-9 space-y-4">
            {HIGHLIGHTS.map((h) => (
              <li key={h} className="flex items-start gap-3">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-[var(--accent-foreground)]">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                <span className="text-[15px] leading-relaxed text-[var(--text-secondary)]">{h}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative text-[13px] text-[var(--text-tertiary)]">
          © {new Date().getFullYear()} Segmiq · segmiq.com
        </div>
      </aside>

      {/* ── Form side ── */}
      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <LoginForm />
      </main>
    </div>
  );
}
