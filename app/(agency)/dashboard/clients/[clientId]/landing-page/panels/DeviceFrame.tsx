"use client";

import { useEffect, useRef, useState, type Ref, type RefObject } from "react";
import type { PreviewDevice } from "./preview-types";

const TARGET_WIDTHS: Record<PreviewDevice, number> = {
  desktop: 1280,
  tablet: 768,
  mobile: 375,
};

const TARGET_HEIGHTS: Record<PreviewDevice, number> = {
  desktop: 800,
  tablet: 1024,
  mobile: 812,
};

export function DeviceFrame({
  mode,
  src,
  iframeRef,
  onLoad,
}: {
  mode: PreviewDevice;
  iframeRef: RefObject<HTMLIFrameElement | null>;
  src: string;
  onLoad?: () => void;
}) {
  const targetWidth = TARGET_WIDTHS[mode];
  const targetHeight = TARGET_HEIGHTS[mode];
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const resize = () => {
      const availWidth = container.clientWidth - 64;
      const availHeight = container.clientHeight - 64;
      const scaleX = availWidth / targetWidth;
      const scaleY = availHeight / targetHeight;
      const next = Math.min(scaleX, scaleY, 1);
      setScale(next > 0 ? next : 1);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [mode, targetWidth, targetHeight]);

  const radius = mode === "mobile" ? 24 : mode === "tablet" ? 16 : 8;

  return (
    <div
      ref={containerRef}
      className="relative min-h-0 flex-1 overflow-hidden"
    >
      <div
        className="overflow-hidden border border-[var(--border)] bg-white shadow-sm"
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: targetWidth,
          height: targetHeight,
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: "center center",
          borderRadius: radius,
        }}
      >
        <iframe
          ref={iframeRef as Ref<HTMLIFrameElement>}
          key={`${src}-${mode}`}
          title="Landing preview"
          src={src}
          className="block border-0"
          style={{ width: targetWidth, height: targetHeight }}
          onLoad={onLoad}
        />
      </div>
    </div>
  );
}
