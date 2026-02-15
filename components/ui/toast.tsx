"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type ToastVariant = "default" | "success" | "error";

type Toast = {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration: number;
};

type ToastOptions = Omit<Toast, "id"> & { duration?: number };

type ToastContextValue = {
  toasts: Toast[];
  toast: (options: ToastOptions) => void;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 1800;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const toast = useCallback(
    ({ duration = DEFAULT_DURATION, ...options }: ToastOptions) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const next: Toast = {
        id,
        duration,
        ...options,
      };
      setToasts((current) => [...current, next]);
      if (duration > 0) {
        window.setTimeout(() => dismiss(id), duration);
      }
    },
    [dismiss]
  );

  const value = useMemo(() => ({ toasts, toast, dismiss }), [toasts, toast, dismiss]);

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-[320px] flex-col gap-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto rounded-lg border px-4 py-3 shadow-lg transition ${
            toast.variant === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : toast.variant === "error"
              ? "border-red-200 bg-red-50 text-red-900"
              : "border-slate-200 bg-white text-slate-900"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{toast.title}</p>
              {toast.description && (
                <p className="mt-1 text-xs text-slate-600">{toast.description}</p>
              )}
            </div>
            <button
              type="button"
              className="text-xs text-slate-500 hover:text-slate-800"
              onClick={() => dismiss(toast.id)}
              aria-label="닫기"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
