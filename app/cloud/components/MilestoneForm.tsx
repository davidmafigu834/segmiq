"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { getTemplates } from "@/app/cloud/lib/milestone-templates";

type Props = {
  projectCategory: string;
  onSave: (data: {
    title: string;
    description: string;
    milestone_date: string;
  }) => Promise<void>;
  onClose: () => void;
  initialData?: {
    title: string;
    description: string;
    milestone_date: string;
  };
  mode: "create" | "edit";
};

export function MilestoneForm({ projectCategory, onSave, onClose, initialData, mode }: Props) {
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [date, setDate] = useState(
    initialData?.milestone_date ?? new Date().toISOString().split("T")[0]!
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const templates = getTemplates(projectCategory);

  async function handleSave() {
    if (!title.trim()) { setError("Please enter a milestone name"); return; }
    if (!date) { setError("Please select a date"); return; }
    setSaving(true);
    try {
      await onSave({ title: title.trim(), description: description.trim(), milestone_date: date });
      onClose();
    } catch {
      setError("Failed to save milestone. Please try again.");
    } finally {
      setSaving(false);
    }
  }

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
        width: "100%",
        background: "#FFFFFF",
        borderRadius: "24px 24px 0 0",
        padding: "0 0 calc(24px + env(safe-area-inset-bottom))",
        maxHeight: "92vh",
        overflowY: "auto",
      }}>
        <div style={{
          width: 40, height: 4,
          background: "rgba(28,20,16,0.12)",
          borderRadius: 2,
          margin: "12px auto 20px",
        }} />

        <div style={{
          display: "flex", alignItems: "center",
          justifyContent: "space-between",
          padding: "0 20px 20px",
          borderBottom: "0.5px solid rgba(28,20,16,0.08)",
        }}>
          <h2 style={{
            fontFamily: "var(--fw-font-display), Georgia, serif",
            fontSize: 20, color: "#1C1410", margin: 0,
          }}>
            {mode === "create" ? "Add milestone" : "Edit milestone"}
          </h2>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "#F7F4EF", border: "none",
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <X size={16} color="#4A3828" />
          </button>
        </div>

        <div style={{ padding: "20px" }}>
          {mode === "create" && (
            <div style={{ marginBottom: 20 }}>
              <p style={{
                fontFamily: "var(--fw-font-body), system-ui, sans-serif",
                fontSize: 10, fontWeight: 700,
                letterSpacing: "0.1em", textTransform: "uppercase",
                color: "#8C7B6B", margin: "0 0 10px",
              }}>
                Common stages for {projectCategory}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {templates.map((template) => (
                  <button
                    key={template}
                    onClick={() => setTitle(template)}
                    style={{
                      height: 32, padding: "0 12px",
                      background: title === template ? "#1C1410" : "#F7F4EF",
                      color: title === template ? "#D4FF4F" : "#4A3828",
                      border: "none", borderRadius: 20,
                      fontSize: 12, fontWeight: 500,
                      fontFamily: "var(--fw-font-body), system-ui, sans-serif",
                      cursor: "pointer",
                    }}
                  >
                    {template}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{
              display: "block",
              fontFamily: "var(--fw-font-body), system-ui, sans-serif",
              fontSize: 12, fontWeight: 600,
              color: "#4A3828", margin: "0 0 6px",
            }}>
              Milestone name *
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Foundation pour"
              style={{
                width: "100%", height: 48,
                padding: "0 14px",
                background: "#F7F4EF",
                border: "0.5px solid rgba(28,20,16,0.12)",
                borderRadius: 12,
                fontSize: 14, color: "#1C1410",
                fontFamily: "var(--fw-font-body), system-ui, sans-serif",
                outline: "none", boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{
              display: "block",
              fontFamily: "var(--fw-font-body), system-ui, sans-serif",
              fontSize: 12, fontWeight: 600,
              color: "#4A3828", margin: "0 0 6px",
            }}>
              Date *
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{
                width: "100%", height: 48,
                padding: "0 14px",
                background: "#F7F4EF",
                border: "0.5px solid rgba(28,20,16,0.12)",
                borderRadius: 12,
                fontSize: 14, color: "#1C1410",
                fontFamily: "var(--fw-font-body), system-ui, sans-serif",
                outline: "none", boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{
              display: "block",
              fontFamily: "var(--fw-font-body), system-ui, sans-serif",
              fontSize: 12, fontWeight: 600,
              color: "#4A3828", margin: "0 0 6px",
            }}>
              Description{" "}
              <span style={{ fontWeight: 400, color: "#8C7B6B" }}>(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What happened at this stage? What materials were used?"
              rows={3}
              style={{
                width: "100%",
                padding: "12px 14px",
                background: "#F7F4EF",
                border: "0.5px solid rgba(28,20,16,0.12)",
                borderRadius: 12,
                fontSize: 14, color: "#1C1410",
                fontFamily: "var(--fw-font-body), system-ui, sans-serif",
                outline: "none", resize: "none",
                boxSizing: "border-box", lineHeight: 1.5,
              }}
            />
          </div>

          {error && (
            <p style={{
              fontSize: 12, color: "#E8602C",
              fontFamily: "var(--fw-font-body), system-ui, sans-serif",
              margin: "0 0 16px",
            }}>
              {error}
            </p>
          )}

          <button
            onClick={() => void handleSave()}
            disabled={saving}
            style={{
              width: "100%", height: 52,
              background: saving ? "#EDE9E3" : "#1C1410",
              color: saving ? "#8C7B6B" : "#D4FF4F",
              border: "none", borderRadius: 14,
              fontSize: 15, fontWeight: 700,
              fontFamily: "var(--fw-font-body), system-ui, sans-serif",
              cursor: saving ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center",
              justifyContent: "center", gap: 8,
            }}
          >
            {saving ? (
              <>
                <div className="animate-spin" style={{
                  width: 16, height: 16,
                  border: "2px solid #8C7B6B",
                  borderTopColor: "transparent",
                  borderRadius: "50%",
                }} />
                Saving...
              </>
            ) : (
              mode === "create" ? "Add milestone" : "Save changes"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
