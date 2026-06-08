import { Rocket, Heart, Globe, Sparkles, Code, TrendingUp, Headphones, Megaphone, MapPin, ArrowRight, type LucideIcon } from "lucide-react";
import JsonLd from "@/components/seo/JsonLd";
import { breadcrumbLd, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Careers",
  description: "Help construction, solar, roofing, electrical, and landscaping businesses across Africa win more work. Join a small team doing serious work.",
  path: "/careers",
});

const VALUES: { Icon: LucideIcon; t: string; d: string }[] = [
  { Icon: Rocket, t: "Ship and learn", d: "Small team, short feedback loops. We get things in front of real businesses fast and improve from what we see." },
  { Icon: Heart, t: "Customer-obsessed", d: "We talk to trade owners constantly. The roadmap comes from their pipeline, not our guesses." },
  { Icon: Globe, t: "Built for Africa", d: "We design for our markets first — WhatsApp-first, slow-data friendly, real local context." },
  { Icon: Sparkles, t: "Ownership", d: "You own real problems end to end. Less process, more impact." },
];

const ROLES: { Icon: LucideIcon; title: string; team: string; location: string; type: string }[] = [
  { Icon: Code, title: "Founding Full-stack Engineer", team: "Engineering", location: "Harare or Remote (Africa)", type: "Full-time" },
  { Icon: TrendingUp, title: "Sales Lead", team: "Sales", location: "Harare", type: "Full-time" },
  { Icon: Headphones, title: "Customer Success & Onboarding", team: "Customer", location: "Remote (Africa)", type: "Full-time" },
  { Icon: Megaphone, title: "Performance Marketer (Meta Ads)", team: "Marketing", location: "Remote (Africa)", type: "Full-time" },
  { Icon: Sparkles, title: "Content & Brand", team: "Marketing", location: "Remote (Africa)", type: "Contract" },
];

const HIRE = [
  ["Apply", "Send your CV or a link to your work. A few lines on why this matters to you goes a long way."],
  ["Intro call", "A relaxed 20–30 minute chat to get to know each other and the role."],
  ["Practical task", "A short, paid, real-world task — closer to the actual job than a whiteboard puzzle."],
  ["Meet the team & offer", "Meet who you'd work with, ask anything, and if it fits, we move quickly."],
];

export default function CareersPage() {
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Careers", path: "/careers" }])} />
      <section className="pt-16 pb-12">
        <div className="mx-auto max-w-[1100px] px-5 max-w-[760px]">
          <div className="text-xs tracking-widest font-semibold text-[#8a8a8a]">CAREERS</div>
          <h1 className="mt-3 text-[38px] sm:text-[50px] leading-[1.06] font-extrabold tracking-tight">Build the revenue system for African trade</h1>
          <p className="mt-5 text-base text-[#5b5b5b] max-w-[560px]">We help construction, solar, roofing, electrical, and landscaping businesses across Africa win more work. It&apos;s a small team doing serious work for real businesses — and we&apos;re growing.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#roles" className="px-6 py-3 rounded-full bg-[#D4FF4F] text-black font-semibold hover:bg-[#c8f040]">See open roles</a>
            <a href="#life" className="px-6 py-3 rounded-full border border-black/[0.08] font-semibold hover:border-black/30">What it&apos;s like</a>
          </div>
        </div>
      </section>

      <section id="life" className="py-12 bg-[#F8F7F4]">
        <div className="mx-auto max-w-[1100px] px-5">
          <h2 className="text-[26px] font-extrabold">What it&apos;s like here</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
            {VALUES.map(({ Icon, t, d }) => (
              <div key={t} className="rounded-2xl bg-white border border-black/[0.08] p-5 transition-transform duration-300 hover:-translate-y-1">
                <span className="grid place-items-center w-11 h-11 rounded-xl bg-[#0C0C0C] text-[#D4FF4F] mb-4"><Icon className="w-[22px] h-[22px]" /></span>
                <div className="font-semibold">{t}</div>
                <p className="text-sm text-[#5b5b5b] mt-1">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="roles" className="py-14">
        <div className="mx-auto max-w-[1100px] px-5">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <h2 className="text-[26px] font-extrabold">Open roles</h2>
            <p className="text-[13px] text-[#8a8a8a]">Sample openings — update as you hire.</p>
          </div>
          <div className="mt-7 rounded-2xl border border-black/[0.08] divide-y divide-black/[0.08]">
            {ROLES.map(({ Icon, title, team, location, type }) => (
              <a key={title} href="mailto:careers@segmiq.com" className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 hover:bg-[#F8F7F4] transition-colors">
                <div className="flex items-center gap-3">
                  <span className="grid place-items-center w-10 h-10 rounded-xl bg-[#0C0C0C] text-[#D4FF4F] shrink-0"><Icon className="w-5 h-5" /></span>
                  <div>
                    <div className="font-semibold">{title}</div>
                    <div className="text-[13px] text-[#8a8a8a]">{team}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs border border-black/[0.08] rounded-full px-2.5 py-1 inline-flex items-center gap-1 text-[#5b5b5b]"><MapPin className="w-[13px] h-[13px]" /> {location}</span>
                  <span className="text-xs border border-black/[0.08] rounded-full px-2.5 py-1 text-[#5b5b5b]">{type}</span>
                  <ArrowRight className="w-[18px] h-[18px] text-[#D4FF4F]" />
                </div>
              </a>
            ))}
          </div>
          <div className="mt-6 rounded-2xl bg-[#0C0C0C] text-white p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="font-semibold">Don&apos;t see your role?</div>
              <p className="text-sm text-white/70 mt-0.5">If you&apos;re great at what you do and care about this market, get in touch anyway.</p>
            </div>
            <a href="mailto:careers@segmiq.com" className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#D4FF4F] text-black font-semibold hover:bg-[#c8f040]">careers@segmiq.com</a>
          </div>
        </div>
      </section>

      <section className="py-14 bg-[#F8F7F4]">
        <div className="mx-auto max-w-[1100px] px-5">
          <h2 className="text-[26px] font-extrabold text-center">How we hire</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-9">
            {HIRE.map(([t, d], i) => (
              <div key={t} className="rounded-2xl bg-white border border-black/[0.08] p-6">
                <div className="text-[28px] font-extrabold leading-none text-[#9bbf2e]">{i + 1}</div>
                <div className="mt-3 font-semibold">{t}</div>
                <p className="text-sm text-[#5b5b5b] mt-1">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-[1100px] px-5">
          <div className="rounded-3xl bg-[#D4FF4F] p-10 md:p-14 text-center">
            <h2 className="text-[32px] md:text-[40px] font-extrabold leading-[1.08] text-black max-w-[680px] mx-auto">Do the best work of your career</h2>
            <p className="mt-3 text-[15px] text-black/70 max-w-[520px] mx-auto">Close to customers, fast-moving, and building something that matters for businesses across the continent.</p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <a href="#roles" className="px-6 py-3 rounded-full bg-black text-[#D4FF4F] font-semibold hover:opacity-90">See open roles</a>
              <a href="mailto:careers@segmiq.com" className="px-6 py-3 rounded-full border border-black/25 text-black font-semibold hover:bg-black/5">Email us</a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
