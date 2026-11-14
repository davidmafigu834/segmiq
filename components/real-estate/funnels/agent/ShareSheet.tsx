"use client";

import { useState } from "react";
import { Copy, Download, MessageCircle } from "lucide-react";
import { bigBtn, bigLime, displayUrl, PropertyThumb, Sheet, useCopied } from "@/components/real-estate/funnels/agent/ui";

export type ShareProperty = {
  listingId: string;
  heading: string;
  suburb: string | null;
  priceLabel: string | null;
  imageUrl: string | null;
  shareTitle: string | null;
  shareSummary: string | null;
};

type Tone = "personal" | "investor" | "short";

function messageFor(tone: Tone, property: ShareProperty, me: { name: string; first: string }, agencyName: string, url: string) {
  const place = property.suburb && property.suburb !== property.heading ? ` in ${property.suburb}` : "";
  const price = property.priceLabel ? ` at ${property.priceLabel}` : "";
  const pitch = property.shareSummary ? ` ${property.shareSummary}` : "";
  if (tone === "investor") {
    return `${property.heading}${place ? `, ${property.suburb}` : ""}.${property.priceLabel ? ` Asking ${property.priceLabel}.` : ""}${pitch ? `\n\n${pitch.trim()}` : ""}\n\nFull details, photos and figures:\n${url}\n\n${me.name}, ${agencyName}`;
  }
  if (tone === "short") return `${property.heading} is for sale${price}. Have a look: ${url}`;
  return `Hi! It's ${me.first} from ${agencyName}.\n\n${property.heading}${place} is for sale${price}.${pitch}\n\nEverything is on one page:\n${url}\n\nReply here and I'll send you the details.`;
}

export function ShareSheet({ property, me, agencyName, url, onClose }: { property: ShareProperty; me: { name: string; first: string }; agencyName: string; url: string; onClose: () => void }) {
  const [tab, setTab] = useState<"message" | "status">("message");
  const [tone, setTone] = useState<Tone>("personal");
  const [text, setText] = useState(() => messageFor("personal", property, me, agencyName, url));
  const { copied, copy } = useCopied();
  const statusImage = `/api/sales/funnels/${property.listingId}/status-image`;

  function pickTone(next: Tone) {
    setTone(next);
    setText(messageFor(next, property, me, agencyName, url));
  }

  return (
    <Sheet title={`Share ${property.heading}`} onClose={onClose}>
      <div className="grid grid-cols-2 rounded-[10px] border border-sales-border-subtle bg-sales-bg p-1" role="tablist" aria-label="Share as">
        {(["message", "status"] as const).map((id) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`h-9 rounded-[8px] text-[13px] font-semibold transition-colors ${tab === id ? "bg-sales-surface text-sales-text-primary shadow-sm" : "text-sales-text-muted"}`}>
            {id === "message" ? "Message" : "Status image"}
          </button>
        ))}
      </div>

      {tab === "message" ? (
        <div className="mt-4 space-y-4">
          <figure className="overflow-hidden rounded-[10px] border border-sales-border-subtle bg-sales-bg">
            <PropertyThumb src={property.imageUrl} className="aspect-[1.91/1] w-full" />
            <figcaption className="px-3 py-2.5">
              <p className="text-[13px] font-semibold leading-5">{property.shareTitle || property.heading}</p>
              {property.shareSummary ? <p className="mt-0.5 text-[12px] text-sales-text-muted">{property.shareSummary}</p> : null}
              <p className="mt-1 text-[12px] text-sales-text-muted">{displayUrl(url).split("/")[0]}</p>
            </figcaption>
          </figure>
          <p className="text-[12px] text-sales-text-muted">WhatsApp shows this card under your message. The page itself opens with your name and number on it.</p>

          <div className="flex flex-wrap gap-2" role="group" aria-label="Message style">
            {(["personal", "investor", "short"] as const).map((id) => (
              <button key={id} type="button" aria-pressed={tone === id} onClick={() => pickTone(id)} className={`inline-flex h-9 items-center rounded-full px-3 text-[13px] font-medium ${tone === id ? "bg-sales-text-primary text-sales-surface" : "border border-sales-border text-sales-text-secondary"}`}>
                {id === "personal" ? "Personal" : id === "investor" ? "For investors" : "Short"}
              </button>
            ))}
          </div>
          <label className="block">
            <span className="text-[13px] font-medium">Message</span>
            <textarea value={text} onChange={(event) => setText(event.target.value)} rows={8} className="mt-1.5 w-full rounded-[10px] border border-sales-border bg-sales-bg px-3 py-2.5 text-[14px] leading-6" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" className={bigLime}>
              <MessageCircle size={16} strokeWidth={2} aria-hidden />
              Send on WhatsApp
            </a>
            <button type="button" className={bigBtn} onClick={() => void copy("msg", text)}>
              <Copy size={16} strokeWidth={2} aria-hidden />
              {copied === "msg" ? "Copied" : "Copy message"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={statusImage} alt={`Status image for ${property.heading}`} className="aspect-[9/16] w-[220px] rounded-[12px] border border-sales-border-subtle bg-sales-bg object-cover" />
          </div>
          <p className="text-center text-[12px] text-sales-text-muted">Post it to your Status, then paste your link as the caption.</p>
          <div className="grid grid-cols-2 gap-2">
            <a href={statusImage} download className={bigLime}>
              <Download size={16} strokeWidth={2} aria-hidden />
              Save image
            </a>
            <button type="button" className={bigBtn} onClick={() => void copy("link", url)}>
              <Copy size={16} strokeWidth={2} aria-hidden />
              {copied === "link" ? "Copied" : "Copy link"}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
