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
  { label: "Reports", icon: BarChart3 },
] as const;

const KPIS = [
  { label: "Follow-ups due", value: "15", tint: "bg-[#FFF7ED] text-[#B45309]" },
  { label: "Pipeline value", value: "$118,450", tint: "bg-[#F0FDF4] text-[#15803D]" },
  { label: "Deals won", value: "9", tint: "bg-[#F7FEE7] text-[#4D7C0F]" },
  { label: "Conversion rate", value: "32%", tint: "bg-[#EFF6FF] text-[#2563EB]" },
  { label: "Response time", value: "4m 32s", tint: "bg-[#F2F4F7] text-[#667085]" },
] as const;

const PRIORITIES = [
  { name: "Samson Kandare", detail: "Solar quote follow-up", due: "Due today", initials: "SK" },
  { name: "Chiedza Ndlovu", detail: "Site visit confirmation", due: "Overdue", overdue: true, initials: "CN" },
  { name: "Tafadzwa Moyo", detail: "Send revised quotation", due: "Due today", initials: "TM" },
] as const;

/** Large static Sales Command Center / dashboard crop for marketing. */
export default function SalesCommandCenterPreview() {
  return (
    <div
      className="marketing-product-chrome select-none overflow-hidden rounded-t-[12px] border border-b-0 border-[#EAECF0] bg-[#FAFBFC]"
      aria-hidden
    >
      <div className="flex min-h-[220px] bg-[#F7F8FA] sm:min-h-[260px]">
        <aside className="hidden w-[132px] shrink-0 flex-col border-r border-[#E4E7EC] bg-white sm:flex">
          <div className="flex h-10 items-center border-b border-[#E4E7EC] px-2.5">
            <Image
              src="/segmiq-wordmark-black.png"
              alt=""
              width={88}
              height={15}
              className="h-3 w-auto"
            />
          </div>
          <nav className="flex flex-col gap-0.5 px-1.5 py-2">
            {NAV.map((item) => {
              const active = "active" in item && item.active;
              return (
                <div
                  key={item.label}
                  className={`relative flex items-center gap-1.5 rounded-[7px] px-1.5 py-[6px] text-[9px] font-medium ${
                    active ? "bg-[#F7FEE7] text-[#101828]" : "text-[#667085]"
                  }`}
                >
                  {active ? (
                    <span className="absolute left-0 top-1/2 h-3.5 w-0.5 -translate-y-1/2 rounded-full bg-[#D4FF4F]" />
                  ) : null}
                  {item.icon === "whatsapp" ? (
                    <SiWhatsapp size={11} color="#25D366" />
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

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 border-b border-[#E4E7EC] bg-white px-3 py-2.5">
            <p className="truncate text-[13px] font-semibold text-[#101828]">Good morning, Tendai</p>
            <div className="flex shrink-0 items-center gap-1.5">
              <div className="hidden h-7 w-24 items-center gap-1 rounded-md border border-[#E4E7EC] bg-[#F9FAFB] px-2 text-[9px] text-[#98A2B3] md:flex">
                <Search className="h-3 w-3" />
                Search
              </div>
              <div className="grid h-7 w-7 place-items-center rounded-md border border-[#E4E7EC] text-[#667085]">
                <Bell className="h-3.5 w-3.5" />
              </div>
              <div className="hidden h-7 items-center gap-1 rounded-md bg-[#D4FF4F] px-2 text-[9px] font-semibold text-[#101828] sm:inline-flex">
                <Zap className="h-3 w-3" />
                Quick actions
              </div>
            </div>
          </div>

          <div className="space-y-2.5 p-2.5 sm:p-3">
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-5">
              {KPIS.map((kpi, i) => (
                <div
                  key={kpi.label}
                  className={`rounded-[8px] border border-[#E4E7EC] bg-white px-2 py-1.5 ${
                    i >= 3 ? "hidden sm:block" : ""
                  } ${i >= 4 ? "lg:block" : ""}`}
                >
                  <div className="mb-1 flex items-center gap-1">
                    <span className={`h-3.5 w-3.5 rounded-[4px] ${kpi.tint}`} />
                    <span className="truncate text-[8px] font-medium text-[#667085]">{kpi.label}</span>
                  </div>
                  <p className="text-[12px] font-semibold tabular-nums tracking-tight text-[#101828] sm:text-[13px]">
                    {kpi.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid gap-2 sm:grid-cols-[1.25fr_0.75fr]">
              <div className="overflow-hidden rounded-[10px] border border-[#E4E7EC] bg-white">
                <div className="border-b border-[#E4E7EC] px-3 py-2">
                  <p className="text-[11px] font-semibold text-[#101828]">Today&apos;s priorities</p>
                </div>
                <ul>
                  {PRIORITIES.map((row) => (
                    <li
                      key={row.name}
                      className="flex items-center gap-2 border-b border-[#F2F4F7] px-3 py-2 last:border-b-0"
                    >
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#F2F4F7] text-[8px] font-semibold text-[#667085]">
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

              <div className="hidden overflow-hidden rounded-[10px] border border-[#E4E7EC] bg-white sm:block">
                <div className="border-b border-[#E4E7EC] px-3 py-2">
                  <p className="text-[11px] font-semibold text-[#101828]">My performance</p>
                </div>
                <div className="space-y-2 p-3">
                  {[
                    { label: "Calls logged", value: "24" },
                    { label: "Quotes sent", value: "11" },
                    { label: "Won this month", value: "9" },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-[#667085]">{row.label}</span>
                      <span className="text-[12px] font-semibold tabular-nums text-[#101828]">
                        {row.value}
                      </span>
                    </div>
                  ))}
                  <div className="h-1.5 overflow-hidden rounded-full bg-[#F2F4F7]">
                    <div className="h-full w-[68%] rounded-full bg-[#D4FF4F]" />
                  </div>
                  <p className="text-[9px] text-[#98A2B3]">68% of monthly target</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
