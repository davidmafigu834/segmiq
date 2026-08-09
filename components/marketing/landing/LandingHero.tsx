import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  MessageCircle,
  Play,
  Route,
  ShieldCheck,
  Target,
  UserRoundCheck,
  Zap,
} from "lucide-react";
import { ML } from "@/lib/marketing-links";

const timeline = [
  "Lead captured",
  "Confirmation sent",
  "Assigned to sales rep",
  "Qualified",
  "Quotation sent",
];

const outcomes = [
  {
    value: "9×",
    copy: "More likely to qualify when the first response is within five minutes.",
    icon: Zap,
  },
  {
    value: "0",
    copy: "Leads, history or relationships lost when a salesperson leaves.",
    icon: ShieldCheck,
  },
  {
    value: "1",
    copy: "System from first enquiry to recorded win.",
    icon: Target,
  },
];

export default function LandingHero() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-white/10 bg-[#0c0c0c]">
        <div
          aria-hidden
          className="pointer-events-none absolute left-[44%] top-20 h-[34rem] w-[34rem] rounded-full bg-[#d4ff4f]/[0.07] blur-[130px]"
        />
        <div className="mx-auto grid max-w-[1180px] items-center gap-12 px-5 pb-14 pt-14 sm:px-8 sm:pb-20 sm:pt-20 lg:min-h-[690px] lg:grid-cols-[0.88fr_1.12fr] lg:gap-10 lg:py-20">
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-white/70">
              <MessageCircle className="h-3.5 w-3.5 text-[#d4ff4f]" />
              WhatsApp-first CRM for African service businesses
            </div>
            <h1 className="mt-6 max-w-[570px] text-[42px] font-semibold leading-[0.98] tracking-[-0.045em] text-white sm:text-[58px] lg:text-[66px]">
              Revenue operating system for service businesses{" "}
              <span className="text-[#d4ff4f]">in Africa</span>
            </h1>
            <p className="mt-6 max-w-[480px] text-[15px] leading-7 text-white/60 sm:text-base">
              Capture every enquiry, respond fast, coach your sales team, and close more deals —
              all in one WhatsApp-first platform.
            </p>
            <div className="mt-8 flex flex-col gap-3 min-[390px]:flex-row">
              <Link
                href={ML.contact}
                className="group inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[#d4ff4f] px-5 text-sm font-semibold text-[#0c0c0c] transition-colors hover:bg-[#e2ff79]"
              >
                Book a demo
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <a
                href="#platform"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/[0.025] px-5 text-sm font-medium text-white transition-colors hover:bg-white/[0.07]"
              >
                See the platform <Play className="h-3.5 w-3.5" />
              </a>
            </div>
            <p className="mt-7 max-w-[490px] text-[12px] leading-5 text-white/40">
              Built for solar, construction, roofing, electrical, landscaping and real estate
              teams.
            </p>
          </div>

          <div className="relative min-h-[560px] lg:min-h-[600px]">
            {/* Temporary commissioned landing artwork; replace with an approved SegmiQ customer shoot. */}
            <div className="absolute inset-0 overflow-hidden rounded-[24px] border border-white/10 bg-[#151714] shadow-[0_32px_90px_rgba(0,0,0,0.5)]">
              <Image
                src="/marketing/segmiq-landing-hero.png"
                alt="African service-business professionals collaborating around a laptop and phones"
                fill
                priority
                className="object-cover object-[64%_center]"
                sizes="(max-width: 1023px) 100vw, 56vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/5 to-black/10" />
            </div>

            <div className="absolute inset-x-3 bottom-3 rounded-2xl border border-white/15 bg-[#0b0c0b]/95 p-4 shadow-2xl backdrop-blur-xl sm:inset-x-6 sm:bottom-6 sm:p-5 lg:left-[-34px] lg:right-4">
              <div className="flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#25d366]/10 text-[#4be37d]">
                    <MessageCircle className="h-[18px] w-[18px]" />
                  </span>
                  <div>
                    <h2 className="text-[13px] font-semibold">New WhatsApp lead</h2>
                    <p className="text-[10px] text-white/40">Captured moments ago</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/10 px-3 text-[10px] font-medium text-white/70 transition hover:bg-white/5">
                    <Clock3 className="h-3 w-3" /> View activity
                  </button>
                  <button className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#d4ff4f] px-3 text-[10px] font-semibold text-black transition hover:bg-[#e2ff79]">
                    <Route className="h-3 w-3" /> Route lead
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-[1.12fr_0.88fr]">
                <div>
                  <div className="flex items-start gap-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#684331] text-[10px] font-semibold">
                      TM
                    </div>
                    <div>
                      <div className="text-[12px] font-semibold">Thandiwe Mokoena</div>
                      <p className="mt-1 text-[10px] leading-4 text-white/50">
                        Hi, I need a quotation for a 5kW solar system.
                      </p>
                    </div>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-2 text-[9px]">
                    <div className="rounded-lg border border-white/[0.08] bg-white/[0.025] p-2.5">
                      <dt className="text-white/35">Source</dt>
                      <dd className="mt-1 flex items-center gap-1.5 font-medium text-white/80">
                        <MessageCircle className="h-3 w-3 text-[#4be37d]" /> WhatsApp
                      </dd>
                    </div>
                    <div className="rounded-lg border border-white/[0.08] bg-white/[0.025] p-2.5">
                      <dt className="text-white/35">Assigned team</dt>
                      <dd className="mt-1 flex items-center gap-1.5 font-medium text-white/80">
                        <UserRoundCheck className="h-3 w-3 text-[#d4ff4f]" /> Solar Sales
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="grid grid-cols-[88px_1fr] gap-3">
                  <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3 text-center">
                    <div className="text-[9px] text-white/35">Lead score</div>
                    <div className="mt-1 text-[32px] font-semibold leading-none text-[#d4ff4f]">82</div>
                    <div className="mt-1 text-[9px] font-medium text-white/75">High intent</div>
                  </div>
                  <ol className="space-y-1.5">
                    {timeline.map((event, index) => (
                      <li key={event} className="flex items-center gap-1.5 text-[8px] text-white/55">
                        <CheckCircle2
                          className={`h-3 w-3 shrink-0 ${
                            index < 4 ? "text-[#d4ff4f]" : "text-white/25"
                          }`}
                        />
                        {event}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section aria-label="SegmiQ outcomes" className="border-b border-white/10 bg-[#0d0e0c] px-5">
        <div className="mx-auto grid max-w-[1120px] divide-y divide-white/10 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {outcomes.map(({ value, copy, icon: Icon }) => (
            <div key={value} className="flex items-center gap-4 px-3 py-6 sm:px-6">
              <Icon aria-hidden className="h-5 w-5 shrink-0 text-[#d4ff4f]" />
              <strong className="text-[34px] font-semibold tracking-tight text-[#d4ff4f]">
                {value}
              </strong>
              <p className="text-[11px] leading-4 text-white/45">{copy}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
