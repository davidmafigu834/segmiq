import { FileUp, MessageSquareText, Phone, Send } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";

const CONVERSATIONS = [
  {
    name: "Tafadzwa Moyo",
    preview: "Yes, I'm interested in a 5kW system...",
    stage: "Contacted",
    time: "10:23 AM",
    active: true,
    unread: 0,
  },
  {
    name: "Sunharvest Training Inst.",
    preview: "Please send the proposal.",
    stage: "Proposal sent",
    time: "9:40 AM",
    unread: 1,
  },
  {
    name: "Ruvimbo Tawanda",
    preview: "What's included in the quote?",
    stage: "Negotiating",
    time: "Yesterday",
    unread: 0,
  },
  {
    name: "Memory Phiri",
    preview: "When can you do a site visit?",
    stage: "Contacted",
    time: "Yesterday",
    unread: 0,
  },
] as const;

const MESSAGES = [
  {
    from: "customer" as const,
    text: "Hi, I'm interested in a 5kW solar system with battery backup for my home in Borrowdale.",
  },
  {
    from: "rep" as const,
    text: "Great to hear from you, Tafadzwa. Would you like us to arrange a quick site assessment this week?",
  },
  {
    from: "customer" as const,
    text: "Friday morning works.",
  },
  {
    from: "rep" as const,
    text: "Perfect. We can schedule a site visit for Friday at 10:00 AM.",
  },
] as const;

/** Large static WhatsApp Sales Hub two-pane crop for marketing. */
export default function WhatsAppSalesHubPreview() {
  return (
    <div
      className="marketing-product-chrome select-none overflow-hidden rounded-t-[12px] border border-b-0 border-[#EAECF0] bg-[#FBFDFB]"
      aria-hidden
    >
      <div className="flex min-h-[220px] border-t border-[#EAECF0] bg-white sm:min-h-[260px]">
        {/* Conversation list */}
        <div className="w-[42%] min-w-[132px] max-w-[220px] shrink-0 border-r border-[#E4E7EC] sm:w-[38%]">
          <div className="flex items-center gap-1.5 border-b border-[#E4E7EC] px-2.5 py-2.5">
            <SiWhatsapp size={13} color="#25D366" />
            <p className="truncate text-[11px] font-semibold text-[#101828]">Sales conversations</p>
          </div>
          <ul>
            {CONVERSATIONS.map((chat) => (
              <li
                key={chat.name}
                className={`border-b border-[#F2F4F7] px-2.5 py-2 ${
                  "active" in chat && chat.active ? "bg-[#F9FAFB]" : "bg-white"
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <p className="truncate text-[10px] font-semibold text-[#101828]">{chat.name}</p>
                  <span className="shrink-0 text-[8px] text-[#98A2B3]">{chat.time}</span>
                </div>
                <p className="mt-0.5 truncate text-[9px] text-[#667085]">{chat.preview}</p>
                <div className="mt-1 flex items-center gap-1">
                  <span className="rounded-[5px] bg-[#F2F4F7] px-1.5 py-px text-[8px] font-medium text-[#667085]">
                    {chat.stage}
                  </span>
                  {chat.unread > 0 ? (
                    <span className="ml-auto grid h-3.5 min-w-3.5 place-items-center rounded-full bg-[#25D366] px-1 text-[8px] font-bold text-white">
                      {chat.unread}
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Active conversation */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between gap-2 border-b border-[#E4E7EC] px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-[12px] font-semibold text-[#101828]">Tafadzwa Moyo</p>
              <p className="text-[9px] text-[#98A2B3]">+263 77 ••• ••••</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <span className="rounded-md bg-[#F2F4F7] px-1.5 py-0.5 text-[8px] font-medium text-[#667085]">
                Contacted
              </span>
              <span className="rounded-md bg-[#FEF2F2] px-1.5 py-0.5 text-[8px] font-semibold text-[#B42318]">
                Hot
              </span>
            </div>
          </div>

          <div className="flex-1 space-y-2 overflow-hidden bg-[#F7F8FA] px-2.5 py-2.5">
            {MESSAGES.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.from === "rep" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[88%] rounded-[10px] px-2.5 py-1.5 text-[10px] leading-snug ${
                    msg.from === "rep"
                      ? "bg-[#D4FF4F] text-[#101828]"
                      : "border border-[#E4E7EC] bg-white text-[#344054]"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-[#E4E7EC] bg-white px-2.5 py-2">
            <div className="mb-1.5 hidden items-center gap-3 text-[9px] font-medium text-[#667085] sm:flex">
              <span className="inline-flex items-center gap-1">
                <MessageSquareText className="h-3 w-3" strokeWidth={1.8} />
                Quick replies
              </span>
              <span className="inline-flex items-center gap-1">
                <FileUp className="h-3 w-3" strokeWidth={1.8} />
                Send asset
              </span>
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3 w-3" strokeWidth={1.8} />
                Log call
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="flex h-8 min-w-0 flex-1 items-center rounded-lg border border-[#E4E7EC] bg-[#F9FAFB] px-2.5 text-[10px] text-[#98A2B3]">
                Type a WhatsApp reply...
              </div>
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#D4FF4F] text-[#101828]">
                <Send className="h-3.5 w-3.5" strokeWidth={2} />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
