"use client";

import { useState } from "react";
import { Check, Link2, X } from "lucide-react";

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM7.119 20.452H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

export default function ShareButtons({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const encoded = encodeURIComponent(url);
  const text = encodeURIComponent(title);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-bold uppercase tracking-wider text-[#888] dark:text-white/45 mr-1">Share</span>
      <a
        href={`https://twitter.com/intent/tweet?url=${encoded}&text=${text}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on X"
        className="w-8 h-8 rounded-full border border-black/10 dark:border-white/15 grid place-items-center text-[#666] dark:text-white/60 hover:border-black/20 dark:hover:border-white/25 hover:text-black dark:hover:text-white transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </a>
      <a
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encoded}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on LinkedIn"
        className="w-8 h-8 rounded-full border border-black/10 dark:border-white/15 grid place-items-center text-[#666] dark:text-white/60 hover:border-black/20 dark:hover:border-white/25 hover:text-black dark:hover:text-white transition-colors"
      >
        <LinkedInIcon className="w-3.5 h-3.5" />
      </a>
      <button
        type="button"
        onClick={copyLink}
        aria-label="Copy link"
        className="w-8 h-8 rounded-full border border-black/10 dark:border-white/15 grid place-items-center text-[#666] dark:text-white/60 hover:border-black/20 dark:hover:border-white/25 hover:text-black dark:hover:text-white transition-colors"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Link2 className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}
