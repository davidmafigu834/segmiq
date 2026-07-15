"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { getTemplates, type MilestoneTemplate } from "@/app/cloud/lib/milestone-templates";

const inputStyle: React.CSSProperties = {
  width: "100%", height: 48,
  padding: "0 14px",
  background: "#F7F4EF",
  border: "0.5px solid rgba(28,20,16,0.12)",
  borderRadius: 12,
  fontSize: 14, color: "#1C1410",
  fontFamily: "var(--fw-font-body), system-ui, sans-serif",
  outline: "none", boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontFamily: "var(--fw-font-body), system-ui, sans-serif",
  fontSize: 12, fontWeight: 600,
  color: "#4A3828", margin: "0 0 6px",
};

type Props = {
  projectCategory: string;
  onSave: (data: {
    title: string;
    description: string;
    milestone_date: string;
    stat_number?: string | null;
    stat_label?: string | null;
    phase?: string | null;
  }) => Promise<void>;
  onClose: () => void;
  initialData?: {
    title: string;
    description: string;
    milestone_date: string;
    stat_number?: string | null;
    stat_label?: string | null;
    phase?: string | null;
  };
  mode: "create" | "edit";
  existingMilestones?: { milestone_date: string }[];
};

export function MilestoneForm({ projectCategory, onSave, onClose, initialData, mode, existingMilestones }: Props) {
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [date, setDate] = useState(
    initialData?.milestone_date ?? new Date().toISOString().split("T")[0]!
  );
  const [statNumber, setStatNumber] = useState(initialData?.stat_number ?? "");
  const [statLabel, setStatLabel] = useState(initialData?.stat_label ?? "");
  const [phase, setPhase] = useState<"before" | "during" | "after" | null>(
    (initialData?.phase as "before" | "during" | "after" | null) ?? null
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const templates = getTemplates(projectCategory);

  function selectTemplate(template: MilestoneTemplate) {
    setTitle(template.title);
    setDescription(template.description);
    if (template.statLabel) setStatLabel(template.statLabel);
  }

  async function handleSave() {
    if (!title.trim()) { setError("Please enter a milestone name"); return; }
    if (!date) { setError("Please select a date"); return; }
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        milestone_date: date,
        stat_number: statNumber.trim() || null,
        stat_label: statLabel.trim() || null,
        phase: phase || null,
      });
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
      <div
        className="cloud-scroll-y"
        style={{
        width: "100%",
        background: "#FFFFFF",
        borderRadius: "24px 24px 0 0",
        padding: "0 0 calc(24px + env(safe-area-inset-bottom))",
        maxHeight: "92vh",
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
          {/* Date accuracy hint — shown when all existing milestones share the same date */}
          {existingMilestones && existingMilestones.length > 0 &&
            new Set(existingMilestones.map((m) => m.milestone_date)).size === 1 && (
            <div style={{
              padding: "10px 14px",
              background: "rgba(196,154,60,0.08)",
              border: "0.5px solid rgba(196,154,60,0.2)",
              borderRadius: 10,
              marginBottom: 16,
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
            }}>
              <span style={{ fontSize: 14, color: "#C49A3C", flexShrink: 0, marginTop: 1 }}>ⓘ</span>
              <p style={{
                fontFamily: "var(--fw-font-body), system-ui, sans-serif",
                fontSize: 12, color: "#8C7B6B",
                margin: 0, lineHeight: 1.5,
              }}>
                For a better timeline story, use the actual date each stage happened —
                even if it was months ago. Prospects want to see the project journey over time.
              </p>
            </div>
          )}

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
                    key={template.title}
                    onClick={() => selectTemplate(template)}
                    style={{
                      height: 32, padding: "0 12px",
                      background: title === template.title ? "#1C1410" : "#F7F4EF",
                      color: title === template.title ? "#D4FF4F" : "#4A3828",
                      border: "none", borderRadius: 20,
                      fontSize: 12, fontWeight: 500,
                      fontFamily: "var(--fw-font-body), system-ui, sans-serif",
                      cursor: "pointer",
                    }}
                  >
                    {template.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Milestone name *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Foundation pour"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Date *</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>
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

          {/* Human stat — optional */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>
              Project stat{" "}
              <span style={{ fontWeight: 400, color: "#8C7B6B" }}>(optional)</span>
            </label>
            <p style={{
              fontFamily: "var(--fw-font-body), system-ui, sans-serif",
              fontSize: 11, color: "#8C7B6B", margin: "0 0 8px",
            }}>
              A number that brings this milestone to life — workers, days, materials.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={statNumber}
                onChange={(e) => setStatNumber(e.target.value)}
                placeholder="15"
                style={{
                  width: 80, height: 48,
                  padding: "0 14px",
                  background: "#F7F4EF",
                  border: "0.5px solid rgba(28,20,16,0.12)",
                  borderRadius: 12,
                  fontSize: 14, color: "#1C1410",
                  fontFamily: "var(--fw-font-body), system-ui, sans-serif",
                  outline: "none", boxSizing: "border-box",
                  textAlign: "center", fontWeight: 700,
                }}
              />
              <input
                value={statLabel}
                onChange={(e) => setStatLabel(e.target.value)}
                placeholder="workers on site"
                style={{ ...inputStyle, flex: 1, width: "auto" }}
              />
            </div>
          </div>

          {/* Phase tag — optional */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>
              Phase{" "}
              <span style={{ fontWeight: 400, color: "#8C7B6B" }}>(optional)</span>
            </label>
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              {(["before", "during", "after"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPhase(phase === p ? null : p)}
                  style={{
                    flex: 1, height: 36,
                    background: phase === p ? "#1C1410" : "#F7F4EF",
                    color: phase === p ? "#D4FF4F" : "#4A3828",
                    border: "none", borderRadius: 10,
                    fontSize: 12, fontWeight: 700,
                    fontFamily: "var(--fw-font-body), system-ui, sans-serif",
                    cursor: "pointer", textTransform: "capitalize",
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
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
