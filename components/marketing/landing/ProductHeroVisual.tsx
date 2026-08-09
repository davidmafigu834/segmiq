import {
  Bell,
  CalendarDays,
  Columns3,
  FileText,
  LayoutDashboard,
  ListTodo,
  Search,
  UsersRound,
  BarChart3,
  Zap,
} from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import Image from "next/image";

const NAV = [
  { label: "Dashboard", icon: LayoutDashboard, active: true },
  { label: "My Pipeline", icon: Columns3 },
  { label: "WhatsApp Sales Hub", icon: "whatsapp" as const },
  { label: "Leads", icon: UsersRound },
  { label: "Quotations", icon: FileText },
  { label: "Calendar", icon: CalendarDays },
  { label: "Tasks", icon: ListTodo },
  { label: "Customers", icon: UsersRound },
  { label: "Reports", icon: BarChart3 },
] as const;

const KPIS = [
  { label: "Follow-ups due", value: "7", tint: "bg-[#FFF7ED] text-[#B45309]" },
  { label: "Pipeline value", value: "$48.2k", tint: "bg-[#F0FDF4] text-[#15803D]" },
  { label: "Deals won", value: "12", tint: "bg-[#F7FEE7] text-[#4D7C0F]" },
  { label: "Conversion rate", value: "28%", tint: "bg-[#EFF6FF] text-[#2563EB]" },
  { label: "Response time", value: "11m", tint: "bg-[#F2F4F7] text-[#667085]" },
] as const;

const PRIORITIES = [
  { name: "Samson Kandare", detail: "Solar quote follow-up", due: "Due today", initials: "SK" },
  { name: "Chiedza Ndlovu", detail: "Site visit confirmation", due: "Overdue", overdue: true, initials: "CN" },
  { name: "Tafadzwa Moyo", detail: "Send revised quotation", due: "Due today", initials: "TM" },
] as const;

const STAGES = [
  { name: "New", count: 8 },
  { name: "Qualified", count: 5 },
  { name: "Proposal", count: 4 },
  { name: "Won", count: 3 },
] as const;

const CHATS = [
  { name: "Addie's Closet", preview: "Can you send the quote today?", time: "2m", unread: 2 },
  { name: "Tynsh", preview: "Thanks — when can we start?", time: "18m", unread: 0 },
  { name: "Prince", preview: "Interested in the solar package", time: "1h", unread: 1 },
  { name: "ZiLoad", preview: "Payment received, please confirm", time: "3h", unread: 0 },
  { name: "KingLeo", preview: "Is the roofing team available?", time: "Yesterday", unread: 0 },
] as const;

/**
 * Lightweight static SegmiQ 2.0 product preview for the marketing hero.
 * Demo presentation data only — not wired to live APIs.
 */
export default function ProductHeroVisual() {
  return (
    <div
      className="relative mx-auto w-full max-w-[920px] select-none lg:mx-0 lg:max-w-none"
      aria-hidden
    >
      {/* Soft atmospheric accent — very subtle */}
      <div
        className="pointer-events-none absolute -inset-8 -z-0 sm:-inset-12"
        style={{
          background:
            "radial-gradient(circle at 55% 45%, rgba(212,255,79,0.10), transparent 62%)",
        }}
      />

      {/* Main dashboard frame — light product UI; frame elevates on dark marketing canvas */}
      <div
        className="marketing-product-chrome relative z-[1] overflow-hidden rounded-[12px] border border-[#E4E7EC] bg-[#F7F8FA] shadow-[0_18px_50px_rgba(16,24,40,0.08)]"
        style={{ aspectRatio: "16 / 9.2" }}
      >
        <div className="flex h-full min-h-0">
          {/* Sidebar */}
          <aside className="hidden w-[22%] min-w-[132px] max-w-[168px] shrink-0 flex-col border-r border-[#E4E7EC] bg-white sm:flex">
            <div className="flex h-11 items-center border-b border-[#E4E7EC] px-3">
              <Image
                src="/segmiq-wordmark-black.png"
                alt=""
                width={96}
                height={16}
                className="h-3.5 w-auto"
                priority
              />
            </div>
            <nav className="flex flex-1 flex-col gap-0.5 overflow-hidden px-1.5 py-2.5">
              {NAV.map((item) => {
                const active = "active" in item && item.active;
                return (
                  <div
                    key={item.label}
                    className={`relative flex items-center gap-2 rounded-[7px] px-2 py-[7px] text-[10px] font-medium leading-tight ${
                      active ? "bg-[#F7FEE7] text-[#101828]" : "text-[#667085]"
                    }`}
                  >
                    {active ? (
                      <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-[#D4FF4F]" />
                    ) : null}
                    {item.icon === "whatsapp" ? (
                      <SiWhatsapp size={12} color="#25D366" />
                    ) : (
                      <item.icon
                        className={`h-3 w-3 shrink-0 ${active ? "text-[#4D7C0F]" : "text-[#98A2B3]"}`}
                        strokeWidth={1.8}
                      />
                    )}
                    <span className="truncate">{item.label}</span>
                  </div>
                );
              })}
            </nav>
          </aside>

          {/* Main */}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center justify-between gap-2 border-b border-[#E4E7EC] bg-white px-3 py-2.5 sm:px-4">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-[#101828] sm:text-[14px]">
                  Good morning, Tendai
                </p>
                <p className="hidden text-[10px] text-[#98A2B3] sm:block">Sunday, 9 August</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                <div className="hidden h-7 w-28 items-center gap-1.5 rounded-md border border-[#E4E7EC] bg-[#F9FAFB] px-2 text-[10px] text-[#98A2B3] md:flex">
                  <Search className="h-3 w-3" />
                  Search
                </div>
                <div className="grid h-7 w-7 place-items-center rounded-md border border-[#E4E7EC] bg-white text-[#667085]">
                  <Bell className="h-3.5 w-3.5" />
                </div>
                <div className="hidden h-7 items-center gap-1 rounded-md bg-[#D4FF4F] px-2 text-[10px] font-semibold text-[#101828] sm:inline-flex">
                  <Zap className="h-3 w-3" />
                  Quick actions
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-2.5 overflow-hidden p-2.5 sm:space-y-3 sm:p-3.5">
              {/* KPIs */}
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5 sm:gap-2">
                {KPIS.map((kpi) => (
                  <div
                    key={kpi.label}
                    className="rounded-[8px] border border-[#E4E7EC] bg-white px-2 py-1.5 sm:px-2.5 sm:py-2"
                  >
                    <div className="mb-1 flex items-center gap-1.5">
                      <span className={`h-4 w-4 rounded-[5px] ${kpi.tint}`} />
                      <span className="truncate text-[8px] font-medium text-[#667085] sm:text-[9px]">
                        {kpi.label}
                      </span>
                    </div>
                    <p className="text-[12px] font-semibold tracking-tight text-[#101828] sm:text-[13px]">
                      {kpi.value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="grid min-h-0 grid-cols-1 gap-2 sm:grid-cols-[1.2fr_0.8fr] sm:gap-2.5">
                {/* Today's priorities */}
                <div className="overflow-hidden rounded-[10px] border border-[#E4E7EC] bg-white">
                  <div className="border-b border-[#E4E7EC] px-3 py-2">
                    <p className="text-[11px] font-semibold text-[#101828]">Today&apos;s priorities</p>
                  </div>
                  <ul>
                    {PRIORITIES.map((row) => (
                      <li
                        key={row.name}
                        className="flex items-center gap-2.5 border-b border-[#F2F4F7] px-3 py-2 last:border-b-0"
                      >
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#F2F4F7] text-[9px] font-semibold text-[#667085]">
                          {row.initials}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[11px] font-semibold text-[#101828]">{row.name}</p>
                          <p className="truncate text-[9px] text-[#667085]">{row.detail}</p>
                        </div>
                        <span
                          className={`shrink-0 rounded-md px-1.5 py-0.5 text-[8px] font-medium ${
                            row.overdue ? "bg-[#FEF2F2] text-[#EF4444]" : "bg-[#F2F4F7] text-[#667085]"
                          }`}
                        >
                          {row.due}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Pipeline */}
                <div className="overflow-hidden rounded-[10px] border border-[#E4E7EC] bg-white">
                  <div className="border-b border-[#E4E7EC] px-3 py-2">
                    <p className="text-[11px] font-semibold text-[#101828]">My Pipeline</p>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 p-2.5">
                    {STAGES.map((stage) => (
                      <div
                        key={stage.name}
                        className="rounded-lg border border-[#E4E7EC] bg-[#FCFCFD] px-2 py-2"
                      >
                        <p className="text-[9px] font-medium text-[#667085]">{stage.name}</p>
                        <p className="mt-0.5 text-[13px] font-semibold text-[#101828]">{stage.count}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* WhatsApp Sales Hub overlay */}
      <div className="marketing-product-chrome absolute bottom-[-6%] right-0 z-[3] w-[min(300px,78%)] overflow-hidden rounded-[12px] border border-[#E4E7EC] bg-white shadow-[0_18px_45px_rgba(16,24,40,0.10)] max-h-[72%] sm:bottom-auto sm:right-[-3%] sm:top-[13%] sm:max-h-none sm:w-[300px] md:right-[-5%] md:top-[14%] lg:right-[-36px] lg:top-[15%] xl:right-[-52px] xl:w-[310px]">
        <div className="flex items-center gap-2 border-b border-[#E4E7EC] px-3 py-2.5">
          <SiWhatsapp size={16} color="#25D366" />
          <p className="text-[12px] font-semibold text-[#101828]">WhatsApp Sales Hub</p>
          <span className="ml-auto rounded-full bg-[#F2F4F7] px-1.5 py-0.5 text-[10px] font-semibold text-[#667085]">
            12
          </span>
        </div>
        <div className="border-b border-[#E4E7EC] px-3 py-2">
          <div className="flex h-8 items-center gap-2 rounded-lg border border-[#E4E7EC] bg-[#F9FAFB] px-2.5 text-[11px] text-[#98A2B3]">
            <Search className="h-3.5 w-3.5" />
            Search conversations
          </div>
        </div>
        <ul className="max-h-[320px] overflow-hidden sm:max-h-none">
          {CHATS.map((chat, i) => (
            <li
              key={chat.name}
              className={`items-start gap-2.5 border-b border-[#F2F4F7] px-3 py-2.5 last:border-b-0 ${
                i === 0 ? "bg-[#F9FAFB]" : "bg-white"
              } ${i > 3 ? "hidden sm:flex" : "flex"}`}
            >
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#ECFDF3] text-[10px] font-semibold text-[#027A48]">
                {chat.name.slice(0, 1)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[12px] font-semibold text-[#101828]">{chat.name}</p>
                  <span className="shrink-0 text-[9px] text-[#98A2B3]">{chat.time}</span>
                </div>
                <p className="mt-0.5 truncate text-[11px] text-[#667085]">{chat.preview}</p>
              </div>
              {chat.unread > 0 ? (
                <span className="mt-1 grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-[#25D366] px-1 text-[9px] font-bold text-white">
                  {chat.unread}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
