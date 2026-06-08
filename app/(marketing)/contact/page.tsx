import { MessageCircle, Mail, Briefcase, ArrowRight } from "lucide-react";
import ContactForm from "@/components/marketing/ContactForm";
import JsonLd from "@/components/seo/JsonLd";
import { breadcrumbLd, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Book a demo",
  description: "See Segmiq on your own leads. Book a demo and we'll show you the response times and the contracts hiding in your pipeline.",
  path: "/contact",
});

const STEPS = [
  ["We reply on WhatsApp", "Usually within a working day — on the channel you actually check."],
  ["A short call", "15 minutes to understand your pipeline and how your team sells."],
  ["See it on your leads", "We load a sample of your real enquiries and show the system working."],
];

export default function ContactPage() {
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Contact", path: "/contact" }])} />
      <section className="pt-16 pb-8">
        <div className="mx-auto max-w-[1100px] px-5 max-w-[760px]">
          <div className="text-xs tracking-widest font-semibold text-[#8a8a8a]">BOOK A DEMO</div>
          <h1 className="mt-3 text-[38px] sm:text-[48px] leading-[1.06] font-extrabold tracking-tight">See Segmiq on your own leads</h1>
          <p className="mt-4 text-base text-[#5b5b5b] max-w-[560px]">Bring a week of real enquiries. We&apos;ll show you the response times, the missed follow-ups, and the contracts hiding in your pipeline — then set up a portal so you can try it.</p>
        </div>
      </section>

      <section className="pb-16">
        <div className="mx-auto max-w-[1100px] px-5 grid lg:grid-cols-[1.3fr_1fr] gap-8 items-start">
          <ContactForm type="demo" source="/contact" />

          <div className="space-y-5">
            <div className="rounded-2xl bg-[#F8F7F4] border border-black/[0.08] p-6">
              <div className="font-semibold">What happens next</div>
              <ol className="mt-4 space-y-4">
                {STEPS.map(([t, d], i) => (
                  <li key={t} className="flex gap-3">
                    <span className="grid place-items-center w-[26px] h-[26px] rounded-md bg-[#D4FF4F] text-black font-extrabold text-sm shrink-0">{i + 1}</span>
                    <div><div className="text-sm font-medium">{t}</div><p className="text-[13px] text-[#5b5b5b]">{d}</p></div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-2xl border border-black/[0.08] p-6">
              <div className="font-semibold">Prefer to reach us directly?</div>
              <div className="mt-4 space-y-3 text-sm">
                <a href="#" className="flex items-center gap-3 text-[#5b5b5b] hover:text-black"><span className="grid place-items-center w-9 h-9 rounded-lg bg-[#0C0C0C] text-[#D4FF4F]"><MessageCircle className="w-[18px] h-[18px]" /></span> WhatsApp us</a>
                <a href="mailto:hello@segmiq.com" className="flex items-center gap-3 text-[#5b5b5b] hover:text-black"><span className="grid place-items-center w-9 h-9 rounded-lg bg-[#0C0C0C] text-[#D4FF4F]"><Mail className="w-[18px] h-[18px]" /></span> hello@segmiq.com</a>
                <a href="/contact" className="flex items-center gap-3 text-[#5b5b5b] hover:text-black"><span className="grid place-items-center w-9 h-9 rounded-lg bg-[#0C0C0C] text-[#D4FF4F]"><Briefcase className="w-[18px] h-[18px]" /></span> Talk to sales</a>
              </div>
            </div>

            <div className="rounded-2xl bg-[#0C0C0C] text-white p-6">
              <div className="text-[13px] text-white/70">Already a customer?</div>
              <div className="mt-1 font-semibold">Get help from support</div>
              <a href="#" className="inline-flex items-center gap-1 mt-3 text-sm font-semibold text-[#D4FF4F]">Visit the help centre <ArrowRight className="w-[15px] h-[15px]" /></a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
