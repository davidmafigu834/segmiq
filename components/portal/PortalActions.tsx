"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PORTAL_SUPPORT_CATEGORIES, PORTAL_UPGRADE_INTENTS } from "@/lib/portal/rules";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="text-sm text-[#5c665f]"
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
            className="mt-2 block min-h-12 w-full rounded-2xl border border-[#e4ddd0] bg-white px-4 text-base"
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
            className="mt-2 block min-h-12 w-full rounded-2xl border border-[#e4ddd0] bg-white px-4 text-base tracking-[0.3em]"
          />
        </label>
      ) : null}
      {error ? <p className="text-sm text-[#8a3b2d]">{error}</p> : null}
      <button type="submit" disabled={busy} className="min-h-12 w-full rounded-full bg-[#0f6b4c] text-sm font-semibold text-white">
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
      <input name="amount" type="number" min="0.01" step="0.01" required placeholder={`Amount (${currency})`} className="min-h-12 w-full rounded-2xl border border-[#e4ddd0] bg-white px-4" />
      <select name="method" className="min-h-12 w-full rounded-2xl border border-[#e4ddd0] bg-white px-4">
        <option value="BANK_TRANSFER">Bank transfer</option>
        <option value="MOBILE_MONEY">Mobile money</option>
        <option value="CASH">Cash</option>
        <option value="CARD">Card</option>
        <option value="OTHER">Other</option>
      </select>
      <input name="reference" placeholder="Reference, if you have one" className="min-h-12 w-full rounded-2xl border border-[#e4ddd0] bg-white px-4" />
      <input name="file" type="file" required accept="image/*,.pdf" className="block w-full text-sm" />
      {error ? <p className="text-sm text-[#8a3b2d]">{error}</p> : null}
      {done ? <p className="text-sm text-[#0f6b4c]">Sent for review. It will show as received once the company confirms it.</p> : null}
      <button type="submit" disabled={busy} className="min-h-12 w-full rounded-full bg-[#1a1f1c] text-sm font-semibold text-white">
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
      <select name="category" className="min-h-12 w-full rounded-2xl border border-[#e4ddd0] bg-white px-4">
        {PORTAL_SUPPORT_CATEGORIES.map((item) => (
          <option key={item.id} value={item.id}>{item.label}</option>
        ))}
      </select>
      <select name="assetId" className="min-h-12 w-full rounded-2xl border border-[#e4ddd0] bg-white px-4">
        <option value="">Not sure</option>
        {assets.map((asset) => (
          <option key={asset.id} value={asset.id}>{asset.name}</option>
        ))}
      </select>
      <textarea name="message" required minLength={4} rows={4} placeholder="Tell us what is happening" className="w-full rounded-2xl border border-[#e4ddd0] bg-white px-4 py-3" />
      {error ? <p className="text-sm text-[#8a3b2d]">{error}</p> : null}
      {done ? <p className="text-sm text-[#0f6b4c]">Received. The company can see this request.</p> : null}
      <button type="submit" className="min-h-12 w-full rounded-full bg-[#0f6b4c] text-sm font-semibold text-white">Send request</button>
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
      <select name="intent" className="min-h-12 w-full rounded-2xl border border-[#e4ddd0] bg-white px-4">
        {PORTAL_UPGRADE_INTENTS.map((intent) => (
          <option key={intent} value={intent}>{intent}</option>
        ))}
      </select>
      <textarea name="detail" rows={3} placeholder="Anything else we should know" className="w-full rounded-2xl border border-[#e4ddd0] bg-white px-4 py-3" />
      {error ? <p className="text-sm text-[#8a3b2d]">{error}</p> : null}
      {done ? <p className="text-sm text-[#0f6b4c]">Request sent. Someone from the company will follow up. Your installed system is unchanged.</p> : null}
      <button type="submit" className="min-h-12 w-full rounded-full bg-[#1a1f1c] text-sm font-semibold text-white">Request upgrade</button>
    </form>
  );
}
