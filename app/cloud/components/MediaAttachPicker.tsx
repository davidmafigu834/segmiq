"use client";

import { useState } from "react";
import { X, Check, ImageOff } from "lucide-react";

type MediaItem = {
  id: string;
  public_url: string;
  caption?: string | null;
  milestone_id?: string | null;
};

type Props = {
  allMedia: MediaItem[];
  currentMilestoneId: string;
  onAttach: (mediaIds: string[]) => Promise<void>;
  onClose: () => void;
};

export function MediaAttachPicker({ allMedia, currentMilestoneId, onAttach, onClose }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const available = allMedia.filter((m) => m.milestone_id !== currentMilestoneId);
  const unattached = available.filter((m) => !m.milestone_id);
  const attachedElsewhere = available.filter(
    (m) => m.milestone_id && m.milestone_id !== currentMilestoneId
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleAttach() {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      await onAttach(Array.from(selected));
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 6,
    marginBottom: 20,
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 60,
        background: "rgba(28,20,16,0.5)",
        display: "flex", alignItems: "flex-end",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: "100%", background: "#FFFFFF",
        borderRadius: "24px 24px 0 0",
        maxHeight: "88vh", display: "flex", flexDirection: "column",
        paddingBottom: "calc(20px + env(safe-area-inset-bottom))",
      }}>
        <div style={{
          width: 40, height: 4,
          background: "rgba(28,20,16,0.12)",
          borderRadius: 2, margin: "12px auto 0",
          flexShrink: 0,
        }} />

        <div style={{
          display: "flex", alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px",
          borderBottom: "0.5px solid rgba(28,20,16,0.08)",
          flexShrink: 0,
        }}>
          <div>
            <h2 style={{
              fontFamily: "var(--fw-font-display), Georgia, serif",
              fontSize: 18, color: "#1C1410", margin: 0,
            }}>
              Attach photos
            </h2>
            {selected.size > 0 && (
              <p style={{
                fontFamily: "var(--fw-font-body), system-ui, sans-serif",
                fontSize: 11, color: "#8C7B6B", margin: "2px 0 0",
              }}>
                {selected.size} selected
              </p>
            )}
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "#F7F4EF", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <X size={16} color="#4A3828" />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          {unattached.length > 0 && (
            <>
              <p style={{
                fontFamily: "var(--fw-font-body), system-ui, sans-serif",
                fontSize: 10, fontWeight: 700,
                letterSpacing: "0.1em", textTransform: "uppercase",
                color: "#8C7B6B", margin: "0 0 10px",
              }}>
                Unattached photos
              </p>
              <div style={gridStyle}>
                {unattached.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => toggle(item.id)}
                    style={{
                      aspectRatio: "1",
                      borderRadius: 10,
                      overflow: "hidden",
                      position: "relative",
                      cursor: "pointer",
                      border: selected.has(item.id) ? "2.5px solid #1C1410" : "2.5px solid transparent",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.public_url}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                    {selected.has(item.id) && (
                      <div style={{
                        position: "absolute", inset: 0,
                        background: "rgba(28,20,16,0.4)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <div style={{
                          width: 24, height: 24, borderRadius: "50%",
                          background: "#D4FF4F",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <Check size={13} color="#1C1410" />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {attachedElsewhere.length > 0 && (
            <>
              <p style={{
                fontFamily: "var(--fw-font-body), system-ui, sans-serif",
                fontSize: 10, fontWeight: 700,
                letterSpacing: "0.1em", textTransform: "uppercase",
                color: "#8C7B6B", margin: "0 0 10px",
              }}>
                Attached to other milestones
              </p>
              <div style={gridStyle}>
                {attachedElsewhere.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => toggle(item.id)}
                    style={{
                      aspectRatio: "1", borderRadius: 10,
                      overflow: "hidden", position: "relative",
                      cursor: "pointer",
                      border: selected.has(item.id) ? "2.5px solid #1C1410" : "2.5px solid transparent",
                      opacity: 0.7,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.public_url}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                    {selected.has(item.id) && (
                      <div style={{
                        position: "absolute", inset: 0,
                        background: "rgba(28,20,16,0.4)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <div style={{
                          width: 24, height: 24, borderRadius: "50%",
                          background: "#D4FF4F",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <Check size={13} color="#1C1410" />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {available.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <ImageOff size={36} color="#B4A898" style={{ display: "block", margin: "0 auto 12px" }} />
              <p style={{
                fontFamily: "var(--fw-font-body), system-ui, sans-serif",
                fontSize: 13, color: "#8C7B6B", margin: 0,
              }}>
                All photos are already attached to this milestone.
                Upload new photos to add more.
              </p>
            </div>
          )}
        </div>

        {selected.size > 0 && (
          <div style={{ padding: "12px 20px 0", flexShrink: 0 }}>
            <button
              onClick={() => void handleAttach()}
              disabled={saving}
              style={{
                width: "100%", height: 52,
                background: "#1C1410", color: "#D4FF4F",
                border: "none", borderRadius: 14,
                fontSize: 15, fontWeight: 700,
                fontFamily: "var(--fw-font-body), system-ui, sans-serif",
                cursor: "pointer",
              }}
            >
              {saving
                ? "Attaching..."
                : `Attach ${selected.size} photo${selected.size !== 1 ? "s" : ""}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
