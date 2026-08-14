"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, QrCode, RefreshCw, ShieldCheck, Smartphone, Unplug, X } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import type { SafeWhatsAppConnection, WhatsAppConnectionState } from "@/lib/whatsapp/providers/types";

type AdminStatus = { connection: SafeWhatsAppConnection; qrDataUrl: string | null; qrExpired: boolean };

const STATE_LABELS: Record<WhatsAppConnectionState, string> = {
  DISCONNECTED: "Disconnected",
  INITIALIZING: "Preparing connection",
  AWAITING_QR: "Scan QR code",
  CONNECTING: "Connecting",
  CONNECTED: "Connected",
  DEGRADED: "Connection unstable",
  RECONNECTING: "Reconnecting",
  RECONNECT_REQUIRED: "Reconnect required",
  DISCONNECTING: "Disconnecting",
  ERROR: "Connection error",
};

function statusTone(state: WhatsAppConnectionState): string {
  if (state === "CONNECTED") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (["INITIALIZING", "AWAITING_QR", "CONNECTING", "RECONNECTING"].includes(state)) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-slate-200 bg-slate-50 text-slate-600";
}

export function WhatsAppConnectionSettings() {
  const [data, setData] = useState<AdminStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/company/whatsapp/connection", { cache: "no-store" });
    const body = (await response.json().catch(() => ({}))) as AdminStatus & { error?: string };
    if (!response.ok) throw new Error(body.error ?? "Could not load WhatsApp connection");
    setData(body);
    if (body.connection.status === "CONNECTED") setModalOpen(false);
  }, []);

  useEffect(() => {
    void load().catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load connection"))
      .finally(() => setLoading(false));
  }, [load]);

  const connectionStatus = data?.connection.status;

  useEffect(() => {
    if (!connectionStatus) return;
    const active = ["INITIALIZING", "AWAITING_QR", "CONNECTING", "RECONNECTING", "DISCONNECTING"].includes(connectionStatus);
    const timer = window.setInterval(() => void load().catch(() => {}), active || modalOpen ? 2_000 : 12_000);
    return () => window.clearInterval(timer);
  }, [connectionStatus, load, modalOpen]);

  async function mutate(path: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(path, { method: "POST" });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Connection request failed");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Connection request failed");
    } finally {
      setBusy(false);
    }
  }

  async function startConnect() {
    setModalOpen(true);
    await mutate("/api/company/whatsapp/quick-connect");
  }

  async function reconnect() {
    setModalOpen(true);
    await mutate("/api/company/whatsapp/reconnect");
  }

  async function disconnect() {
    if (!window.confirm("Disconnect this business phone? Existing conversations and CRM history will stay in SegmiQ.")) return;
    await mutate("/api/company/whatsapp/disconnect");
  }

  const connection = data?.connection;
  const canOfferQuickConnection = Boolean(
    connection?.temporaryFeatureEnabled && connection.temporaryBetaEligible
  );

  return (
    <div className="mx-auto w-full max-w-5xl pb-16">
      <Link href="/client/account" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-[--text-secondary] hover:text-[--text-primary]">
        <ArrowLeft size={16} /> Account settings
      </Link>
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-[--text-tertiary]">Settings / WhatsApp</p>
          <h1 className="mt-2 font-serif text-3xl text-[--text-primary]">WhatsApp connection</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[--text-secondary]">
            Choose how your company&apos;s WhatsApp messages reach the existing Sales Hub. Connection settings are visible only to company managers.
          </p>
        </div>
        {connection ? (
          <span className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${statusTone(connection.status)}`}>
            <span className={`h-2 w-2 rounded-full ${connection.connected ? "bg-emerald-500" : "bg-current opacity-60"}`} />
            {STATE_LABELS[connection.status]}
          </span>
        ) : null}
      </div>

      {error ? (
        <div role="alert" className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss"><X size={16} /></button>
        </div>
      ) : null}

      {loading || !connection ? (
        <div className="flex min-h-64 items-center justify-center rounded-2xl border border-[--border] bg-[--surface-card]">
          <Loader2 className="animate-spin text-[--text-tertiary]" />
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="overflow-hidden rounded-2xl border border-[--border] bg-[--surface-card] shadow-sm">
            <div className="border-b border-[--border] p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#ECFDF3] text-[#16A34A]">
                  <SiWhatsapp size={25} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-[--text-primary]">
                    {connection.configured ? connection.providerLabel : "No provider connected"}
                  </h2>
                  <p className="mt-1 text-sm text-[--text-secondary]">
                    {connection.phoneNumber || connection.displayName
                      ? [connection.displayName, connection.phoneNumber].filter(Boolean).join(" · ")
                      : connection.providerType === "META_CLOUD"
                        ? "Managed through the existing Meta Cloud API setup."
                        : "Connect a business phone to start receiving new messages."}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-5 p-6">
              {connection.providerType === "TEMPORARY_WEB" && connection.connected ? (
                <>
                  <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <CheckCircle2 size={20} className="shrink-0 text-emerald-600" />
                    <div>
                      <p className="text-sm font-semibold text-emerald-800">Business phone connected</p>
                      <p className="mt-0.5 text-xs text-emerald-700">New one-to-one messages will sync into the existing Sales Hub.</p>
                    </div>
                  </div>
                  <button type="button" disabled={busy} onClick={() => void disconnect()} className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
                    <Unplug size={16} /> {busy ? "Disconnecting…" : "Disconnect phone"}
                  </button>
                </>
              ) : connection.providerType === "TEMPORARY_WEB" && connection.status !== "DISCONNECTED" ? (
                <div className="flex flex-wrap gap-3">
                  <button type="button" disabled={busy} onClick={() => setModalOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-[#D4FF4F] px-4 py-2.5 text-sm font-semibold text-[#101828] disabled:opacity-50">
                    <QrCode size={17} /> View connection
                  </button>
                  {["ERROR", "RECONNECT_REQUIRED"].includes(connection.status) ? (
                    <button type="button" disabled={busy} onClick={() => void reconnect()} className="inline-flex items-center gap-2 rounded-lg border border-[--border-strong] px-4 py-2.5 text-sm font-semibold text-[--text-primary] disabled:opacity-50">
                      <RefreshCw size={16} /> Reconnect
                    </button>
                  ) : null}
                </div>
              ) : canOfferQuickConnection ? (
                <div>
                  <p className="text-sm leading-relaxed text-[--text-secondary]">
                    Link a WhatsApp Business phone by scanning a QR code. This temporary beta supports manual one-to-one sales conversations only.
                  </p>
                  <button type="button" disabled={busy} onClick={() => void startConnect()} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#D4FF4F] px-4 py-2.5 text-sm font-semibold text-[#101828] shadow-sm hover:brightness-95 disabled:opacity-50">
                    {busy ? <Loader2 size={17} className="animate-spin" /> : <QrCode size={17} />}
                    Connect with QR
                  </button>
                </div>
              ) : (
                <p className="text-sm leading-relaxed text-[--text-secondary]">
                  The temporary QR beta is not enabled for this company. Your existing Meta Cloud API connection is unchanged.
                </p>
              )}
            </div>
          </section>

          <aside className="rounded-2xl border border-[--border] bg-[--surface-card] p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[--surface-card-alt] text-[--text-primary]"><ShieldCheck size={21} /></div>
            <h2 className="mt-4 text-base font-semibold text-[--text-primary]">What stays the same</h2>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-[--text-secondary]">
              <li>• Your leads, assignments, CRM history, quotes, and deals remain in SegmiQ.</li>
              <li>• Salespeople use the same WhatsApp Sales Hub and never see the QR code.</li>
              <li>• Disconnecting stops transport only; it does not delete conversations.</li>
              <li>• Group chats, status posts, newsletters, and broadcasts are excluded from quick connection.</li>
            </ul>
          </aside>
        </div>
      )}

      {modalOpen && connection ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="wa-qr-title">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">Quick connection</p><h2 id="wa-qr-title" className="mt-1 text-xl font-semibold text-slate-900">Link business phone</h2></div>
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close"><X size={18} /></button>
            </div>
            <div className="p-6 text-center">
              {data?.qrDataUrl ? (
                <Image src={data.qrDataUrl} alt="WhatsApp quick connection QR code" width={280} height={280} unoptimized className="mx-auto h-[280px] w-[280px] rounded-xl border border-slate-200 bg-white p-2" />
              ) : connection.status === "CONNECTED" ? (
                <CheckCircle2 size={64} className="mx-auto text-emerald-500" />
              ) : data?.qrExpired ? (
                <div className="mx-auto flex h-[280px] w-[280px] flex-col items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-800">
                  <RefreshCw size={38} />
                  <p className="mt-4 text-sm font-semibold">This QR code expired.</p>
                </div>
              ) : (
                <div className="mx-auto flex h-[280px] w-[280px] flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500">
                  {connection.status === "ERROR" || connection.status === "RECONNECT_REQUIRED" ? <AlertTriangle size={38} /> : <Loader2 size={38} className="animate-spin" />}
                  <p className="mt-4 text-sm font-medium">{STATE_LABELS[connection.status]}</p>
                </div>
              )}
              <div className="mt-5 flex items-start gap-3 rounded-xl bg-slate-50 p-4 text-left">
                <Smartphone size={20} className="mt-0.5 shrink-0 text-slate-600" />
                <p className="text-xs leading-relaxed text-slate-600">On the business phone, open WhatsApp → Linked devices → Link a device, then scan this code. Keep the phone online while connecting.</p>
              </div>
              {["ERROR", "RECONNECT_REQUIRED"].includes(connection.status) || data?.qrExpired ? (
                <button type="button" disabled={busy} onClick={() => void reconnect()} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#D4FF4F] px-4 py-2.5 text-sm font-semibold text-[#101828] disabled:opacity-50"><RefreshCw size={16} /> Generate a new code</button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
