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

const toneBorder = {
  success: "border-sales-success/25",
  info: "border-sales-info/25",
  warning: "border-sales-warning/30",
  error: "border-sales-danger/25",
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
      setItems((prev) => [...prev.slice(-3), item]);
      window.setTimeout(() => dismiss(id), 4200);
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
      >
        {items.map((item) => {
          const Icon = toneIcon[item.tone];
          return (
            <div
              key={item.id}
              className={cn(
                "pointer-events-auto flex gap-3 rounded-sales-lg border bg-sales-surface p-3.5 shadow-sales-popover",
                toneBorder[item.tone]
              )}
              role="status"
            >
              <Icon
                size={18}
                strokeWidth={1.8}
                className={cn("mt-0.5 shrink-0", toneIconClass[item.tone])}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-sales-text-primary">{item.title}</p>
                {item.description ? (
                  <p className="mt-0.5 text-[12px] text-sales-text-secondary">{item.description}</p>
                ) : null}
              </div>
              <button
                type="button"
                className="shrink-0 rounded-sales-sm p-1 text-sales-text-muted hover:text-sales-text-primary"
                aria-label="Dismiss"
                onClick={() => dismiss(item.id)}
              >
                <X size={14} strokeWidth={1.8} />
              </button>
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
