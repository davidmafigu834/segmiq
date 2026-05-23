"use client";

import { useState } from "react";

type Props = {
  leadId: string;
  leadName: string;
  clientId: string;
  staleDays: number;
  lastCallOutcome?: string;
  assetsSentTypes: string[];
  onSent: () => void;
};

export function StaleLeadRecovery({
  leadId,
  leadName,
  staleDays,
  onSent,
}: Props) {
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function generateRecoveryMessage() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/recovery-message`, {
        method: "POST",
      });
      const data = (await res.json()) as { message?: string };
      if (data.message) setMessage(data.message);
    } catch {
      setMessage(
        `Hope all is well! Just wanted to check in about ${leadName.split(" ")[0]}'s inquiry. Are you still looking for a quote? Happy to answer any questions.`
      );
    } finally {
      setGenerating(false);
    }
  }

  async function sendRecoveryMessage() {
    if (!message.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/send-asset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetType: "CUSTOM_MESSAGE",
          customMessage: message,
        }),
      });
      if (res.ok || res.status === 207) {
        setSent(true);
        onSent();
      }
    } catch {
      // fails silently
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div
        style={{
          padding: "12px 16px",
          background: "rgba(61,214,140,0.06)",
          border: "0.5px solid rgba(61,214,140,0.2)",
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <i className="ti ti-check" style={{ fontSize: 14, color: "#3dd68c" }} />
        <p
          style={{
            fontFamily: "var(--ag-font-body)",
            fontSize: 13,
            color: "#3dd68c",
            margin: 0,
          }}
        >
          Recovery message sent
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "rgba(255,68,68,0.04)",
        border: "0.5px solid rgba(255,68,68,0.15)",
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 10,
        }}
      >
        <i
          className="ti ti-alert-circle"
          style={{ fontSize: 15, color: "#ff4444", flexShrink: 0 }}
        />
        <p
          style={{
            fontFamily: "var(--ag-font-body)",
            fontSize: 13,
            fontWeight: 600,
            color: "#ff4444",
            margin: 0,
          }}
        >
          Stale for {staleDays} day{staleDays !== 1 ? "s" : ""}
        </p>
      </div>

      <p
        style={{
          fontFamily: "var(--ag-font-body)",
          fontSize: 12,
          color: "var(--ag-text-tertiary)",
          margin: "0 0 14px",
          lineHeight: 1.5,
        }}
      >
        No activity in {staleDays} days. Send a re-engagement message to bring
        this lead back into the conversation.
      </p>

      {!message ? (
        <button
          type="button"
          onClick={() => void generateRecoveryMessage()}
          disabled={generating}
          style={{
            height: 36,
            padding: "0 16px",
            background: generating ? "var(--ag-surface-3)" : "var(--ag-surface-2)",
            color: generating ? "var(--ag-text-muted)" : "var(--ag-text-secondary)",
            border: "0.5px solid var(--ag-border)",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            cursor: generating ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontFamily: "var(--ag-font-body)",
          }}
        >
          <i className="ti ti-sparkles" style={{ fontSize: 13, color: "#D4FF4F" }} />
          {generating ? "Generating message…" : "Generate re-engagement message"}
        </button>
      ) : (
        <div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            style={{
              width: "100%",
              padding: "10px 12px",
              background: "var(--ag-surface-2)",
              border: "0.5px solid var(--ag-border)",
              borderRadius: 8,
              fontSize: 13,
              color: "var(--ag-text-primary)",
              resize: "none",
              outline: "none",
              boxSizing: "border-box",
              lineHeight: 1.5,
              marginBottom: 10,
              fontFamily: "var(--ag-font-body)",
            }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => void sendRecoveryMessage()}
              disabled={sending || !message.trim()}
              style={{
                flex: 1,
                height: 36,
                background: sending ? "var(--ag-surface-3)" : "var(--ag-lime)",
                color: sending ? "var(--ag-text-muted)" : "var(--ag-lime-fg)",
                border: "none",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                cursor: sending ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                fontFamily: "var(--ag-font-body)",
              }}
            >
              <i className="ti ti-brand-whatsapp" style={{ fontSize: 13 }} />
              {sending ? "Sending…" : "Send via WhatsApp"}
            </button>
            <button
              type="button"
              onClick={() => setMessage("")}
              style={{
                height: 36,
                padding: "0 12px",
                background: "var(--ag-surface-2)",
                color: "var(--ag-text-tertiary)",
                border: "0.5px solid var(--ag-border)",
                borderRadius: 8,
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "var(--ag-font-body)",
              }}
            >
              Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
