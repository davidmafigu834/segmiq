"use client";

import { useEffect, useState } from "react";
import { MailCheck } from "lucide-react";
import { PremiumSheet } from "@/components/sales/PremiumSheet";
import { Button, Field, Input } from "@/components/sales/ui";
import { useCompanyWorkspace } from "@/components/company/CompanyWorkspaceContext";

export function CompanyTeamInviteDialog({
  clientId,
  onClose,
  onInvited,
}: {
  clientId: string;
  onClose: () => void;
  onInvited: () => void;
}) {
  const { terminology, isRealEstate } = useCompanyWorkspace();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    email: string;
    emailSent: boolean;
    temporaryPassword?: string;
  } | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "SALESPERSON", name, email, phone }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        emailSent?: boolean;
        temporaryPassword?: string;
      };
      if (!res.ok) {
        setError(json.error ?? "Couldn't invite team member");
        return;
      }
      setResult({
        email,
        emailSent: json.emailSent === true,
        temporaryPassword: json.temporaryPassword,
      });
      onInvited();
    } catch {
      setError("Couldn't invite team member");
    } finally {
      setSaving(false);
    }
  }

  if (result) {
    return (
      <PremiumSheet
        title="Team member invited"
        onClose={onClose}
        size="md"
        footer={
          <div className="flex justify-end">
            <Button variant="primary" onClick={onClose}>
              Done
            </Button>
          </div>
        }
      >
        <p className="text-[13px] text-sales-text-secondary">
          Share these login details with {name || result.email}.
        </p>
        <p className="mt-3 text-[13px] text-sales-text-primary">Email: {result.email}</p>
        {result.temporaryPassword ? (
          <p className="mt-1 font-mono text-[13px] text-sales-text-primary">
            Password: {result.temporaryPassword}
          </p>
        ) : null}
        {result.emailSent ? (
          <p className="mt-2 flex items-center gap-1.5 text-[12px] text-sales-text-secondary">
            <MailCheck size={14} strokeWidth={1.8} /> Also emailed to {result.email}.
          </p>
        ) : (
          <p className="mt-2 text-[12px] text-sales-warning-fg">
            Email could not be sent — please share these credentials yourself.
          </p>
        )}
      </PremiumSheet>
    );
  }

  return (
    <PremiumSheet
      title={isRealEstate ? "Invite agent" : "Invite salesperson"}
      description={
        isRealEstate
          ? `Add an ${terminology.salesperson.singular.toLowerCase()} so they can manage inquiries and viewings in SegmiQ.`
          : "Add a salesperson so they can manage Leads, Deals and Goals in SegmiQ."
      }
      onClose={onClose}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Inviting…" : "Invite"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Name" htmlFor="invite-name">
          <Input id="invite-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Email" htmlFor="invite-email">
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Phone (optional)" htmlFor="invite-phone" optional>
          <Input
            id="invite-phone"
            inputMode="tel"
            placeholder="+263…"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </Field>
        {error ? <p className="text-[13px] text-sales-danger">{error}</p> : null}
      </div>
    </PremiumSheet>
  );
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const apply = () => setMatches(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [query]);
  return matches;
}
