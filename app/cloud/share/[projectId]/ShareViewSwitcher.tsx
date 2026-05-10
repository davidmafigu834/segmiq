"use client";

import { useState } from "react";
import { LayoutGrid, GitBranch, CheckCircle2, Calendar, Trophy } from "lucide-react";
import { ShareGallery } from "./ShareGallery";

type MediaItem = { id: string; public_url: string; display_order: number; caption: string | null; type?: string; thumbnail_url?: string | null; duration_seconds?: number | null };

type WatermarkConfig = {
  logoUrl: string;
  position: "bottom-right" | "bottom-left" | "bottom-center" | "center";
  opacity: number;
  size: "small" | "medium" | "large";
};

type MilestoneMedia = {
  id: string;
  public_url: string;
  caption?: string | null;
  display_order: number;
};

type Milestone = {
  id: string;
  title: string;
  description?: string | null;
  milestone_date: string;
  display_order: number;
  is_completed: boolean;
  project_media: MilestoneMedia[];
};

type Props = {
  media: MediaItem[];
  milestones: Milestone[];
  watermark?: WatermarkConfig | null;
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const F = "var(--fw-font-body), 'DM Sans', system-ui, sans-serif";
const S = "var(--fw-font-display), 'DM Serif Display', Georgia, serif";

export function ShareViewSwitcher({ media, milestones, watermark }: Props) {
  const hasMilestones = milestones.length > 0;
  const [activeView, setActiveView] = useState<"gallery" | "timeline">("gallery");

  const completedCount = milestones.filter((m) => m.is_completed).length;
  const progressPct = milestones.length > 0
    ? Math.round((completedCount / milestones.length) * 100)
    : 0;

  return (
    <>
      {/* View toggle — only shown if milestones exist */}
      {hasMilestones && (
        <div style={{ display: "flex", background: "#F7F4EF", borderRadius: 12, padding: 3, marginBottom: 28 }}>
          {(["gallery", "timeline"] as const).map((view) => (
            <button
              key={view}
              onClick={() => setActiveView(view)}
              style={{
                flex: 1, height: 38,
                background: activeView === view ? "#FFFFFF" : "transparent",
                border: "none", borderRadius: 10,
                fontSize: 13, fontWeight: 700,
                fontFamily: F,
                color: activeView === view ? "#1C1410" : "#8C7B6B",
                cursor: "pointer",
                boxShadow: activeView === view ? "0 1px 3px rgba(28,20,16,0.08)" : "none",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                textTransform: "capitalize",
                transition: "all 0.15s ease",
              }}
            >
              {view === "gallery" ? <LayoutGrid size={14} /> : <GitBranch size={14} />}
              {view}
            </button>
          ))}
        </div>
      )}

      {/* Gallery view */}
      {activeView === "gallery" && (
        <ShareGallery media={media} watermark={watermark} />
      )}

      {/* Timeline view */}
      {activeView === "timeline" && (
        <div>
          {/* Progress summary */}
          <div style={{
            background: "#F7F4EF",
            borderRadius: 16,
            padding: "16px 18px",
            marginBottom: 28,
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontFamily: F, fontSize: 13, color: "#1C1410", fontWeight: 700 }}>
                  {completedCount} of {milestones.length} milestones complete
                </span>
                <span style={{ fontFamily: F, fontSize: 13, color: "#8C7B6B" }}>
                  {progressPct}%
                </span>
              </div>
              <div style={{ height: 6, background: "rgba(28,20,16,0.1)", borderRadius: 3 }}>
                <div style={{
                  height: 6, borderRadius: 3,
                  background: progressPct === 100 ? "#D4FF4F" : "#1C1410",
                  width: `${progressPct}%`,
                  transition: "width 0.4s ease",
                }} />
              </div>
            </div>
            {progressPct === 100 && (
              <Trophy size={24} color="#1C1410" />
            )}
          </div>

          {/* Milestone list */}
          {milestones.map((milestone, idx) => (
            <div key={milestone.id} style={{ marginBottom: 16, position: "relative" }}>
              {idx < milestones.length - 1 && (
                <div style={{
                  position: "absolute",
                  left: 18, top: 42, bottom: -16, width: 2,
                  background: milestone.is_completed ? "rgba(28,20,16,0.18)" : "rgba(28,20,16,0.07)",
                  zIndex: 0,
                }} />
              )}

              <div style={{
                background: "#FFFFFF",
                borderRadius: 16,
                border: `0.5px solid ${milestone.is_completed ? "rgba(28,20,16,0.12)" : "rgba(28,20,16,0.07)"}`,
                overflow: "hidden",
                position: "relative",
                zIndex: 1,
              }}>
                {/* Header */}
                <div style={{ padding: "16px 16px 14px", display: "flex", alignItems: "flex-start", gap: 12 }}>
                  {/* Status bubble */}
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%", flexShrink: 0, marginTop: 2,
                    background: milestone.is_completed ? "#1C1410" : "#F7F4EF",
                    border: `1.5px solid ${milestone.is_completed ? "#1C1410" : "rgba(28,20,16,0.15)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {milestone.is_completed
                      ? <CheckCircle2 size={16} color="#D4FF4F" />
                      : <span style={{ fontFamily: F, fontSize: 11, fontWeight: 700, color: "#8C7B6B" }}>
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                    }
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontFamily: S,
                      fontSize: 16,
                      color: milestone.is_completed ? "#8C7B6B" : "#1C1410",
                      margin: "0 0 3px",
                      textDecoration: milestone.is_completed ? "line-through" : "none",
                    }}>
                      {milestone.title}
                    </p>
                    <p style={{ fontFamily: F, fontSize: 12, color: "#8C7B6B", margin: 0, display: "flex", alignItems: "center", gap: 4 }}>
                      <Calendar size={11} />
                      {formatDate(milestone.milestone_date)}
                    </p>
                    {milestone.description && (
                      <p style={{ fontFamily: F, fontSize: 13, color: "#4A3828", margin: "8px 0 0", lineHeight: 1.6 }}>
                        {milestone.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Photo grid */}
                {milestone.project_media && milestone.project_media.length > 0 && (
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: milestone.project_media.length === 1 ? "1fr" : "repeat(3, 1fr)",
                    gap: 3, padding: "0 3px 3px",
                  }}>
                    {[...milestone.project_media]
                      .sort((a, b) => a.display_order - b.display_order)
                      .slice(0, milestone.project_media.length === 1 ? 1 : 6)
                      .map((pm) => (
                        <div key={pm.id} style={{ aspectRatio: "1", overflow: "hidden", borderRadius: 6 }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={pm.public_url}
                            alt={pm.caption ?? ""}
                            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                            loading="lazy"
                          />
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
