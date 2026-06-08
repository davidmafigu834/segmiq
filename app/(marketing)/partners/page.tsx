import { Percent, Building2, GraduationCap, LayoutDashboard, Megaphone, Headphones, Layers, Globe, MessageCircle, type LucideIcon } from "lucide-react";
import ContactForm from "@/components/marketing/ContactForm";
import JsonLd from "@/components/seo/JsonLd";
import { breadcrumbLd, pageMetadata } from "@/lib/seo";
import { m } from "@/components/marketing/marketingTheme";

export const metadata = pageMetadata({
  title: "Become a partner",
  description: "Partner with Segmiq to bring construction, solar, roofing, electrical, and landscaping businesses a system that captures and closes their leads — and earn recurring commission.",
  path: "/partners",
});

type Card = { Icon: LucideIcon; t: string; d: string };

const TYPES: Card[] = [
  { Icon: Percent, t: "Referral partner", d: "Send trade businesses our way and earn an ongoing recurring commission on every one that signs. Lightest-touch way to start." },
  { Icon: Building2, t: "Agency partner", d: "Run clients on Segmiq as part of your own service. Manage them from the agency portal, bundle it with your work, and keep the margin." },
  { Icon: GraduationCap, t: "Solution partner", d: "Onboard and support clients on Segmiq directly. Get certified, take on implementation, and grow a services line around the platform." },
];

const PERKS: Card[] = [
  { Icon: Percent, t: "Recurring commission", d: "Earn on every client you bring, for as long as they stay — not a one-off finder fee." },
  { Icon: LayoutDashboard, t: "A partner view", d: "See your clients and their health from the agency portal, in one place." },
  { Icon: GraduationCap, t: "Training & certification", d: "Learn the platform and the sales playbook so you can pitch and onboard with confidence." },
  { Icon: Megaphone, t: "Co-marketing", d: "Joint campaigns, ad templates, and content built for African trade verticals." },
  { Icon: Layers, t: "Two products to sell", d: "Segmiq CRM and Segmiq Cloud — more ways to add value to each client." },
  { Icon: Headphones, t: "Priority support", d: "A direct line for you and your clients when it matters." },
];

const STEPS = [
  ["Apply", "Tell us about your business and the clients you serve."],
  ["Onboard & train", "Get access, learn the platform, and pick your partner track."],
  ["Add clients", "Bring trade businesses onto Segmiq — we help you onboard them."],
  ["Earn recurring", "Get paid an ongoing commission for every client that stays."],
];

const WHY: { Icon: LucideIcon; t: string }[] = [
  { Icon: Globe, t: "Built for Africa — Zimbabwe, Zambia, South Africa, Kenya" },
  { Icon: MessageCircle, t: "WhatsApp-first, the way trade clients actually communicate" },
  { Icon: Percent, t: "Lead generation included — we bring clients customers, not just a tool" },
  { Icon: Layers, t: "Two products covering the full journey, enquiry to documented work" },
];

export default function PartnersPage() {
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Partners", path: "/partners" }])} />
      <section className="pt-16 pb-12">
        <div className="mx-auto max-w-[1100px] px-5 max-w-[760px]">
          <div className={m.kicker}>PARTNER PROGRAM</div>
          <h1 className="mt-3 text-[38px] sm:text-[50px] leading-[1.06] font-extrabold tracking-tight">Grow a recurring revenue line with Segmiq</h1>
          <p className={`mt-5 text-base ${m.muted} max-w-[560px]`}>If you work with construction, solar, roofing, electrical, or landscaping businesses across Africa, partner with Segmiq to bring them a system that captures and closes their leads — and earn on every client you bring.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#apply" className="px-6 py-3 rounded-full bg-[#D4FF4F] text-black font-semibold hover:bg-[#c8f040]">Apply to partner</a>
            <a href="#how" className={`px-6 py-3 ${m.ghostBtn}`}>How it works</a>
          </div>
        </div>
      </section>

      <section className="pb-4">
        <div className="mx-auto max-w-[1100px] px-5">
          <h2 className="text-[26px] font-extrabold">Three ways to partner</h2>
          <div className="grid md:grid-cols-3 gap-4 mt-8">
            {TYPES.map(({ Icon, t, d }) => (
              <div key={t} className={`${m.cardHover} p-6`}>
                <span className="grid place-items-center w-11 h-11 rounded-xl bg-[#0C0C0C] text-[#D4FF4F] mb-4"><Icon className="w-[22px] h-[22px]" /></span>
                <div className="font-semibold text-[17px]">{t}</div>
                <p className={`text-sm ${m.muted} mt-1.5`}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14">
        <div className="mx-auto max-w-[1100px] px-5">
          <h2 className="text-[26px] font-extrabold text-center">What partners get</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-9">
            {PERKS.map(({ Icon, t, d }) => (
              <div key={t} className={`${m.cardHover} p-5`}>
                <span className="grid place-items-center w-11 h-11 rounded-xl bg-[#0C0C0C] text-[#D4FF4F] mb-4"><Icon className="w-[22px] h-[22px]" /></span>
                <div className="font-semibold">{t}</div>
                <p className={`text-sm ${m.muted} mt-1`}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className={`py-14 ${m.sectionBand}`}>
        <div className="mx-auto max-w-[1100px] px-5">
          <h2 className="text-[26px] font-extrabold text-center">How it works</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-9">
            {STEPS.map(([t, d], i) => (
              <div key={t} className={`${m.elevated} p-6`}>
                <div className="text-[28px] font-extrabold text-[#D4FF4F] leading-none">{i + 1}</div>
                <div className="mt-3 font-semibold">{t}</div>
                <p className={`text-sm ${m.muted} mt-1`}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14">
        <div className="mx-auto max-w-[1100px] px-5 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className={m.kicker}>WHY SEGMIQ</div>
            <h2 className="text-[28px] font-extrabold leading-tight mt-2">An easy product to stand behind</h2>
            <p className={`mt-3 text-[15px] ${m.muted}`}>Segmiq is built for how trade businesses in Africa actually sell — WhatsApp-first, lead generation included, and two products that cover the whole journey from first enquiry to documented, shareable work.</p>
            <ul className="mt-5 space-y-3 text-sm">
              {WHY.map(({ Icon, t }) => (
                <li key={t} className="flex gap-3"><span className="grid place-items-center w-8 h-8 rounded-lg bg-[#0C0C0C] text-[#D4FF4F] shrink-0"><Icon className="w-4 h-4" /></span><span className="self-center">{t}</span></li>
              ))}
            </ul>
          </div>
          <div className={m.panel}>
            <div className={`text-[13px] font-semibold ${m.faint}`}>THE CLIENT PROMISE YOU CARRY</div>
            <p className="mt-3 text-[18px] font-semibold leading-snug">&quot;We bring you customers and close them — not just another tool for leads you already have.&quot;</p>
            <p className={`mt-3 text-sm ${m.muted}`}>Many clients start with no pipeline at all. Segmiq runs the lead generation and gives them the system that converts it — which makes it an easy thing to sell.</p>
          </div>
        </div>
      </section>

      <section id="apply" className="py-16">
        <div className="mx-auto max-w-[760px] px-5 text-center mb-8">
          <h2 className="text-[30px] md:text-[38px] font-extrabold leading-[1.08]">Let&apos;s build something together</h2>
          <p className={`mt-3 text-[15px] ${m.muted}`}>Tell us about your business and the clients you serve. We&apos;ll set you up with a partner plan that fits.</p>
        </div>
        <div className="mx-auto max-w-[760px] px-5">
          <ContactForm type="partner" source="/partners" submitLabel="Submit application" />
        </div>
      </section>
    </>
  );
}
