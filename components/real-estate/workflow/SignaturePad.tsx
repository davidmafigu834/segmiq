"use client";

import { useEffect, useRef, useState } from "react";

export function SignaturePad({ onChange }: { onChange: (dataUrl: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const ink = useRef("");
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function resize() {
      const current = canvasRef.current;
      if (!current) return;
      const snapshot = ink.current;
      if (!fitCanvas(current)) return;
      if (snapshot) paintImage(current, snapshot);
    }

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  function pointerPos(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }

  function startStroke(event: React.PointerEvent<HTMLCanvasElement>) {
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // A live pointer is required for capture. The stroke still draws.
    }
    drawing.current = true;
    const point = pointerPos(event);
    last.current = point;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.fillStyle = "#1c1917";
    ctx.beginPath();
    ctx.arc(point.x, point.y, Math.max(1.3, canvas.width / 480), 0, Math.PI * 2);
    ctx.fill();
    setHasInk(true);
  }

  function moveStroke(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const from = last.current;
    if (!canvas || !ctx || !from) return;
    const to = pointerPos(event);
    ctx.strokeStyle = "#1c1917";
    ctx.lineWidth = Math.max(2.2, canvas.width / 280);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    last.current = to;
    if (!hasInk) setHasInk(true);
  }

  function endStroke() {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    const canvas = canvasRef.current;
    if (!canvas || !canvasHasInk(canvas)) {
      ink.current = "";
      setHasInk(false);
      onChange("");
      return;
    }
    const url = canvas.toDataURL("image/png");
    ink.current = url;
    setHasInk(true);
    onChange(url);
  }

  function clearPad() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ink.current = "";
    setHasInk(false);
    onChange("");
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-medium text-sales-text-secondary">Draw your signature</p>
        <button
          type="button"
          onClick={clearPad}
          disabled={!hasInk}
          className="text-[13px] font-semibold text-sales-text-secondary underline-offset-2 hover:text-sales-text-primary hover:underline disabled:pointer-events-none disabled:opacity-40"
        >
          Clear
        </button>
      </div>
      <div className="relative mt-1 overflow-hidden rounded-[10px] border border-sales-border bg-white">
        <canvas
          ref={canvasRef}
          aria-label="Draw your signature"
          className="relative z-10 block h-36 w-full touch-none bg-transparent"
          style={{ cursor: "crosshair" }}
          onPointerDown={startStroke}
          onPointerMove={moveStroke}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
        />
        <div className="pointer-events-none absolute inset-x-4 bottom-8 border-b border-neutral-300" aria-hidden />
        {hasInk ? null : (
          <p className="pointer-events-none absolute inset-x-4 bottom-10 text-[13px] text-neutral-400">Sign here</p>
        )}
      </div>
    </div>
  );
}

function fitCanvas(canvas: HTMLCanvasElement) {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.round((canvas.clientWidth || 560) * ratio);
  const height = Math.round((canvas.clientHeight || 144) * ratio);
  if (canvas.width === width && canvas.height === height) return false;
  canvas.width = width;
  canvas.height = height;
  return true;
}

function paintImage(canvas: HTMLCanvasElement, dataUrl: string) {
  const image = new Image();
  image.onload = () => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  };
  image.src = dataUrl;
}

function canvasHasInk(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 3; i < data.length; i += 16) {
    if (data[i] > 12) return true;
  }
  return false;
}
