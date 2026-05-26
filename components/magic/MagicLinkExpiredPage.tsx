"use client";

import { useState } from "react";

export function MagicLinkExpiredPage({ token }: { token: string }) {
  const [renewing, setRenewing] = useState(false);
  const [renewalSent, setRenewalSent] = useState(false);
  const [renewalError, setRenewalError] = useState("");
  const [newMagicLink, setNewMagicLink] = useState("");

  async function handleRenew() {
    setRenewing(true);
    setRenewalError("");

    try {
      const res = await fetch(`/api/leads/magic/${token}/renew`, {
        method: "POST",
      });

      const data = await res.json();

      if (res.ok && data.success) {
        if (data.renewed && data.magicLink) {
          setNewMagicLink(data.magicLink);
        }
        setRenewalSent(true);
      } else {
        setRenewalError(data.error || "Failed to renew link. Contact your manager.");
      }
    } catch {
      setRenewalError("Something went wrong. Please try again.");
    } finally {
      setRenewing(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#000000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        fontFamily: "-apple-system, BlinkMacSystemFont, Inter, sans-serif",
      }}
    >
      <div style={{ width: "100%", maxWidth: 400 }}>
        <p
          style={{
            textAlign: "center",
            fontSize: 20,
            fontWeight: 700,
            color: "#D4FF4F",
            margin: "0 0 32px",
          }}
        >
          Segmiq
        </p>

        <div
          style={{
            background: "#0a0a0a",
            border: "0.5px solid rgba(255,255,255,0.07)",
            borderRadius: 16,
            padding: "36px 32px",
            textAlign: "center",
          }}
        >
          {renewalSent ? (
            <>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  background: "rgba(61,214,140,0.1)",
                  border: "0.5px solid rgba(61,214,140,0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 20px",
                }}
              >
                <i className="ti ti-check" style={{ fontSize: 24, color: "#3dd68c" }} />
              </div>
              <h2
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: "#ededed",
                  margin: "0 0 12px",
                }}
              >
                New link sent
              </h2>
              <p
                style={{
                  fontSize: 14,
                  color: "#71717a",
                  lineHeight: 1.6,
                  margin: "0 0 24px",
                }}
              >
                A fresh link has been sent to your WhatsApp and email. Check both
                and use the new link to open your lead.
              </p>

              {newMagicLink && (
                <a
                  href={newMagicLink}
                  style={{
                    display: "inline-block",
                    padding: "12px 24px",
                    background: "#D4FF4F",
                    color: "#000000",
                    borderRadius: 10,
                    fontSize: 14,
                    fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  Open lead now →
                </a>
              )}
            </>
          ) : (
            <>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  background: "rgba(245,166,35,0.1)",
                  border: "0.5px solid rgba(245,166,35,0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 20px",
                }}
              >
                <i className="ti ti-clock-off" style={{ fontSize: 24, color: "#f5a623" }} />
              </div>

              <h2
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: "#ededed",
                  margin: "0 0 12px",
                }}
              >
                Link expired
              </h2>

              <p
                style={{
                  fontSize: 14,
                  color: "#71717a",
                  lineHeight: 1.6,
                  margin: "0 0 28px",
                }}
              >
                This link has expired. Tap below to get a fresh link sent to your
                WhatsApp and email instantly.
              </p>

              {renewalError && (
                <p
                  style={{
                    fontSize: 13,
                    color: "#ff4444",
                    margin: "0 0 16px",
                  }}
                >
                  {renewalError}
                </p>
              )}

              <button
                onClick={handleRenew}
                disabled={renewing}
                style={{
                  width: "100%",
                  height: 48,
                  background: renewing ? "#1a1a1a" : "#D4FF4F",
                  color: renewing ? "#555555" : "#000000",
                  border: "none",
                  borderRadius: 10,
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: renewing ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  transition: "all 0.15s ease",
                }}
              >
                {renewing ? (
                  <>
                    <span
                      className="animate-spin"
                      style={{
                        display: "inline-block",
                        width: 16,
                        height: 16,
                        border: "2px solid #555555",
                        borderTopColor: "transparent",
                        borderRadius: "50%",
                      }}
                    />
                    Sending new link...
                  </>
                ) : (
                  <>
                    <i className="ti ti-refresh" style={{ fontSize: 16 }} />
                    Send me a new link
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
