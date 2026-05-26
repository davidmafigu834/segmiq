"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type FacebookClientSnapshot = {
  fb_access_token: string | null;
  fb_access_token_expires_at: string | null;
  fb_ad_account_id: string | null;
  fb_page_id: string | null;
  fb_page_name: string | null;
  fb_form_id: string | null;
  fb_form_name: string | null;
  fb_webhook_verified: boolean | null;
  fb_token_expired_at: string | null;
  last_lead_received_at: string | null;
};

/** Stable key so we re-sync `snap` when RSC passes new `initial` after OAuth (object reference may not change). */
function facebookInitialSignature(i: FacebookClientSnapshot): string {
  return [
    i.fb_access_token ?? "",
    i.fb_ad_account_id ?? "",
    i.fb_page_id ?? "",
    i.fb_form_id ?? "",
    i.fb_token_expired_at ?? "",
    i.fb_access_token_expires_at ?? "",
    i.fb_page_name ?? "",
    i.fb_form_name ?? "",
    String(i.fb_webhook_verified),
    i.last_lead_received_at ?? "",
  ].join("\0");
}

type PageRow = { id: string; name: string };
type FormRow = { id: string; name: string; status?: string };
type AdAccountRow = { id: string; name: string; accountId: string };

function daysUntilExpiry(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M13.5 4.5L6.5 11.5L3 8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FacebookGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="40" height="40" aria-hidden>
      <circle cx="12" cy="12" r="12" fill="#1877F2" />
      <path
        d="M13.5 19v-6.2h2.1l.3-2.4H13.5V9.1c0-.7.2-1.2 1.3-1.2h1.4V5.9c-.2 0-1.1-.1-2.1-.1-2.1 0-3.5 1.3-3.5 3.6v2H8v2.4h2.6V19h2.9z"
        fill="#fff"
      />
    </svg>
  );
}

const steps = [
  { id: "connect", label: "Connect account" },
  { id: "adaccount", label: "Ad account" },
  { id: "page", label: "Select page" },
  { id: "form", label: "Select form" },
] as const;

export function FacebookConnectPanel({
  clientId,
  initial,
  lastFacebookLeadAt,
}: {
  clientId: string;
  initial: FacebookClientSnapshot;
  lastFacebookLeadAt: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [snap, setSnap] = useState(initial);
  const [banner, setBanner] = useState<string | null>(searchParams.get("fbError"));
  const [loadingPages, setLoadingPages] = useState(false);
  const [loadingForms, setLoadingForms] = useState(false);
  const [loadingAdAccounts, setLoadingAdAccounts] = useState(false);
  const [pages, setPages] = useState<PageRow[] | null>(null);
  const [forms, setForms] = useState<FormRow[] | null>(null);
  const [adAccounts, setAdAccounts] = useState<AdAccountRow[] | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [selectedAdAccountId, setSelectedAdAccountId] = useState<string | null>(null);
  const [savingPage, setSavingPage] = useState(false);
  const [savingForm, setSavingForm] = useState(false);
  const [savingAd, setSavingAd] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [backfillOpen, setBackfillOpen] = useState(false);
  const [backfillSince, setBackfillSince] = useState(() => {
    const d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [backfillMessage, setBackfillMessage] = useState<string | null>(null);
  const singleAdAutoTried = useRef(false);
  const oauthReturnRefreshDone = useRef(false);

  const initialSig = useMemo(() => facebookInitialSignature(initial), [initial]);

  const hasToken = Boolean(snap.fb_access_token);
  const hasAdAccount = Boolean(snap.fb_ad_account_id);
  const hasPage = Boolean(snap.fb_page_id);
  const hasForm = Boolean(snap.fb_form_id);
  const graphTokenRevoked = Boolean(snap.fb_token_expired_at);
  const daysLeft = daysUntilExpiry(snap.fb_access_token_expires_at);
  const expired = daysLeft !== null && daysLeft < 0;
  const warnExpiry = daysLeft !== null && daysLeft >= 0 && daysLeft < 7;
  const wiringComplete = hasToken && hasAdAccount && hasPage && hasForm;
  const fullyConfigured = wiringComplete && !expired && !graphTokenRevoked;

  useEffect(() => {
    setSnap(initial);
    singleAdAutoTried.current = false;
  }, [initialSig, initial]);

  const stepParam = searchParams.get("step");
  useEffect(() => {
    if (stepParam !== "adaccount" || oauthReturnRefreshDone.current) return;
    oauthReturnRefreshDone.current = true;
    router.refresh();
  }, [stepParam, router]);

  useEffect(() => {
    oauthReturnRefreshDone.current = false;
  }, [clientId]);

  useEffect(() => {
    const e = searchParams.get("fbError");
    if (e) setBanner(decodeURIComponent(e));
  }, [searchParams]);

  const activeStepIndex = useMemo(() => {
    if (graphTokenRevoked) return 0;
    if (expired) return 0;
    if (fullyConfigured) return -1;
    if (!hasToken) return 0;
    if (!hasAdAccount) return 1;
    if (!hasPage) return 2;
    if (!hasForm) return 3;
    return -1;
  }, [graphTokenRevoked, expired, fullyConfigured, hasToken, hasAdAccount, hasPage, hasForm]);

  const loadAdAccounts = useCallback(async () => {
    setLoadingAdAccounts(true);
    setApiError(null);
    try {
      const res = await fetch(`/api/facebook/ad-accounts?clientId=${encodeURIComponent(clientId)}`);
      const data = (await res.json()) as { accounts?: AdAccountRow[]; error?: string };
      if (!res.ok) {
        setApiError(data.error ?? "Failed to load ad accounts");
        setAdAccounts([]);
        return;
      }
      setAdAccounts(data.accounts ?? []);
    } catch {
      setApiError("Network error loading ad accounts");
      setAdAccounts([]);
    } finally {
      setLoadingAdAccounts(false);
    }
  }, [clientId]);

  const loadPages = useCallback(async () => {
    setLoadingPages(true);
    setApiError(null);
    try {
      const res = await fetch(`/api/facebook/pages?clientId=${encodeURIComponent(clientId)}`);
      const data = (await res.json()) as { pages?: PageRow[]; error?: string };
      if (!res.ok) {
        setApiError(data.error ?? "Failed to load pages");
        setPages([]);
        return;
      }
      setPages(data.pages ?? []);
    } catch {
      setApiError("Network error loading pages");
      setPages([]);
    } finally {
      setLoadingPages(false);
    }
  }, [clientId]);

  const loadForms = useCallback(async () => {
    setLoadingForms(true);
    setApiError(null);
    try {
      const res = await fetch(`/api/facebook/forms?clientId=${encodeURIComponent(clientId)}`);
      const data = (await res.json()) as { forms?: FormRow[]; error?: string };
      if (!res.ok) {
        setApiError(data.error ?? "Failed to load forms");
        setForms([]);
        return;
      }
      setForms(data.forms ?? []);
    } catch {
      setApiError("Network error loading forms");
      setForms([]);
    } finally {
      setLoadingForms(false);
    }
  }, [clientId]);

  useEffect(() => {
    if (hasToken && !hasAdAccount && !expired && !graphTokenRevoked) {
      void loadAdAccounts();
    }
  }, [hasToken, hasAdAccount, expired, graphTokenRevoked, loadAdAccounts]);

  useEffect(() => {
    if (hasToken && hasAdAccount && !hasPage && !expired && !graphTokenRevoked) {
      void loadPages();
    }
  }, [hasToken, hasAdAccount, hasPage, expired, graphTokenRevoked, loadPages]);

  useEffect(() => {
    if (hasPage && !hasForm && !expired && !graphTokenRevoked) {
      void loadForms();
    }
  }, [hasPage, hasForm, expired, graphTokenRevoked, loadForms]);

  useEffect(() => {
    if (
      graphTokenRevoked ||
      expired ||
      hasAdAccount ||
      !adAccounts ||
      adAccounts.length !== 1 ||
      savingAd ||
      singleAdAutoTried.current
    ) {
      return;
    }
    singleAdAutoTried.current = true;
    const id = adAccounts[0].id;
    void (async () => {
      setSavingAd(true);
      setApiError(null);
      try {
        const res = await fetch("/api/facebook/ad-accounts/select", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId, adAccountId: id }),
        });
        const data = (await res.json()) as { ok?: boolean; fb_ad_account_id?: string; error?: string };
        if (!res.ok) {
          singleAdAutoTried.current = false;
          setApiError(data.error ?? "Could not save ad account");
          return;
        }
        setSnap((s) => ({ ...s, fb_ad_account_id: data.fb_ad_account_id ?? id }));
        router.replace(`/dashboard/clients/${clientId}/facebook?step=page`);
        router.refresh();
      } finally {
        setSavingAd(false);
      }
    })();
  }, [graphTokenRevoked, expired, hasAdAccount, adAccounts, savingAd, clientId, router]);

  async function onSelectAdAccount() {
    if (!selectedAdAccountId) return;
    setSavingAd(true);
    setApiError(null);
    try {
      const res = await fetch("/api/facebook/ad-accounts/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, adAccountId: selectedAdAccountId }),
      });
      const data = (await res.json()) as { ok?: boolean; fb_ad_account_id?: string; error?: string };
      if (!res.ok) {
        setApiError(data.error ?? "Could not save ad account");
        return;
      }
      setSnap((s) => ({ ...s, fb_ad_account_id: data.fb_ad_account_id ?? selectedAdAccountId }));
      router.replace(`/dashboard/clients/${clientId}/facebook?step=page`);
      router.refresh();
    } finally {
      setSavingAd(false);
    }
  }

  async function onSelectPage() {
    if (!selectedPageId) return;
    setSavingPage(true);
    setApiError(null);
    try {
      const res = await fetch("/api/facebook/pages/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, pageId: selectedPageId }),
      });
      const data = (await res.json()) as { ok?: boolean; pageName?: string; error?: string };
      if (!res.ok) {
        setApiError(data.error ?? "Could not save page");
        return;
      }
      setSnap((s) => ({
        ...s,
        fb_page_id: selectedPageId,
        fb_page_name: data.pageName ?? s.fb_page_name,
      }));
      router.replace(`/dashboard/clients/${clientId}/facebook?step=form`);
      router.refresh();
    } finally {
      setSavingPage(false);
    }
  }

  async function onSelectForm() {
    if (!selectedFormId || !forms) return;
    const f = forms.find((x) => x.id === selectedFormId);
    setSavingForm(true);
    setApiError(null);
    try {
      const res = await fetch("/api/facebook/forms/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          formId: selectedFormId,
          formName: f?.name ?? null,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setApiError(data.error ?? "Could not save form");
        return;
      }
      setSnap((s) => ({
        ...s,
        fb_form_id: selectedFormId,
        fb_form_name: f?.name ?? null,
      }));
      router.replace(`/dashboard/clients/${clientId}/facebook`);
      router.refresh();
    } finally {
      setSavingForm(false);
    }
  }

  async function onDisconnect() {
    if (!confirm("Disconnect Facebook for this client?")) return;
    const res = await fetch("/api/facebook/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setApiError(data.error ?? "Disconnect failed");
      return;
    }
    setSnap({
      fb_access_token: null,
      fb_access_token_expires_at: null,
      fb_ad_account_id: null,
      fb_page_id: null,
      fb_page_name: null,
      fb_form_id: null,
      fb_form_name: null,
      fb_webhook_verified: false,
      fb_token_expired_at: null,
      last_lead_received_at: null,
    });
    setPages(null);
    setForms(null);
    setAdAccounts(null);
    setSelectedPageId(null);
    setSelectedFormId(null);
    setSelectedAdAccountId(null);
    singleAdAutoTried.current = false;
    router.replace(`/dashboard/clients/${clientId}/facebook`);
    router.refresh();
  }

  const oauthStart = `/api/facebook/oauth/start?clientId=${encodeURIComponent(clientId)}`;
  const oauthReconnect = `${oauthStart}&reconnect=1`;

  async function onBackfillConfirm() {
    setBackfillLoading(true);
    setBackfillMessage(null);
    try {
      const res = await fetch("/api/facebook/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          sinceIso: new Date(backfillSince).toISOString(),
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        created?: number;
        duplicates?: number;
        failed?: number;
        error?: string;
        tokenExpired?: boolean;
      };
      if (!res.ok) {
        setBackfillMessage(
          data.tokenExpired
            ? `${data.error ?? "Request failed"} Reconnect Facebook to restore access.`
            : (data.error ?? "Backfill failed")
        );
        return;
      }
      setBackfillMessage(
        `Imported ${data.created ?? 0} new leads. ${data.duplicates ?? 0} already existed. ${data.failed ?? 0} failed.`
      );
      setBackfillOpen(false);
      router.refresh();
    } catch {
      setBackfillMessage("Network error");
    } finally {
      setBackfillLoading(false);
    }
  }

  function stepperIndexClass(idx: number): string {
    const done =
      !graphTokenRevoked &&
      ((idx === 0 && hasToken) ||
        (idx === 1 && hasAdAccount) ||
        (idx === 2 && hasPage) ||
        (idx === 3 && hasForm));
    const active = !expired && !graphTokenRevoked && activeStepIndex === idx;
    const locked =
      !expired &&
      !graphTokenRevoked &&
      ((idx === 1 && !hasToken) || (idx === 2 && !hasAdAccount) || (idx === 3 && !hasPage));
    return [
      "relative border-l-2 pl-4 py-3 text-sm transition-colors",
      done ? "text-ink-primary" : locked ? "text-ink-tertiary opacity-60" : "text-ink-secondary",
      active ? "border-[var(--accent)]" : "border-border",
    ].join(" ");
  }

  return (
    <div className="flex flex-col gap-8 layout:flex-row layout:items-start">
      <nav className="w-full shrink-0 layout:w-[200px]" aria-label="Facebook setup steps">
        {steps.map((s, idx) => {
          const done =
            !graphTokenRevoked &&
            ((idx === 0 && hasToken) ||
              (idx === 1 && hasAdAccount) ||
              (idx === 2 && hasPage) ||
              (idx === 3 && hasForm));
          return (
            <div key={s.id} className={stepperIndexClass(idx)}>
              <div className="flex items-center gap-2 font-medium">
                {done ? (
                  <span className="text-[var(--success)]">
                    <CheckIcon className="inline" />
                  </span>
                ) : null}
                {s.label}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="min-w-0 flex-1 space-y-6">
        {(banner || apiError) && (
          <div
            className="flex flex-col gap-3 border border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger-fg)] sm:flex-row sm:items-center sm:justify-between"
            role="alert"
          >
            <span>
              Facebook connection error: {banner || apiError}. Please reconnect.
            </span>
            <div className="flex gap-2">
              <a
                href={oauthReconnect}
                className="inline-flex items-center justify-center rounded-md border border-border-strong bg-surface-card px-3 py-1.5 text-xs font-medium text-ink-primary hover:border-border-dark"
              >
                Reconnect
              </a>
              <button
                type="button"
                className="text-xs underline"
                onClick={() => {
                  setBanner(null);
                  setApiError(null);
                  router.replace(`/dashboard/clients/${clientId}/facebook`);
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {graphTokenRevoked && (
          <div className="border border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-5 text-sm text-[var(--danger-fg)]">
            <p className="font-semibold">Connection expired</p>
            <p className="mt-2 text-ink-secondary">
              Leads from this Facebook form are not flowing into Segmiq until you reconnect. Meta rejected the saved
              access token.
            </p>
            <a
              href={oauthReconnect}
              className="mt-4 inline-flex items-center justify-center rounded-md bg-[var(--danger-border)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-95"
            >
              Reconnect with Facebook
            </a>
            <button
              type="button"
              onClick={() => void onDisconnect()}
              className="ml-3 mt-4 inline-flex items-center justify-center rounded-md border border-border-strong bg-surface-card px-4 py-2 text-sm text-ink-primary"
            >
              Disconnect
            </button>
          </div>
        )}

        {!graphTokenRevoked && expired && (
          <div className="border border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-4 text-sm text-[var(--danger-fg)]">
            <p className="font-medium">Facebook access expired</p>
            <p className="mt-1 text-ink-secondary">Reconnect to restore lead delivery.</p>
            <a
              href={oauthReconnect}
              className="mt-3 inline-flex items-center justify-center rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-accent-ink"
            >
              Reconnect with Facebook
            </a>
          </div>
        )}

        {fullyConfigured && (
          <div className="border border-border bg-surface-card p-8 shadow-sm">
            <h3 className="font-display text-xl text-ink-primary">Facebook connected</h3>
            <div className="mt-6 space-y-4 text-sm">
              <div className="flex flex-wrap gap-x-8 gap-y-2">
                <div>
                  <p className="font-mono text-[11px] uppercase text-ink-tertiary">Ad account</p>
                  <p className="font-display text-lg text-ink-primary">{snap.fb_ad_account_id}</p>
                </div>
                <div>
                  <p className="font-mono text-[11px] uppercase text-ink-tertiary">Page</p>
                  <p className="font-display text-lg text-ink-primary">{snap.fb_page_name ?? snap.fb_page_id}</p>
                </div>
                <div>
                  <p className="font-mono text-[11px] uppercase text-ink-tertiary">Lead form</p>
                  <p className="font-display text-lg text-ink-primary">
                    {snap.fb_form_name ?? snap.fb_form_id}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <span className="inline-flex items-center gap-2 text-[var(--success)]">
                  <span className="h-2 w-2 rounded-full bg-[var(--success)]" />
                  Webhook {snap.fb_webhook_verified ? "active" : "pending"}
                </span>
                <span className="text-ink-secondary">
                  Last Facebook lead: {formatWhen(lastFacebookLeadAt ?? snap.last_lead_received_at)}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={
                    warnExpiry || (daysLeft !== null && daysLeft < 0)
                      ? "text-[var(--warning)]"
                      : "text-ink-secondary"
                  }
                >
                  Token expires in {daysLeft ?? "—"} days
                  {warnExpiry ? " — Reconnect soon to avoid interruption." : null}
                </span>
              </div>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void onDisconnect()}
                className="inline-flex items-center justify-center rounded-md border border-border px-4 py-2 text-sm text-ink-secondary hover:border-border-strong hover:text-ink-primary"
              >
                Disconnect
              </button>
              <button
                type="button"
                onClick={() => {
                  setBackfillMessage(null);
                  setBackfillOpen(true);
                }}
                className="inline-flex items-center justify-center rounded-md border border-dashed border-border px-4 py-2 text-sm text-ink-secondary hover:border-border-strong hover:text-ink-primary"
              >
                Backfill missed leads
              </button>
            </div>
            {backfillMessage ? (
              <p className="mt-4 text-sm text-[var(--success)]" role="status">
                {backfillMessage}
              </p>
            ) : null}
          </div>
        )}

        {backfillOpen ? (
          <div className="fixed inset-0 z-50 flex flex-col bg-black/40 p-0 md:items-center md:justify-center md:p-4" role="dialog">
            <div className="flex h-full w-full max-w-md flex-col border border-border bg-surface-card p-5 shadow-lg md:h-auto md:rounded-lg md:p-6">
              <h4 className="font-display text-lg text-ink-primary">Backfill missed leads</h4>
              <p className="mt-2 text-sm text-ink-secondary">
                Fetch and import any leads from this form created after this date that did not reach Segmiq.
              </p>
              <label className="mt-4 block text-xs font-mono uppercase text-ink-tertiary">Since</label>
              <input
                type="datetime-local"
                className="mt-1 w-full rounded-md border border-border bg-content px-3 py-2 text-base md:text-sm"
                value={backfillSince}
                onChange={(e) => setBackfillSince(e.target.value)}
              />
              {backfillMessage && backfillOpen ? (
                <p className="mt-3 text-sm text-[var(--danger-fg)]">{backfillMessage}</p>
              ) : null}
              <div className="safe-bottom mt-auto flex justify-end gap-2 border-t border-border pt-4 md:mt-6 md:border-t-0 md:pt-0">
                <button
                  type="button"
                  className="h-11 rounded-md border border-border px-4 py-2 text-sm text-ink-secondary md:h-9"
                  onClick={() => {
                    setBackfillOpen(false);
                    setBackfillMessage(null);
                  }}
                  disabled={backfillLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="h-11 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-50 md:h-9"
                  disabled={backfillLoading}
                  onClick={() => void onBackfillConfirm()}
                >
                  {backfillLoading ? "Running…" : "Run backfill"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {!expired && !graphTokenRevoked && !fullyConfigured && !hasToken && (
          <div className="mx-auto flex max-w-lg flex-col items-center border border-border bg-surface-card px-8 py-12 text-center shadow-sm">
            <FacebookGlyph />
            <h3 className="mt-6 font-display text-2xl text-ink-primary">Connect Facebook</h3>
            <p className="mt-3 text-sm text-ink-secondary">
              Grant Segmiq access to this client&apos;s Facebook Pages, Lead Forms, and ad accounts. You&apos;ll need
              to be added as a partner in their Business Manager first.
            </p>
            <a
              href={oauthStart}
              className="mt-8 inline-flex items-center justify-center rounded-md bg-[var(--accent)] px-6 py-3 text-sm font-medium text-accent-ink"
            >
              Connect with Facebook
            </a>
          </div>
        )}

        {!expired && !graphTokenRevoked && !fullyConfigured && hasToken && !hasAdAccount && (
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm">
              <span className="h-2 w-2 rounded-full bg-[var(--success)]" />
              <span className="text-ink-primary">Connected · expires in {daysLeft ?? "—"} days</span>
            </div>
            <p className="mb-6 font-mono text-[11px] text-ink-tertiary">
              Choose the Ads account used for this client&apos;s campaigns (Campaigns dashboard).
            </p>
            {loadingAdAccounts || savingAd ? (
              <p className="text-sm text-ink-secondary">{savingAd ? "Saving ad account…" : "Loading ad accounts…"}</p>
            ) : adAccounts && adAccounts.length === 0 ? (
              <p className="text-sm text-ink-secondary">
                No ad accounts found. Confirm this Facebook user has access to the client&apos;s ad account in Business
                Manager.
              </p>
            ) : (
              <ul className="space-y-3">
                {adAccounts?.map((a) => {
                  const sel = selectedAdAccountId === a.id;
                  return (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedAdAccountId(a.id)}
                        className={`w-full rounded-lg border bg-surface-card p-4 text-left transition-[border-color,box-shadow] hover:border-border-strong ${
                          sel ? "border-border-strong ring-1 ring-[var(--accent)]" : "border-border"
                        }`}
                      >
                        <p className="font-display text-[18px] text-ink-primary">{a.name}</p>
                        <p className="mt-1 font-mono text-[11px] text-ink-tertiary">{a.id}</p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {adAccounts && adAccounts.length > 1 ? (
              <button
                type="button"
                disabled={!selectedAdAccountId || savingAd}
                onClick={() => void onSelectAdAccount()}
                className="mt-8 inline-flex items-center justify-center rounded-md bg-[var(--accent)] px-6 py-3 text-sm font-medium text-accent-ink disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingAd ? "Saving…" : "Save ad account"}
              </button>
            ) : null}
          </div>
        )}

        {!expired && !graphTokenRevoked && !fullyConfigured && hasToken && hasAdAccount && !hasPage && (
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm">
              <span className="h-2 w-2 rounded-full bg-[var(--success)]" />
              <span className="text-ink-primary">
                Connected · expires in {daysLeft ?? "—"} days
              </span>
            </div>
            <p className="mb-6 font-mono text-[11px] text-ink-tertiary">
              Choose the Page that receives Lead Ads for this client.
            </p>
            {loadingPages ? (
              <p className="text-sm text-ink-secondary">Loading pages…</p>
            ) : pages && pages.length === 0 ? (
              <p className="text-sm text-ink-secondary">
                No Pages found. Make sure your Facebook account has access to this client&apos;s Page.
              </p>
            ) : (
              <ul className="space-y-3">
                {pages?.map((p) => {
                  const sel = selectedPageId === p.id;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedPageId(p.id)}
                        className={`w-full rounded-lg border bg-surface-card p-4 text-left transition-[border-color,box-shadow] hover:border-border-strong ${
                          sel ? "border-border-strong ring-1 ring-[var(--accent)]" : "border-border"
                        }`}
                      >
                        <p className="font-display text-[18px] text-ink-primary">{p.name}</p>
                        <p className="mt-1 font-mono text-[11px] text-ink-tertiary">{p.id}</p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <button
              type="button"
              disabled={!selectedPageId || savingPage}
              onClick={() => void onSelectPage()}
              className="mt-8 inline-flex items-center justify-center rounded-md bg-[var(--accent)] px-6 py-3 text-sm font-medium text-accent-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingPage ? "Saving…" : "Select page"}
            </button>
          </div>
        )}

        {!expired && !graphTokenRevoked && !fullyConfigured && hasToken && hasAdAccount && hasPage && !hasForm && (
          <div>
            <p className="mb-6 font-mono text-[11px] text-ink-tertiary">
              Select the Lead Form that feeds this client (one per client).
            </p>
            {loadingForms ? (
              <p className="text-sm text-ink-secondary">Loading forms…</p>
            ) : forms && forms.length === 0 ? (
              <p className="text-sm text-amber-800">
                No Lead Forms found. Create one in Meta Ads Manager, then refresh.
              </p>
            ) : (
              <ul className="space-y-3">
                {forms?.map((f) => {
                  const sel = selectedFormId === f.id;
                  const st = (f.status ?? "").toUpperCase();
                  const active = st === "ACTIVE" || st === "PUBLISHED";
                  return (
                    <li key={f.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedFormId(f.id)}
                        className={`flex w-full items-start justify-between gap-4 rounded-lg border bg-surface-card p-4 text-left transition-[border-color,box-shadow] hover:border-border-strong ${
                          sel ? "border-border-strong ring-1 ring-[var(--accent)]" : "border-border"
                        }`}
                      >
                        <div>
                          <p className="font-display text-[18px] text-ink-primary">{f.name}</p>
                          <p className="mt-1 font-mono text-[11px] text-ink-tertiary">{f.id}</p>
                        </div>
                        <span
                          className={`shrink-0 rounded-sm px-2 py-0.5 font-mono text-[11px] ${
                            active
                              ? "bg-[var(--status-contacted-bg)] text-[var(--status-contacted-fg)]"
                              : "bg-surface-card-alt text-ink-tertiary"
                          }`}
                        >
                          {active ? "Active" : f.status ?? "Paused"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <button
              type="button"
              disabled={!selectedFormId || savingForm}
              onClick={() => void onSelectForm()}
              className="mt-8 inline-flex items-center justify-center rounded-md bg-[var(--accent)] px-6 py-3 text-sm font-medium text-accent-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingForm ? "Saving…" : "Save form"}
            </button>
          </div>
        )}

        <p className="font-mono text-[11px] text-ink-tertiary">
          Webhook URL:{" "}
          <code className="rounded-sm bg-surface-card-alt px-1">/api/facebook/webhook</code>
        </p>
      </div>
    </div>
  );
}
