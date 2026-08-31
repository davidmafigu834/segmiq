"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from "lucide-react";
import { IconButton } from "./Button";
import { SALES_OVERLAY } from "@/lib/sales/design-tokens";
import { cn } from "@/lib/ui/cn";

export type ToastTone = "success" | "info" | "warning" | "error";

type ToastItem = {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
};

type ToastContextValue = {
  toast: (opts: { tone?: ToastTone; title: string; description?: string }) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const toneIcon = {
  success: CheckCircle2,
  info: Info,
  warning: TriangleAlert,
  error: XCircle,
} as const;

const toneIconClass = {
  success: "text-sales-success",
  info: "text-sales-info",
  warning: "text-sales-warning",
  error: "text-sales-danger",
} as const;

const toneAccent = {
  success: "border-l-sales-success bg-sales-success-soft/35",
  info: "border-l-sales-info bg-sales-info-soft/35",
  warning: "border-l-sales-warning bg-sales-warning-soft/35",
  error: "border-l-sales-danger bg-sales-danger-soft/35",
} as const;

const toneIconWell = {
  success: "bg-sales-success-soft text-sales-success",
  info: "bg-sales-info-soft text-sales-info",
  warning: "bg-sales-warning-soft text-sales-warning",
  error: "bg-sales-danger-soft text-sales-danger",
} as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (opts: { tone?: ToastTone; title: string; description?: string }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const item: ToastItem = {
        id,
        tone: opts.tone ?? "info",
        title: opts.title,
        description: opts.description,
      };
      setItems((prev) => [...prev.slice(-(SALES_OVERLAY.toastMaxVisible - 1)), item]);
      window.setTimeout(() => dismiss(id), SALES_OVERLAY.toastDurationMs);
    },
    [dismiss]
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="sales-mobile-toast-anchor pointer-events-none fixed right-4 top-4 z-[var(--sales-z-toast,100)] flex w-[min(100%-2rem,360px)] flex-col gap-2"
        aria-live="polite"
        aria-relevant="additions"
      >
        {items.map((item) => {
          const Icon = toneIcon[item.tone];
          const isError = item.tone === "error";
          return (
            <div
              key={item.id}
              className={cn(
                "sales-toast-item pointer-events-auto flex gap-3 rounded-[11px] border border-sales-border border-l-[3px] bg-[var(--sales-surface-raised,var(--sales-surface))] p-3.5 shadow-sales-popover",
                toneAccent[item.tone]
              )}
              role={isError ? "alert" : "status"}
              aria-live={isError ? "assertive" : "polite"}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px]",
                  toneIconWell[item.tone]
                )}
              >
                <Icon size={16} strokeWidth={1.8} className={toneIconClass[item.tone]} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-sales-text-primary">{item.title}</p>
                {item.description ? (
                  <p className="mt-0.5 text-[12px] text-sales-text-secondary">{item.description}</p>
                ) : null}
              </div>
              <IconButton
                aria-label="Dismiss notification"
                size="sm"
                className="shrink-0 self-start"
                onClick={() => dismiss(item.id)}
              >
                <X strokeWidth={1.8} />
              </IconButton>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useSalesToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      toast: (opts: { tone?: ToastTone; title: string; description?: string }) => {
        if (typeof window !== "undefined") {
          // Fallback when provider missing — console only in dev
          console.info(`[toast] ${opts.tone ?? "info"}: ${opts.title}`, opts.description);
        }
      },
    };
  }
  return ctx;
}
