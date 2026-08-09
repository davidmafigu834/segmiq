import type { ReactNode } from "react";
import {
  BarChart3,
  Check,
  Clock3,
  FileText,
  FormInput,
  Globe2,
  History,
  MapPin,
  MessageCircle,
  RefreshCw,
  Route,
  Send,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";

type Feature = {
  title: string;
  copy: string;
  icon: LucideIcon;
  preview: ReactNode;
  className?: string;
};

const leadSources = [
  [MessageCircle, "WhatsApp", "text-[#4be37d]"],
  [Globe2, "Facebook Lead Ad", "text-[#69a2ff]"],
  [FormInput, "Website Form", "text-white/70"],
  [Users, "Referral", "text-[#d4ff4f]"],
] as const;

const features: Feature[] = [
  {
    title: "Lead Capture",
    copy: "Bring WhatsApp enquiries, Facebook Lead Ads, forms, referrals and manual leads into one organised pipeline.",
    icon: Target,
    className: "lg:col-span-2",
    preview: (
      <div className="grid grid-cols-2 gap-2">
        {leadSources.map(([Icon, label, color]) => (
          <div
            key={label}
            className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-black/25 px-3 py-2.5 text-[10px] text-white/60"
          >
            <Icon className={`h-3.5 w-3.5 ${color}`} />
            {label}
          </div>
        ))}
      </div>
    ),
  },
  {
    title: "Smart Routing",
    copy: "Assign every enquiry to the right salesperson using availability, location, expertise and lead value.",
    icon: Route,
    preview: (
      <div className="rounded-xl border border-white/[0.08] bg-black/25 p-3">
        <div className="text-[9px] uppercase tracking-[0.12em] text-white/30">Best match</div>
        <div className="mt-3 flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[#60432e] text-[9px]">TM</span>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-medium">Solar Team</div>
            <div className="mt-0.5 flex items-center gap-1 text-[9px] text-white/35">
              <MapPin className="h-2.5 w-2.5" /> Harare
            </div>
          </div>
          <span className="text-[9px] text-[#d4ff4f]">Available</span>
        </div>
        <div className="mt-3 flex items-center justify-between text-[9px] text-white/45">
          <span>Assigned to Tawanda M.</span>
          <button className="rounded-md bg-[#d4ff4f] px-2 py-1.5 font-semibold text-black">
            Route lead
          </button>
        </div>
      </div>
    ),
  },
  {
    title: "WhatsApp Automation",
    copy: "Confirm enquiries instantly, qualify prospects and remind salespeople to follow up without losing the personal conversation.",
    icon: MessageCircle,
    preview: (
      <div className="space-y-2 text-[9px] leading-4">
        <div className="max-w-[88%] rounded-lg rounded-bl-sm bg-white/[0.07] p-2.5 text-white/60">
          Thanks for your enquiry. What service do you need?
        </div>
        <div className="ml-auto max-w-[80%] rounded-lg rounded-br-sm bg-[#d4ff4f] p-2.5 text-black">
          A quotation for a 5kW system.
        </div>
        <div className="flex items-center gap-1 text-[8px] text-white/30">
          <Clock3 className="h-2.5 w-2.5" /> Follow-up reminder created
        </div>
      </div>
    ),
  },
  {
    title: "Lead Scoring",
    copy: "Score opportunities from 0–100 so the team immediately knows who deserves attention first.",
    icon: Target,
    className: "lg:row-span-2",
    preview: (
      <div className="space-y-2.5">
        {[
          ["82", "Hot", "bg-[#d4ff4f] text-black"],
          ["54", "Warm", "bg-amber-400 text-black"],
          ["21", "Cold", "bg-white/10 text-white/55"],
        ].map(([score, label, style]) => (
          <div key={score} className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-black/25 p-3">
            <span className={`grid h-10 w-10 place-items-center rounded-full text-sm font-semibold ${style}`}>
              {score}
            </span>
            <div>
              <div className="text-[11px] font-medium">{label}</div>
              <div className="mt-0.5 text-[8px] text-white/35">Priority level</div>
            </div>
          </div>
        ))}
        <p className="pt-1 text-[8px] leading-3 text-white/30">
          Rules-based scoring on every plan. Advanced AI intent scoring on higher plans.
        </p>
      </div>
    ),
  },
  {
    title: "One-Tap Quotations",
    copy: "Create professional quotations and send them to prospects through WhatsApp without switching between tools.",
    icon: FileText,
    className: "lg:col-span-2",
    preview: (
      <div className="rounded-xl border border-white/[0.08] bg-black/25 p-3">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-2 text-[9px]">
          <span className="font-medium">Quote Q-1024</span>
          <span className="text-white/40">Tarisai K.</span>
        </div>
        <div className="flex items-center justify-between py-3 text-[10px]">
          <span className="text-white/55">Solar System</span>
          <strong>$5,450</strong>
        </div>
        <button className="flex w-full items-center justify-center gap-1.5 rounded-md border border-[#d4ff4f]/25 py-2 text-[9px] font-medium text-[#d4ff4f]">
          <Send className="h-3 w-3" /> Send on WhatsApp
        </button>
      </div>
    ),
  },
  {
    title: "Manager Insights",
    copy: "See pipeline value, response times, salesperson activity, follow-up performance and reasons deals are lost.",
    icon: BarChart3,
    preview: (
      <div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-black/25 p-2.5">
            <div className="text-[8px] text-white/30">Response time</div>
            <div className="mt-1 text-base font-semibold">4m 12s</div>
          </div>
          <div className="rounded-lg bg-black/25 p-2.5">
            <div className="text-[8px] text-white/30">Follow-up</div>
            <div className="mt-1 text-base font-semibold">84%</div>
          </div>
        </div>
        <div className="mt-3 flex h-12 items-end gap-1.5">
          {[38, 54, 34, 70, 59, 82, 66].map((height, index) => (
            <span
              key={index}
              className="flex-1 rounded-t-sm bg-[#d4ff4f]/80"
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
      </div>
    ),
  },
  {
    title: "Stale Lead Recovery",
    copy: "Identify opportunities that have gone quiet and automatically create the right follow-up action.",
    icon: RefreshCw,
    preview: (
      <div className="space-y-2">
        {[
          ["Farai M.", "2 days"],
          ["Rudo N.", "4 days"],
          ["Tinashe K.", "7 days"],
        ].map(([name, inactive]) => (
          <div key={name} className="flex items-center rounded-lg bg-black/25 p-2 text-[9px]">
            <span className="flex-1">{name}</span>
            <span className="mr-2 text-white/30">{inactive}</span>
            <button className="rounded border border-[#d4ff4f]/20 px-1.5 py-1 text-[#d4ff4f]">
              Recover
            </button>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: "Team Activity",
    copy: "Give managers a permanent record of calls, notes, messages, assignments, quotations and pipeline changes.",
    icon: History,
    className: "lg:col-span-2",
    preview: (
      <div className="grid gap-2 sm:grid-cols-2">
        {[
          ["Quotation sent", "Tawanda · 2m"],
          ["Call recorded", "Rudo · 8m"],
          ["Lead reassigned", "Manager · 14m"],
          ["Note added", "Farai · 21m"],
        ].map(([event, meta]) => (
          <div key={event} className="flex items-center gap-2 rounded-lg bg-black/25 p-2.5">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-[#d4ff4f]/10 text-[#d4ff4f]">
              <Check className="h-3 w-3" />
            </span>
            <div>
              <div className="text-[9px]">{event}</div>
              <div className="mt-0.5 text-[8px] text-white/30">{meta}</div>
            </div>
          </div>
        ))}
      </div>
    ),
  },
];

const workflow = [
  ["Capture", "Collect every enquiry"],
  ["Score", "Prioritise opportunity"],
  ["Route", "Assign the right rep"],
  ["Confirm", "Respond immediately"],
  ["Coach", "Guide the next action"],
  ["Quote", "Send professionally"],
  ["Win", "Record the outcome"],
] as const;

export default function LandingFeatures() {
  return (
    <>
      <section id="platform" className="bg-[#0c0c0c] px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-[1120px]">
          <div className="max-w-[650px]">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#d4ff4f]">
              One revenue workspace
            </span>
            <h2 className="mt-4 text-[32px] font-semibold leading-tight tracking-[-0.03em] sm:text-[44px]">
              Everything your team needs to win more
            </h2>
            <p className="mt-4 max-w-[590px] text-sm leading-6 text-white/50 sm:text-base">
              Capture demand, prioritise the right opportunities and give every salesperson a clear
              next action.
            </p>
          </div>

          <div className="mt-12 grid auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ title, copy, icon: Icon, preview, className = "" }) => (
              <article
                key={title}
                className={`group rounded-2xl border border-white/10 bg-[#151714] p-5 transition duration-300 hover:-translate-y-0.5 hover:border-[#d4ff4f]/25 ${className}`}
              >
                <div className="flex items-center justify-between">
                  <span className="grid h-9 w-9 place-items-center rounded-lg border border-[#d4ff4f]/15 bg-[#d4ff4f]/[0.07] text-[#d4ff4f]">
                    <Icon className="h-[17px] w-[17px]" />
                  </span>
                  <ArrowMark />
                </div>
                <h3 className="mt-5 text-[15px] font-semibold">{title}</h3>
                <p className="mt-2 min-h-[60px] text-[11px] leading-[1.65] text-white/42">{copy}</p>
                <div className="mt-5">{preview}</div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-[#111310] px-5 py-20 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-[1120px]">
          <div className="text-center">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#d4ff4f]">
              The SegmiQ workflow
            </span>
            <h2 className="mt-4 text-[30px] font-semibold tracking-[-0.03em] sm:text-[42px]">
              From first enquiry to recorded win
            </h2>
          </div>
          <ol className="relative mt-12 grid gap-3 sm:grid-cols-7 sm:gap-0">
            <div
              aria-hidden
              className="absolute left-[7%] right-[7%] top-5 hidden h-px bg-gradient-to-r from-transparent via-[#d4ff4f]/45 to-transparent sm:block"
            />
            {workflow.map(([stage, description], index) => (
              <li
                key={stage}
                className="relative flex gap-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 sm:block sm:border-0 sm:bg-transparent sm:p-2 sm:text-center"
              >
                <span className="relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#d4ff4f]/40 bg-[#111310] text-xs font-semibold text-[#d4ff4f] sm:mx-auto">
                  {index + 1}
                </span>
                <div>
                  <h3 className="sm:mt-4 text-[12px] font-semibold">{stage}</h3>
                  <p className="mt-1 text-[9px] leading-4 text-white/35">{description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}

function ArrowMark() {
  return (
    <span className="h-px w-8 bg-gradient-to-r from-white/15 to-transparent transition-all group-hover:from-[#d4ff4f]/50" />
  );
}
