"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "./button";

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  title?: string;
  side?: "left" | "right" | "top" | "bottom";
}

interface SheetContentProps {
  children: React.ReactNode;
  className?: string;
}

export function Sheet({ open, onOpenChange, children, side = "right" }: SheetProps) {
  const [isOpen, setIsOpen] = useState(open);

  useEffect(() => {
    setIsOpen(open);
  }, [open]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const handleClose = () => {
    setIsOpen(false);
    onOpenChange(false);
  };

  if (!isOpen) return null;

  const sideClasses = {
    left: "left-0 top-0 h-full w-64 rounded-none",
    right: "right-0 top-0 h-full w-64 rounded-none",
    top: "top-0 left-0 right-0 h-auto rounded-none",
    bottom: "bottom-0 left-0 right-0 h-auto rounded-none",
  };

  const translateClasses = {
    left: isOpen ? "translate-x-0" : "-translate-x-full",
    right: isOpen ? "translate-x-0" : "translate-x-full",
    top: isOpen ? "translate-y-0" : "-translate-y-full",
    bottom: isOpen ? "translate-y-0" : "translate-y-full",
  };

  return (
    <>
      {/* 백드롭 */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={handleClose}
      />

      {/* 시트 */}
      <div
        className={`fixed z-50 bg-white shadow-lg transition-transform duration-200 ${sideClasses[side]} ${translateClasses[side]}`}
      >
        {children}
      </div>
    </>
  );
}

export function SheetContent({ children, className = "" }: SheetContentProps) {
  return <div className={`h-full overflow-y-auto p-6 ${className}`}>{children}</div>;
}

export function SheetHeader({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex items-center justify-between border-b pb-4 ${className}`}>{children}</div>;
}

export function SheetTitle({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <h2 className={`text-lg font-semibold text-slate-900 ${className}`}>{children}</h2>;
}

export function SheetClose({ onClick, className = "" }: { onClick?: () => void; className?: string }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={`h-8 w-8 p-0 ${className}`}
    >
      <X className="h-4 w-4" />
      <span className="sr-only">Close</span>
    </Button>
  );
}
