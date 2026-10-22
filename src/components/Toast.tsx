"use client";

import { useState, useCallback, useRef, createContext, useContext } from "react";
import { CheckIcon, WarningIcon, XIcon } from "@/components/icons";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const styles: Record<ToastType, string> = {
  success: "bg-gray-900 border-emerald-600/50 text-emerald-200",
  error: "bg-gray-900 border-red-600/60 text-red-200",
  info: "bg-gray-900 border-blue-600/50 text-blue-200",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType) => {
      const id = ++nextId.current;
      setToasts((prev) => [...prev, { id, message, type }]);
      // Errors stay until dismissed so they can actually be read
      if (type !== "error") setTimeout(() => dismiss(id), 5000);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 left-4 sm:left-auto z-[70] flex flex-col gap-2 sm:w-96"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.type === "error" ? "alert" : "status"}
            className={`flex items-start gap-3 pl-4 pr-2 py-3 rounded-xl border shadow-xl text-sm animate-slide-in ${styles[toast.type]}`}
          >
            {toast.type === "error" ? (
              <WarningIcon className="w-4 h-4 mt-0.5 shrink-0 text-red-400" />
            ) : (
              <CheckIcon className={`w-4 h-4 mt-0.5 shrink-0 ${toast.type === "success" ? "text-emerald-400" : "text-blue-400"}`} />
            )}
            <p className="flex-1 leading-snug">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss"
              className="p-1 text-gray-500 hover:text-gray-200 rounded cursor-pointer"
            >
              <XIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
