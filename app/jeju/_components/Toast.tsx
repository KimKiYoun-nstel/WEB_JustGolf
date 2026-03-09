"use client";

import { useEffect } from "react";

type ToastType = "success" | "error" | "warning" | "info";

interface ToastProps {
  message: string;
  type?: ToastType;
  onDismiss: () => void;
}

export default function Toast({ message, type = "success", onDismiss }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3500);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="dal-toast-container">
      <div className={`dal-toast dal-toast-${type}`}>{message}</div>
    </div>
  );
}
