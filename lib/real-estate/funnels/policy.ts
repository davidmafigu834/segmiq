export const FUNNEL_STATUSES = ["building", "review", "live", "paused"] as const;
export type FunnelStatus = (typeof FUNNEL_STATUSES)[number];

export const FUNNEL_HTML_MAX_BYTES = 2_000_000;
export const FUNNEL_LINE_MAX = 160;

/** Static siblings of /property/[slug]/[handle], and words that read as system pages. */
const RESERVED_HANDLES = new Set([
  "opengraph-image",
  "twitter-image",
  "icon",
  "admin",
  "agent",
  "agency",
  "api",
  "edit",
  "enquire",
  "funnel",
  "info",
  "new",
  "preview",
  "property",
  "segmiq",
  "settings",
  "support",
  "team",
  "viewing",
]);

export function normaliseHandle(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30)
    .replace(/-+$/g, "");
}

export function handleProblem(handle: string): string | null {
  if (handle.length < 2) return "Use at least 2 letters or numbers.";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(handle)) return "Use lowercase letters, numbers and single hyphens.";
  if (RESERVED_HANDLES.has(handle)) return "That name is reserved. Try your first name.";
  return null;
}

export function suggestedHandle(name: string | null | undefined): string {
  const first = (name ?? "").trim().split(/\s+/)[0] ?? "";
  const handle = normaliseHandle(first);
  return handle.length >= 2 ? handle : normaliseHandle(name);
}

/** URL segment for a campaign label: "WhatsApp Status" becomes "whatsapp-status". */
export function channelSegment(label: string | null | undefined): string {
  return normaliseHandle(label).slice(0, 24).replace(/-+$/g, "");
}

export function funnelPath(slug: string, handle: string, channel?: string | null): string {
  const base = `/property/${encodeURIComponent(slug)}/${encodeURIComponent(handle)}`;
  return channel ? `${base}/${encodeURIComponent(channel)}` : base;
}

export function whatsappDigits(raw: string | null | undefined, dialCode = "263"): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (!digits) return null;
  let full = digits;
  if (full.startsWith("00")) full = full.slice(2);
  else if (full.startsWith("0")) full = `${dialCode}${full.slice(1)}`;
  else if (full.length <= 9) full = `${dialCode}${full}`;
  return /^[1-9]\d{7,14}$/.test(full) ? full : null;
}

export function displayPhone(digits: string | null): string {
  if (!digits) return "";
  if (digits.startsWith("263") && digits.length === 12) {
    return `+263 ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  return `+${digits}`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** JSON that is safe inside an inline <script>. */
export function scriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export type FunnelPerson = {
  name: string;
  first: string;
  initials: string;
  role: string;
  line: string;
  photoUrl: string | null;
  phone: string | null;
  phoneDisplay: string;
};

export type FunnelContext = {
  agent: FunnelPerson | null;
  agency: { name: string; logoUrl: string | null };
  contact: { first: string; name: string; phone: string | null; phoneDisplay: string };
  property: { slug: string; url: string; heading: string; priceLabel: string | null };
  preview: boolean;
};

/** Values for {{agent.*}}, {{agency.*}}, {{contact.*}} and {{property.*}}. Agency values stand in when no agent is attached. */
export function placeholderValues(context: FunnelContext): Record<string, string> {
  const agent = context.agent;
  return {
    "agent.name": agent?.name ?? context.agency.name,
    "agent.first": agent?.first ?? "our team",
    "agent.initials": agent?.initials ?? initialsOf(context.agency.name),
    "agent.role": agent?.role ?? "Sales team",
    "agent.line": agent?.line ?? "",
    "agent.photo_url": agent?.photoUrl ?? "",
    "agent.phone": agent?.phone ?? context.contact.phone ?? "",
    "agent.phone_display": agent?.phoneDisplay || context.contact.phoneDisplay,
    "contact.first": context.contact.first,
    "contact.name": context.contact.name,
    "contact.phone": context.contact.phone ?? "",
    "contact.phone_display": context.contact.phoneDisplay,
    "agency.name": context.agency.name,
    "agency.logo_url": context.agency.logoUrl ?? "",
    "property.url": context.property.url,
    "property.slug": context.property.slug,
    "property.heading": context.property.heading,
    "property.price": context.property.priceLabel ?? "",
  };
}

export function fillPlaceholders(html: string, values: Record<string, string>): string {
  return html.replace(/\{\{\s*([a-z]+\.[a-z_]+)\s*\}\}/g, (match, key: string) =>
    key in values ? escapeHtml(values[key]) : match
  );
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "A";
}

/**
 * Runs first inside the sandboxed funnel. The frame has an opaque origin, so it cannot
 * reach SegmiQ cookies or APIs; it asks the parent page to submit and record events.
 */
export function bridgeScript(context: FunnelContext): string {
  const data = scriptJson(context);
  return `<script>(function(){
var ctx=${data};
var pending={};var seq=0;var engaged=false;
function post(msg){try{window.parent.postMessage(msg,"*")}catch(e){}}
function ask(type,extra){return new Promise(function(resolve){var id="r"+(++seq);pending[id]=resolve;var msg={source:"segmiq-funnel",type:type,id:id};if(extra)for(var k in extra)msg[k]=extra[k];post(msg);setTimeout(function(){if(pending[id]){delete pending[id];resolve({ok:false,error:"No response. Please try again or use WhatsApp."})}},20000)})}
function waLink(text){var p=ctx.contact.phone;if(!p)return null;return "https://wa.me/"+p+(text?"?text="+encodeURIComponent(text):"")}
function track(type){if(type==="engaged_view"){if(engaged)return;engaged=true}post({source:"segmiq-funnel",type:"event",event:type})}
function submit(fields){return ask("submit",{fields:fields||{}})}
function openViewing(){return ask("open-viewing")}
window.addEventListener("message",function(e){if(e.source!==window.parent)return;var d=e.data||{};if(d.source!=="segmiq-host"||d.type!=="result"||!pending[d.id])return;var done=pending[d.id];delete pending[d.id];done(d.result||{ok:false})});
document.addEventListener("click",function(e){var a=e.target&&e.target.closest?e.target.closest("a[href]"):null;if(!a)return;var h=a.getAttribute("href")||"";if(/^https:\\/\\/(wa\\.me|api\\.whatsapp\\.com)\\//.test(h))track("whatsapp_click")},true);
setTimeout(function(){track("engaged_view")},20000);
window.addEventListener("scroll",function(){var d=document.documentElement;if(d.scrollHeight>0&&(window.scrollY+window.innerHeight)/d.scrollHeight>0.6)track("engaged_view")},{passive:true});
window.SegmiQ={agent:ctx.agent,agency:ctx.agency,contact:ctx.contact,property:ctx.property,preview:ctx.preview,whatsappLink:waLink,submit:submit,openViewing:openViewing,track:track};
})();</script>`;
}

/** Puts the bridge before any funnel script runs. */
export function renderFunnelDocument(html: string, context: FunnelContext): string {
  const filled = fillPlaceholders(html, placeholderValues(context));
  const inject = `<meta name="robots" content="noindex">${bridgeScript(context)}`;
  const head = filled.match(/<head(\s[^>]*)?>/i);
  if (head && head.index != null) {
    const at = head.index + head[0].length;
    return `${filled.slice(0, at)}${inject}${filled.slice(at)}`;
  }
  return `<!doctype html><html><head>${inject}</head><body>${filled}</body></html>`;
}

export const FUNNEL_FRAME_SANDBOX = "allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox";
