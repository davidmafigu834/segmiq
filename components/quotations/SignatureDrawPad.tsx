"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/sales/ui";

type Point = { x: number; y: number };

export function SignatureDrawPad({
  savedUrl,
  disabled,
  busy,
  onSave,
  onClearSaved,
}: {
  savedUrl: string | null;
  disabled?: boolean;
  busy?: boolean;
  onSave: (blob: Blob) => Promise<void>;
  onClearSaved: () => Promise<void>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<Point | null>(null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    fitCanvas(canvas);
  }, []);

  function pointerPos(event: React.PointerEvent<HTMLCanvasElement>): Point {
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
    if (disabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    last.current = pointerPos(event);
    setError(null);
  }

  function moveStroke(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || disabled) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const from = last.current;
    if (!canvas || !ctx || !from) return;
    const to = pointerPos(event);
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = Math.max(2.4, canvas.width / 240);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    last.current = to;
    setDirty(true);
  }

  function endStroke() {
    drawing.current = false;
    last.current = null;
  }

  function wipePad() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setDirty(false);
    setError(null);
  }

  async function save() {
    const canvas = canvasRef.current;
    if (!canvas || !dirty || !canvasHasInk(canvas)) {
      setError("Draw a signature first.");
      return;
    }
    setError(null);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) {
      setError("Could not capture the signature.");
      return;
    }
    try {
      await onSave(blob);
      wipePad();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the signature.");
    }
  }

  return (
    <div className="space-y-3">
      {savedUrl ? (
        <div className="rounded-[10px] border border-sales-border bg-sales-surface-subtle px-3 py-3">
          <p className="mb-2 text-[11px] uppercase tracking-wide text-sales-text-muted">Current signature</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={savedUrl} alt="Authorised signature" className="h-14 w-auto max-w-full object-contain" />
        </div>
      ) : (
        <p className="text-[12.5px] text-sales-text-secondary">
          No signature saved yet. Draw below, then save it for every quotation this company sends.
        </p>
      )}
      <div className="overflow-hidden rounded-[10px] border border-sales-border-strong bg-white">
        <canvas
          ref={canvasRef}
          className="block h-36 w-full touch-none cursor-crosshair bg-white"
          onPointerDown={startStroke}
          onPointerMove={moveStroke}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
          onPointerLeave={endStroke}
        />
      </div>
      {error ? <p className="text-[12px] text-sales-danger">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" size="sm" disabled={disabled || busy || !dirty} loading={busy} onClick={() => void save()}>
          Save signature
        </Button>
        <Button variant="secondary" size="sm" disabled={disabled || busy || !dirty} onClick={wipePad}>
          Clear pad
        </Button>
        {savedUrl ? (
          <Button variant="ghost" size="sm" disabled={disabled || busy} onClick={() => void onClearSaved()}>
            Remove saved signature
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function fitCanvas(canvas: HTMLCanvasElement) {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = canvas.clientWidth || 560;
  const height = canvas.clientHeight || 144;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
}

export function canvasHasInk(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 3; i < data.length; i += 16) {
    if (data[i] > 12) return true;
  }
  return false;
}
