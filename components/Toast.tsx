"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
} from "react";
import { Check, X } from "lucide-react";

type ToastType = "success" | "error";

interface ToastState {
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: ToastType) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ message, type });
    timerRef.current = setTimeout(() => {
      setToast(null);
      timerRef.current = null;
    }, 2500);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <>
          <style>{`
            @keyframes toastIn {
              from { opacity: 0; transform: translateY(20px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
          <div
            role="status"
            style={{
              position: "fixed",
              bottom: 24,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 2000,
              padding: "12px 24px",
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 600,
              color: "#fff",
              background: toast.type === "success" ? "#16a34a" : "#dc2626",
              boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              animation: "toastIn 0.25s ease",
            }}
          >
            {toast.type === "success" ? (
              <Check size={15} />
            ) : (
              <X size={15} />
            )}
            {toast.message}
          </div>
        </>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
