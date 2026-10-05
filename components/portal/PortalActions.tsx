"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PORTAL_SUPPORT_CATEGORIES, PORTAL_UPGRADE_INTENTS } from "@/lib/portal/rules";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="min-h-11 text-[14px] font-medium text-sales-text-secondary"
      onClick={async () => {
        await fetch("/api/portal/logout", { method: "POST" });
        router.push("/portal/enter");
        router.refresh();
      }}
    >
      Log out
    </button>
  );
}

export function EnterForm({ token }: { token: string | null }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(action: "start" | "verify") {
    setBusy(true);
    setError("");
    const res = await fetch("/api/portal/otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, inviteToken: token, phone: phone || null, code }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Try again in a moment.");
      return;
    }
    if (action === "start") setSent(true);
    else {
      router.push("/portal");
      router.refresh();
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(sent ? "verify" : "start");
      }}
    >
      {token ? null : (
        <label className="block text-sm font-medium">
          Mobile number
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            inputMode="tel"
            autoComplete="tel"
            required
            className="mt-2 block min-h-12 w-full rounded-sales-md border border-sales-border bg-sales-surface px-4 text-[16px]"
          />
        </label>
      )}
      {sent ? (
        <label className="block text-sm font-medium">
          Verification code
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            className="mt-2 block min-h-12 w-full rounded-sales-md border border-sales-border bg-sales-surface px-4 text-[16px] tracking-[0.3em]"
          />
        </label>
      ) : null}
      {error ? <p className="text-[14px] text-sales-danger-fg">{error}</p> : null}
      <button type="submit" disabled={busy} className="min-h-12 w-full rounded-sales-md bg-segmiq-lime text-[15px] font-semibold text-sales-text-primary">
        {sent ? "Open portal" : "Send code"}
      </button>
    </form>
  );
}

export function ProofForm({ projectId, currency }: { projectId: string; currency: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        const form = new FormData(event.currentTarget);
        const res = await fetch(`/api/portal/projects/${projectId}/proof`, { method: "POST", body: form });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setBusy(false);
        if (!res.ok) {
          setError(data.error || "The proof could not be sent.");
          return;
        }
        setDone(true);
        router.refresh();
      }}
    >
      <label className="block text-[14px] text-sales-text-secondary">Amount ({currency})
        <input name="amount" type="number" min="0.01" step="0.01" required className="mt-1 min-h-12 w-full rounded-sales-md border border-sales-border bg-sales-surface px-4 text-[16px] text-sales-text-primary" />
      </label>
      <label className="block text-[14px] text-sales-text-secondary">Method
      <select name="method" className="mt-1 min-h-12 w-full rounded-sales-md border border-sales-border bg-sales-surface px-4 text-[16px] text-sales-text-primary">
        <option value="BANK_TRANSFER">Bank transfer</option>
        <option value="MOBILE_MONEY">Mobile money</option>
        <option value="CASH">Cash</option>
        <option value="CARD">Card</option>
        <option value="OTHER">Other</option>
      </select>
      </label>
      <label className="block text-[14px] text-sales-text-secondary">Reference
        <input name="reference" className="mt-1 min-h-12 w-full rounded-sales-md border border-sales-border bg-sales-surface px-4 text-[16px] text-sales-text-primary" />
      </label>
      <label className="flex min-h-24 cursor-pointer items-center justify-center rounded-sales-md border border-dashed border-sales-border text-[16px] font-semibold">
        Add proof
        <input name="file" type="file" required accept="image/*,.pdf" className="sr-only" />
      </label>
      {error ? <p className="text-[14px] text-sales-danger-fg">{error}</p> : null}
      {done ? <p className="text-[14px] text-sales-text-secondary">Sent for review. It will show as received once the company confirms it.</p> : null}
      <button type="submit" disabled={busy} className="min-h-12 w-full rounded-sales-md bg-segmiq-lime text-[15px] font-semibold text-sales-text-primary">
        Upload payment proof
      </button>
    </form>
  );
}

export function SupportForm({
  projectId,
  assets,
}: {
  projectId?: string | null;
  assets: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        const form = new FormData(event.currentTarget);
        const res = await fetch("/api/portal/support", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: projectId || null,
            assetId: String(form.get("assetId") || "") || null,
            category: String(form.get("category") || "TECHNICAL"),
            message: String(form.get("message") || ""),
          }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          setError(data.error || "The request could not be sent.");
          return;
        }
        setDone(true);
        router.refresh();
      }}
    >
      <label className="block text-[14px] text-sales-text-secondary">What do you need?
      <select name="category" className="mt-1 min-h-12 w-full rounded-sales-md border border-sales-border bg-sales-surface px-4 text-[16px] text-sales-text-primary">
        {PORTAL_SUPPORT_CATEGORIES.map((item) => (
          <option key={item.id} value={item.id}>{item.label}</option>
        ))}
      </select>
      </label>
      <label className="block text-[14px] text-sales-text-secondary">Which item needs help?
      <select name="assetId" className="mt-1 min-h-12 w-full rounded-sales-md border border-sales-border bg-sales-surface px-4 text-[16px] text-sales-text-primary">
        <option value="">Not sure</option>
        {assets.map((asset) => (
          <option key={asset.id} value={asset.id}>{asset.name}</option>
        ))}
      </select>
      </label>
      <label className="block text-[14px] text-sales-text-secondary">What is happening?
        <textarea name="message" required minLength={4} rows={4} className="mt-1 w-full rounded-sales-md border border-sales-border bg-sales-surface px-4 py-3 text-[16px] text-sales-text-primary" />
      </label>
      {error ? <p className="text-[14px] text-sales-danger-fg">{error}</p> : null}
      {done ? <p className="text-[14px] text-sales-text-secondary">Received. The company can see this request.</p> : null}
      <button type="submit" className="min-h-12 w-full rounded-sales-md bg-segmiq-lime text-[15px] font-semibold text-sales-text-primary">Send request</button>
    </form>
  );
}

export function UpgradeForm({ projectId }: { projectId?: string | null }) {
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const res = await fetch("/api/portal/upgrades", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: projectId || null,
            intent: String(form.get("intent") || ""),
            detail: String(form.get("detail") || ""),
          }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          setError(data.error || "The request could not be sent.");
          return;
        }
        setDone(true);
      }}
    >
      <label className="block text-[14px] text-sales-text-secondary">What would help?
      <select name="intent" className="mt-1 min-h-12 w-full rounded-sales-md border border-sales-border bg-sales-surface px-4 text-[16px] text-sales-text-primary">
        {PORTAL_UPGRADE_INTENTS.map((intent) => (
          <option key={intent} value={intent}>{intent}</option>
        ))}
      </select>
      </label>
      <label className="block text-[14px] text-sales-text-secondary">Anything else
        <textarea name="detail" rows={3} className="mt-1 w-full rounded-sales-md border border-sales-border bg-sales-surface px-4 py-3 text-[16px] text-sales-text-primary" />
      </label>
      {error ? <p className="text-[14px] text-sales-danger-fg">{error}</p> : null}
      {done ? <p className="text-[14px] text-sales-text-secondary">Request sent. Someone from the company will follow up. Your installed system is unchanged.</p> : null}
      <button type="submit" className="min-h-12 w-full rounded-sales-md bg-segmiq-lime text-[15px] font-semibold text-sales-text-primary">Request an upgrade</button>
    </form>
  );
}
