"use client";

import { useState, useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

type MediaItem = { id: string; public_url: string; display_order: number; caption: string | null };

type WatermarkConfig = {
  logoUrl: string;
  position: "bottom-right" | "bottom-left" | "bottom-center" | "center";
  opacity: number;
  size: "small" | "medium" | "large";
};

function getWatermarkPositionStyles(position: WatermarkConfig["position"]): React.CSSProperties {
  const base: React.CSSProperties = { position: "absolute", pointerEvents: "none" };
  if (position === "bottom-right") return { ...base, bottom: "6%", right: "5%" };
  if (position === "bottom-left") return { ...base, bottom: "6%", left: "5%" };
  if (position === "bottom-center") return { ...base, bottom: "6%", left: "50%", transform: "translateX(-50%)" };
  return { ...base, top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
}

function getWatermarkWidth(size: WatermarkConfig["size"]): string {
  if (size === "small") return "15%";
  if (size === "medium") return "25%";
  return "35%";
}

export function ShareGallery({ media, watermark }: { media: MediaItem[]; watermark?: WatermarkConfig | null }) {
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);

  const close = useCallback(() => setLightbox(null), []);
  const prev = useCallback(() => setLightbox((i) => (i !== null ? (i - 1 + media.length) % media.length : null)), [media.length]);
  const next = useCallback(() => setLightbox((i) => (i !== null ? (i + 1) % media.length : null)), [media.length]);

  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, prev, next, close]);

  if (media.length === 0) return null;

  return (
    <>
      <style>{`
        .share-gallery { columns: 3; column-gap: 10px; }
        @media (max-width: 768px) { .share-gallery { columns: 2; } }
        @media (max-width: 480px) { .share-gallery { columns: 1; } }
      `}</style>

      <div className="share-gallery">
        {media.map((item, index) => (
          <div
            key={item.id}
            onClick={() => setLightbox(index)}
            onMouseEnter={() => setHovered(index)}
            onMouseLeave={() => setHovered(null)}
            style={{
              breakInside: "avoid",
              marginBottom: 10,
              borderRadius: 14,
              overflow: "hidden",
              cursor: "pointer",
              position: "relative",
              display: "block",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.public_url}
              alt={item.caption ?? `Photo ${index + 1}`}
              style={{ width: "100%", display: "block" }}
              loading={index < 6 ? "eager" : "lazy"}
            />
            {watermark && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={watermark.logoUrl}
                alt=""
                style={{
                  ...getWatermarkPositionStyles(watermark.position),
                  width: getWatermarkWidth(watermark.size),
                  maxWidth: 160,
                  opacity: watermark.opacity / 100,
                  objectFit: "contain",
                  userSelect: "none",
                }}
              />
            )}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: hovered === index ? "rgba(28,20,16,0.35)" : "rgba(28,20,16,0)",
                transition: "background 0.2s ease",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {hovered === index && (
                <svg width="24" height="24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                </svg>
              )}
            </div>
          </div>
        ))}
      </div>

      {lightbox !== null && (
        <div
          onClick={close}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(28,20,16,0.96)",
            zIndex: 100,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <button
            onClick={close}
            style={{
              position: "absolute", top: 20, right: 20,
              width: 40, height: 40, borderRadius: "50%",
              background: "rgba(255,255,255,0.1)", border: "none",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
            }}
          >
            <X size={18} />
          </button>

          {media.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); prev(); }}
              style={{
                position: "absolute", top: "50%", left: 20, transform: "translateY(-50%)",
                width: 44, height: 44, borderRadius: "50%",
                background: "rgba(255,255,255,0.1)", border: "0.5px solid rgba(255,255,255,0.2)",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
              }}
            >
              <ChevronLeft size={20} />
            </button>
          )}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={media[lightbox].public_url}
            alt={media[lightbox].caption ?? `Photo ${lightbox + 1}`}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "90vw", maxHeight: "85vh", objectFit: "contain", borderRadius: 10 }}
          />

          {media.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); next(); }}
              style={{
                position: "absolute", top: "50%", right: 20, transform: "translateY(-50%)",
                width: 44, height: 44, borderRadius: "50%",
                background: "rgba(255,255,255,0.1)", border: "0.5px solid rgba(255,255,255,0.2)",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
              }}
            >
              <ChevronRight size={20} />
            </button>
          )}

          {media[lightbox].caption && (
            <p style={{
              position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)",
              fontSize: 13, color: "rgba(255,255,255,0.6)",
              fontFamily: "var(--fw-font-body), system-ui, sans-serif",
              textAlign: "center", maxWidth: 480, margin: 0,
            }}>
              {media[lightbox].caption}
            </p>
          )}
        </div>
      )}
    </>
  );
}
