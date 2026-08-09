import { SiWhatsapp } from "react-icons/si";

const CHATS = [
  {
    name: "Tafadzwa Moyo",
    initials: "TM",
    preview: "Interested in a 5kW system...",
    stage: "New",
    time: "2m",
    unread: 2,
  },
  {
    name: "Sunharvest Training Inst.",
    initials: "ST",
    preview: "Please send the proposal.",
    stage: "Proposal",
    time: "18m",
    unread: 0,
  },
  {
    name: "Ruvimbo Tawanda",
    initials: "RT",
    preview: "What's included in the quote?",
    stage: "Contacted",
    time: "1h",
    unread: 1,
  },
  {
    name: "Memory Phiri",
    initials: "MP",
    preview: "When can you do a site visit?",
    stage: "Negotiating",
    time: "3h",
    unread: 0,
  },
] as const;

/** Static marketing preview — WhatsApp Sales Hub conversation list. */
export default function MarketingWhatsAppPreview() {
  return (
    <div
      className="marketing-product-chrome overflow-hidden rounded-t-[12px] border border-b-0 border-[#E4E7EC] bg-white"
      aria-hidden
    >
      <div className="flex items-center gap-2 border-b border-[#E4E7EC] px-3 py-2.5">
        <SiWhatsapp size={14} color="#25D366" />
        <p className="text-[11px] font-semibold text-[#101828]">Sales conversations</p>
        <span className="ml-auto rounded-full bg-[#F2F4F7] px-1.5 py-0.5 text-[9px] font-semibold text-[#667085]">
          12
        </span>
      </div>
      <ul>
        {CHATS.map((chat, i) => (
          <li
            key={chat.name}
            className={`flex items-start gap-2 border-b border-[#F2F4F7] px-3 py-2 last:border-b-0 ${
              i === 0 ? "bg-[#F9FAFB]" : "bg-white"
            }`}
          >
            <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#ECFDF3] text-[9px] font-semibold text-[#027A48]">
              {chat.initials}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1.5">
                <p className="truncate text-[11px] font-semibold text-[#101828]">{chat.name}</p>
                <span className="shrink-0 text-[9px] text-[#98A2B3]">{chat.time}</span>
              </div>
              <p className="mt-0.5 truncate text-[10px] text-[#667085]">{chat.preview}</p>
              <span className="mt-1 inline-flex rounded-[5px] bg-[#F2F4F7] px-1.5 py-px text-[8px] font-medium text-[#667085]">
                {chat.stage}
              </span>
            </div>
            {chat.unread > 0 ? (
              <span className="mt-1 grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-[#25D366] px-1 text-[8px] font-bold text-white">
                {chat.unread}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
