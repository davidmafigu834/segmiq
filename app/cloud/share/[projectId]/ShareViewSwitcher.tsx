"use client";

import React, { useState, useEffect, useRef } from "react";
import { LayoutGrid, GitBranch, CheckCircle2, X } from "lucide-react";
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
  thumbnail_url?: string | null;
  type?: string | null;
};

type Milestone = {
  id: string;
  title: string;
  description?: string | null;
  milestone_date: string;
  display_order: number;
  is_completed: boolean;
  stat_number?: string | null;
  stat_label?: string | null;
  phase?: string | null;
  project_media: MilestoneMedia[];
};

type Props = {
  media: MediaItem[];
  milestones: Milestone[];
  watermark?: WatermarkConfig | null;
};

function formatMilestoneDate(
  dateStr: string,
  allMilestones: { milestone_date: string }[]
): string {
  const date = new Date(dateStr);
  const uniqueDates = new Set(allMilestones.map((m) => m.milestone_date));
  const allSameDate = uniqueDates.size === 1;
  const uniqueMonths = new Set(
    allMilestones.map((m) => {
      const d = new Date(m.milestone_date);
      return `${d.getFullYear()}-${d.getMonth()}`;
    })
  );
  const allSameMonth = uniqueMonths.size === 1;
  if (allSameDate) {
    return date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  }
  if (allSameMonth) {
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "long" });
  }
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

const F = "var(--fw-font-body), 'DM Sans', system-ui, sans-serif";
const S = "var(--fw-font-display), 'DM Serif Display', Georgia, serif";

function MilestonePhotoLayout({
  media,
  onPhotoClick,
}: {
  media: MilestoneMedia[];
  onPhotoClick: (item: MilestoneMedia) => void;
}) {
  if (media.length === 0) return null;

  if (media.length === 1) {
    return (
      <div
        className="photo-card"
        onClick={() => onPhotoClick(media[0]!)}
        style={{ borderRadius: 14, overflow: "hidden", cursor: "pointer", aspectRatio: "16/9", position: "relative", background: "#1C1410" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={media[0]!.thumbnail_url ?? media[0]!.public_url} alt={media[0]!.caption ?? "Project photo"} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} loading="lazy" />
        {media[0]!.caption && (
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "20px 16px 14px", background: "linear-gradient(to top, rgba(28,20,16,0.75) 0%, transparent 100%)" }}>
            <p style={{ fontFamily: F, fontSize: 12, color: "rgba(255,255,255,0.8)", margin: 0, fontStyle: "italic" }}>{media[0]!.caption}</p>
          </div>
        )}
      </div>
    );
  }

  if (media.length === 2) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {media.map((item, i) => (
          <div key={item.id} className="photo-card" onClick={() => onPhotoClick(item)} style={{ borderRadius: 12, overflow: "hidden", cursor: "pointer", aspectRatio: "1", position: "relative", background: "#1C1410" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.thumbnail_url ?? item.public_url} alt={item.caption ?? `Photo ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} loading="lazy" />
          </div>
        ))}
      </div>
    );
  }

  if (media.length === 3) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 8 }}>
        <div className="photo-card" onClick={() => onPhotoClick(media[0]!)} style={{ borderRadius: 12, overflow: "hidden", cursor: "pointer", gridRow: "span 2", position: "relative", background: "#1C1410", minHeight: 220 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={media[0]!.thumbnail_url ?? media[0]!.public_url} alt={media[0]!.caption ?? "Project photo"} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} loading="lazy" />
          <div style={{ position: "absolute", top: 10, left: 10, background: "var(--brand, #0F7A4F)", color: "var(--brand-ink, #FFFFFF)", fontFamily: F, fontSize: 8, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "3px 8px", borderRadius: 20 }}>
            Key photo
          </div>
        </div>
        {media.slice(1, 3).map((item, i) => (
          <div key={item.id} className="photo-card" onClick={() => onPhotoClick(item)} style={{ borderRadius: 12, overflow: "hidden", cursor: "pointer", aspectRatio: "1", position: "relative", background: "#1C1410" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.thumbnail_url ?? item.public_url} alt={item.caption ?? `Photo ${i + 2}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} loading="lazy" />
          </div>
        ))}
      </div>
    );
  }

  if (media.length === 4) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {media.map((item, i) => (
          <div key={item.id} className="photo-card" onClick={() => onPhotoClick(item)} style={{ borderRadius: 12, overflow: "hidden", cursor: "pointer", aspectRatio: "1", position: "relative", background: "#1C1410" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.thumbnail_url ?? item.public_url} alt={item.caption ?? `Photo ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} loading="lazy" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="photo-card" onClick={() => onPhotoClick(media[0]!)} style={{ borderRadius: 14, overflow: "hidden", cursor: "pointer", aspectRatio: "16/9", position: "relative", background: "#1C1410" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={media[0]!.thumbnail_url ?? media[0]!.public_url} alt={media[0]!.caption ?? "Project photo"} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} loading="lazy" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {media.slice(1, 6).map((item, i) => {
          const isLast = i === 4 && media.length > 6;
          return (
            <div key={item.id} className="photo-card" onClick={() => onPhotoClick(item)} style={{ borderRadius: 10, overflow: "hidden", cursor: "pointer", aspectRatio: "1", position: "relative", background: "#1C1410" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.thumbnail_url ?? item.public_url} alt={item.caption ?? `Photo ${i + 2}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", filter: isLast ? "brightness(0.4)" : "none" }} loading="lazy" />
              {isLast && (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontFamily: S, fontSize: 22, color: "#FFFFFF" }}>+{media.length - 6}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ShareViewSwitcher({ media, milestones, watermark }: Props) {
  const hasMilestones = milestones.length > 0;
  const [activeView, setActiveView] = useState<"gallery" | "timeline">("gallery");
  const [timelineLightbox, setTimelineLightbox] = useState<string | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const completedCount = milestones.filter((m) => m.is_completed).length;
  const progressPct = milestones.length > 0
    ? Math.round((completedCount / milestones.length) * 100)
    : 0;

  // Animate progress bar after mount / milestones change
  useEffect(() => {
    if (!hasMilestones) return;
    const fill = document.getElementById("progress-fill");
    if (!fill) return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) { fill.style.width = `${progressPct}%`; return; }
    const timer = setTimeout(() => { fill.style.width = `${progressPct}%`; }, 400);
    return () => clearTimeout(timer);
  }, [milestones, hasMilestones, progressPct]);

  // Animate timeline vertical line when timeline view mounts
  useEffect(() => {
    if (activeView !== "timeline" || !timelineRef.current) return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;
    const line = timelineRef.current.querySelector(".timeline-line");
    if (!line) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) { entry.target.classList.add("visible"); observer.unobserve(entry.target); }
        });
      },
      { threshold: 0.1 }
    );
    observer.observe(line);
    return () => observer.disconnect();
  }, [milestones, activeView]);

  // Stagger-animate milestone cards as they enter viewport
  useEffect(() => {
    if (activeView !== "timeline") return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;
    const cards = document.querySelectorAll(".milestone-card");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry, index) => {
          if (entry.isIntersecting) {
            setTimeout(() => { entry.target.classList.add("visible"); }, index * 100);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -50px 0px" }
    );
    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [milestones, activeView]);

  return (
    <>
      {/* Animated progress bar — shown if milestones exist */}
      {hasMilestones && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontFamily: F, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8C7B6B" }}>
              Project progress
            </span>
            <span style={{ fontFamily: F, fontSize: 11, color: "#8C7B6B" }}>
              {completedCount} of {milestones.length} stages
            </span>
          </div>
          <div style={{ height: 4, background: "rgba(28,20,16,0.08)", borderRadius: 2, overflow: "hidden" }}>
            <div
              id="progress-fill"
              style={{ height: 4, background: "var(--brand, #0F7A4F)", borderRadius: 2, width: 0, transition: "width 1.2s cubic-bezier(0.4, 0, 0.2, 1)" }}
            />
          </div>
        </div>
      )}

      {/* View toggle */}
      {hasMilestones && (
        <div style={{ display: "flex", background: "#F5F5F0", borderRadius: 12, padding: 3, marginBottom: 28, border: "1px solid rgba(28,20,16,0.06)" }}>
          {(["gallery", "timeline"] as const).map((view) => (
            <button
              key={view}
              onClick={() => setActiveView(view)}
              style={{
                flex: 1, height: 38,
                background: activeView === view ? "#FFFFFF" : "transparent",
                border: "none", borderRadius: 10,
                fontSize: 13, fontWeight: 700, fontFamily: F,
                color: activeView === view ? "#1C1410" : "#8C7B6B",
                cursor: "pointer",
                boxShadow: activeView === view ? "0 1px 3px rgba(28,20,16,0.08)" : "none",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                textTransform: "capitalize", transition: "all 0.15s ease",
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
        <div ref={timelineRef} style={{ position: "relative" }}>
          {milestones.length > 1 && (
            <div
              className="timeline-line"
              style={{ position: "absolute", left: 17, top: 16, bottom: 16, width: 2, background: "rgba(28,20,16,0.2)", borderRadius: 1, zIndex: 0 }}
            />
          )}

          {milestones.map((milestone, idx) => (
            <React.Fragment key={milestone.id}>
              {/* Phase chapter divider — only when phase transitions */}
              {idx > 0 && milestone.phase && milestone.phase !== milestones[idx - 1]?.phase && (
                <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "8px 0 24px 52px" }}>
                  <div style={{ height: "0.5px", flex: 1, background: milestone.phase === "after" ? "rgba(46,125,94,0.3)" : "rgba(28,20,16,0.1)" }} />
                  <span style={{
                    fontFamily: F, fontSize: 9, fontWeight: 700,
                    letterSpacing: "0.14em", textTransform: "uppercase",
                    color: milestone.phase === "before" ? "#E8602C" : milestone.phase === "during" ? "#C49A3C" : "#2E7D5E",
                    padding: "3px 10px",
                    border: `0.5px solid ${milestone.phase === "before" ? "rgba(232,96,44,0.2)" : milestone.phase === "during" ? "rgba(196,154,60,0.2)" : "rgba(46,125,94,0.2)"}`,
                    borderRadius: 20,
                  }}>
                    {milestone.phase === "before" ? "Before" : milestone.phase === "during" ? "Construction phase" : "Completion"}
                  </span>
                  <div style={{ height: "0.5px", flex: 1, background: milestone.phase === "after" ? "rgba(46,125,94,0.3)" : "rgba(28,20,16,0.1)" }} />
                </div>
              )}

              <div className="milestone-card" style={{ marginBottom: 16, position: "relative", zIndex: 1 }}>
                <div style={{
                  background: "#FFFFFF", borderRadius: 18,
                  border: `1px solid ${milestone.is_completed ? "rgba(28,20,16,0.10)" : "rgba(28,20,16,0.06)"}`,
                  overflow: "hidden",
                }}>
                  {/* Header */}
                  <div style={{ padding: "16px 16px 14px", display: "flex", alignItems: "flex-start", gap: 12 }}>
                    {/* Status bubble */}
                    <div
                      className={milestone.is_completed ? "milestone-node-complete" : undefined}
                      style={{
                        width: 36, height: 36, borderRadius: "50%", flexShrink: 0, marginTop: 4,
                        background: milestone.is_completed ? "var(--brand, #0F7A4F)" : "#FFFFFF",
                        border: `1.5px solid ${milestone.is_completed ? "var(--brand, #0F7A4F)" : "rgba(28,20,16,0.12)"}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      {milestone.is_completed
                        ? <CheckCircle2 size={16} color="var(--brand-ink, #FFFFFF)" />
                        : <span style={{ fontFamily: F, fontSize: 11, fontWeight: 700, color: "#8C7B6B" }}>
                            {String(idx + 1).padStart(2, "0")}
                          </span>
                      }
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Date label — above title, wide tracking */}
                      <p style={{ fontFamily: F, fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#8C7B6B", margin: "0 0 6px" }}>
                        {formatMilestoneDate(milestone.milestone_date, milestones)}
                      </p>

                      {/* Title + phase badge */}
                      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 7 }}>
                        <h3 style={{
                          fontFamily: S, fontSize: "clamp(20px, 3.5vw, 28px)",
                          color: "#1C1410", margin: "0 0 10px",
                          lineHeight: 1.15, letterSpacing: "-0.3px", fontWeight: 400,
                        }}>
                          {milestone.title}
                        </h3>
                        {milestone.phase && (
                          <span style={{
                            display: "inline-flex", alignItems: "center",
                            height: 20, padding: "0 8px",
                            background: milestone.phase === "before" ? "rgba(232,96,44,0.1)" : milestone.phase === "during" ? "rgba(196,154,60,0.1)" : "rgba(46,125,94,0.1)",
                            color: milestone.phase === "before" ? "#E8602C" : milestone.phase === "during" ? "#C49A3C" : "#2E7D5E",
                            borderRadius: 20, fontSize: 9, fontWeight: 700,
                            letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: F,
                          }}>
                            {milestone.phase}
                          </span>
                        )}
                      </div>

                      {/* Human stat badge */}
                      {(milestone.stat_number || milestone.stat_label) && (
                        <div style={{ display: "inline-flex", alignItems: "baseline", gap: 6, padding: "6px 14px", background: "#1C1410", borderRadius: 20, marginBottom: 14, width: "fit-content" }}>
                          {milestone.stat_number && (
                            <span style={{ fontFamily: S, fontSize: 20, color: "var(--brand, #0F7A4F)", lineHeight: 1 }}>
                              {milestone.stat_number}
                            </span>
                          )}
                          {milestone.stat_label && (
                            <span style={{ fontFamily: F, fontSize: 12, color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>
                              {milestone.stat_label}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Description */}
                      {milestone.description && (
                        <p style={{ fontFamily: F, fontSize: 13, color: "#4A3828", margin: 0, lineHeight: 1.6 }}>
                          {milestone.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Editorial photo layout */}
                  {milestone.project_media && milestone.project_media.length > 0 && (
                    <div style={{ padding: "0 6px 6px" }}>
                      <MilestonePhotoLayout
                        media={[...milestone.project_media].sort((a, b) => a.display_order - b.display_order)}
                        onPhotoClick={(pm) => setTimelineLightbox(pm.public_url)}
                      />
                    </div>
                  )}
                </div>
              </div>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Timeline photo lightbox */}
      {timelineLightbox && (
        <div
          onClick={() => setTimelineLightbox(null)}
          style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(28,20,16,0.96)", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <button
            onClick={() => setTimelineLightbox(null)}
            style={{ position: "absolute", top: 20, right: 20, width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "0.5px solid rgba(255,255,255,0.2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}
          >
            <X size={18} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={timelineLightbox}
            alt=""
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "90vw", maxHeight: "85vh", objectFit: "contain", borderRadius: 10 }}
          />
        </div>
      )}
    </>
  );
}
