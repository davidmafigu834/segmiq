"use client";

import { useEffect, useRef } from "react";
import { FUNNEL_FRAME_SANDBOX } from "@/lib/real-estate/funnels/policy";

type SubmitFields = {
  kind?: unknown;
  name?: unknown;
  phone?: unknown;
  message?: unknown;
  preferredAt?: unknown;
  contactMethod?: unknown;
  website?: unknown;
  companyWebsiteConfirm?: unknown;
};

type Result = { ok: boolean; message?: string; error?: string; path?: string };

function str(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function honeypot(fields: SubmitFields): string {
  return str(fields.companyWebsiteConfirm, 200) || str(fields.website, 200);
}

function idempotencyKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? `funnel:${crypto.randomUUID()}` : `funnel:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

/** Hosts a bespoke funnel in an opaque-origin frame and relays its forms to the same listing-page APIs as PublicListingPage. */
export function FunnelFrame({ slug, token, title, src, preview = false }: { slug: string; token: string | null; title: string; src: string; preview?: boolean }) {
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const seen = new Set<string>();

    async function submit(fields: SubmitFields): Promise<Result> {
      if (preview) return { ok: true, message: "Preview only. Nothing was sent." };
      const viewing = fields.kind === "viewing_request" && str(fields.preferredAt, 40);
      const message = str(fields.message, 2000) || null;
      const trap = honeypot(fields) || undefined;
      const body = viewing
        ? { slug, token, name: str(fields.name, 120), phone: str(fields.phone, 40), message, preferredAt: str(fields.preferredAt, 40), companyWebsiteConfirm: trap }
        : {
            slug,
            token,
            name: str(fields.name, 120),
            phone: str(fields.phone, 40),
            message,
            contactMethod: ["phone", "whatsapp", "either"].includes(String(fields.contactMethod)) ? fields.contactMethod : null,
            companyWebsiteConfirm: trap,
          };
      try {
        const response = await fetch(`/api/public/listing-pages/${viewing ? "viewing" : "enquiry"}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey() },
          body: JSON.stringify(body),
        });
        const payload = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
        return response.ok ? { ok: true, message: payload.message } : { ok: false, error: payload.error ?? "Could not send. Please try again." };
      } catch {
        return { ok: false, error: "No connection. Please try again." };
      }
    }

    /** Same path as PublicListingPage: open the journey viewing form in this window. */
    async function openViewing(): Promise<Result> {
      if (preview) return { ok: false, error: "Preview only. The viewing form is not opened here." };
      try {
        const response = await fetch("/api/public/listing-pages/viewing-form", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, token, companyWebsiteConfirm: "" }),
        });
        const payload = (await response.json().catch(() => ({}))) as { path?: string; error?: string };
        if (!response.ok || !payload.path || !/^\/journey\/[A-Za-z0-9_-]+$/.test(payload.path)) {
          return { ok: false, error: payload.error ?? "A viewing form is not available for this property yet." };
        }
        window.location.assign(payload.path);
        return { ok: true, path: payload.path };
      } catch {
        return { ok: false, error: "No connection. Please try again." };
      }
    }

    function record(event: string) {
      if (preview || (event !== "whatsapp_click" && event !== "engaged_view")) return;
      if (event === "engaged_view" && seen.has(event)) return;
      seen.add(event);
      void fetch("/api/public/listing-pages/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, token, eventType: event }),
        keepalive: true,
      }).catch(() => undefined);
    }

    function reply(target: Window, id: string, result: Result) {
      target.postMessage({ source: "segmiq-host", type: "result", id, result }, "*");
    }

    function onMessage(event: MessageEvent) {
      const target = frame.current?.contentWindow;
      if (!target || event.source !== target) return;
      const data = event.data as { source?: string; type?: string; id?: unknown; event?: unknown; fields?: SubmitFields } | null;
      if (!data || data.source !== "segmiq-funnel") return;
      if (data.type === "event") {
        record(String(data.event));
        return;
      }
      if (typeof data.id !== "string") return;
      const id = data.id.slice(0, 40);
      if (data.type === "submit") {
        void submit(data.fields ?? {}).then((result) => reply(target, id, result));
        return;
      }
      if (data.type === "open-viewing") {
        void openViewing().then((result) => reply(target, id, result));
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [slug, token, preview]);

  return (
    <iframe
      ref={frame}
      title={title}
      src={src}
      sandbox={FUNNEL_FRAME_SANDBOX}
      referrerPolicy="strict-origin-when-cross-origin"
      className="block h-full w-full border-0"
    />
  );
}
