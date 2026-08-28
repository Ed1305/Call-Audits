"use client";

import { useEffect, useState } from "react";
import { X, CheckCircle, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

let toastListeners: ((toasts: Toast[]) => void)[] = [];
let toasts: Toast[] = [];

function notify() {
  toastListeners.forEach((l) => l([...toasts]));
}

export function showToast(message: string, type: Toast["type"] = "info") {
  const id = Math.random().toString(36).slice(2);
  toasts = [...toasts, { id, message, type }];
  notify();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    notify();
  }, 4000);
}

export function ToastContainer() {
  const [items, setItems] = useState<Toast[]>([]);

  useEffect(() => {
    const listener = (t: Toast[]) => setItems(t);
    toastListeners.push(listener);
    return () => {
      toastListeners = toastListeners.filter((l) => l !== listener);
    };
  }, []);

  const icons = {
    success: CheckCircle,
    error: AlertCircle,
    info: Info,
  };

  return (
    <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none">
      {items.map((toast) => {
        const Icon = icons[toast.type];
        return (
          <div
            key={toast.id}
            className={cn(
              "pointer-events-auto flex items-center gap-3 px-5 py-3 rounded-full shadow-gnome-lg",
              "bg-ubuntu-topbar text-ubuntu-text-light animate-slide-in",
              "border border-ubuntu-border-dark min-w-[280px] max-w-md"
            )}
          >
            <Icon
              className={cn(
                "w-5 h-5 shrink-0",
                toast.type === "success" && "text-ubuntu-maximize",
                toast.type === "error" && "text-ubuntu-close",
                toast.type === "info" && "text-ubuntu-orange"
              )}
            />
            <span className="text-sm font-ubuntu flex-1">{toast.message}</span>
            <button
              onClick={() => {
                toasts = toasts.filter((t) => t.id !== toast.id);
                notify();
              }}
              className="opacity-60 hover:opacity-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
