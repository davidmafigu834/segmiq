"use client";

import { useState } from "react";
import { createCampaignLink, createPersonalLink, useMarketingLinks } from "./marketing-links";

const limeBtn = "re-fill inline-flex h-11 items-center justify-center rounded-[10px] bg-sales-brand px-4 text-[14px] font-semibold text-sales-brand-text";
const lineBtn = "inline-flex h-11 items-center justify-center rounded-[10px] border border-sales-border bg-sales-bg px-4 text-[14px] font-semibold transition-colors hover:bg-sales-surface-hover";
const textBtn = "inline-flex h-11 items-center text-[13px] font-medium text-sales-text-secondary";

export function ListingLinks({ listingId, onOpenMarketing, onPreview }: { listingId: string; onOpenMarketing: () => void; onPreview: () => void }) {
  const links = useMarketingLinks().filter((link) => link.listingId === listingId);
  const personal = links.find((link) => link.campaign == null && !link.revoked) ?? null;
  const extra = links.filter((link) => link.campaign && !link.revoked);
  const revoked = links.filter((link) => link.revoked);
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(id: string, path: string) {
    try {
      await navigator.clipboard.writeText(path);
    } catch {
      /* The status still names the link. */
    }
    setCopied(id);
  }

  function addCampaign(event: React.FormEvent) {
    event.preventDefault();
    const result = createCampaignLink(listingId, label);
    if ("error" in result) {
      setError(result.error);
      setNotice(null);
      return;
    }
    setLabel("");
    setError(null);
    setNotice(`${result.link.campaign} is now with the other links.`);
  }

  return (
    <section className="re-mkt rounded-[12px] border border-sales-border bg-sales-surface px-4 py-4">
      <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Public page</h2>
      <p className="mt-1 max-w-[52ch] text-[13px] text-sales-text-secondary">Your links for this property. The agency keeps the listing. You keep the attribution.</p>

      {personal ? (
        <div className="mt-4 border-t border-sales-border-subtle pt-4">
          <p className="text-[13px] font-medium">Personal link</p>
          <p className="mt-1 break-all text-[13px] text-sales-text-secondary">{personal.path}</p>
          <div className="re-actions mt-3 flex flex-wrap gap-2">
            <button type="button" className={lineBtn} onClick={onPreview}>View page</button>
            <button type="button" className={lineBtn} onClick={() => void copy(personal.id, personal.path)}>{copied === personal.id ? "Link copied" : "Copy link"}</button>
            <button type="button" className={textBtn} onClick={onOpenMarketing}>All links</button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={`${limeBtn} mt-4`}
          onClick={() => {
            createPersonalLink(listingId);
            setNotice("The personal link is ready. It is listed on Marketing.");
          }}
        >
          {extra.length ? "Create personal link" : "Create link"}
        </button>
      )}

      {!personal ? (
        <button type="button" className={`${lineBtn} mt-3`} onClick={onPreview}>View page</button>
      ) : null}

      {extra.length ? (
        <ul className="mt-4 border-t border-sales-border-subtle">
          {extra.map((link) => (
            <li key={link.id} className="border-b border-sales-border-subtle py-3 last:border-0">
              <p className="text-[14px] font-semibold">{link.campaign}</p>
              <p className="mt-0.5 break-all text-[12px] text-sales-text-muted">{link.path}</p>
              <button type="button" className={`${textBtn} mt-1`} onClick={() => void copy(link.id, link.path)}>{copied === link.id ? "Link copied" : "Copy link"}</button>
            </li>
          ))}
        </ul>
      ) : null}

      {personal ? (
        <form className="mt-4 border-t border-sales-border-subtle pt-4" onSubmit={addCampaign}>
          <label className="block text-[13px] font-medium" htmlFor={`${listingId}-campaign`}>Another link</label>
          <p className="mt-1 text-[13px] text-sales-text-secondary">A campaign label keeps this share separate from the personal link.</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              id={`${listingId}-campaign`}
              value={label}
              maxLength={40}
              placeholder="Campaign label"
              onChange={(event) => {
                setLabel(event.target.value);
                if (error) setError(null);
              }}
              className="h-11 min-w-0 flex-1 rounded-[10px] border border-sales-border bg-sales-bg px-3 text-[14px]"
            />
            <button type="submit" className={lineBtn}>Add link</button>
          </div>
          {error ? <p className="mt-2 text-[13px] text-sales-danger-fg" role="alert">{error}</p> : null}
        </form>
      ) : null}

      {revoked.length ? (
        <p className="mt-4 text-[13px] text-sales-text-muted">{revoked.length === 1 ? "1 revoked link stays on the record." : `${revoked.length} revoked links stay on the record.`}</p>
      ) : null}
      {notice ? <p className="mt-3 text-[13px] text-sales-text-secondary" role="status">{notice}</p> : null}
    </section>
  );
}
