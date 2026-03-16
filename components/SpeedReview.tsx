"use client";

import { useState, useCallback } from "react";
import { ArrowLeft, X, Check } from "lucide-react";
import { useSWRConfig } from "swr";
import SpeedCard from "@/components/SpeedCard";
import { useQueueFiles } from "@/hooks/useQueueFiles";
import { useFileDetail } from "@/hooks/useFileDetail";
import { acceptFile, rejectFile } from "@/lib/api";
import { useToast } from "@/components/Toast";

import type { KBFileListItem } from "@/lib/types";

interface SpeedReviewProps {
  onExit: () => void;
  onDetail?: (file: KBFileListItem) => void;
}

export default function SpeedReview({ onExit, onDetail }: SpeedReviewProps) {
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(0);
  const { mutate } = useSWRConfig();
  const { showToast } = useToast();

  const { data, isLoading, error, mutate: queueMutate } = useQueueFiles({ page: 1, size: 100 });
  const files = data?.items || [];
  const cur = files[idx];
  const total = files.length;

  const { data: fileDetail } = useFileDetail(cur?.id || null, "queue");

  const reviewer =
    process.env.NEXT_PUBLIC_REVIEWER_EMAIL || "reviewer@example.com";

  const accept = useCallback(
    async (id: string) => {
      const optimisticData = data
        ? {
            ...data,
            items: data.items.filter((f) => f.id !== id),
            total: data.total - 1,
          }
        : undefined;

      try {
        setDone((d) => d + 1);
        setTimeout(() => setIdx((i) => i + 1), 50);
        await queueMutate(
          async () => {
            await acceptFile(id, reviewer);
            return undefined as unknown as typeof data;
          },
          {
            optimisticData,
            rollbackOnError: true,
            revalidate: true,
          }
        );
        await mutate(
          (key: unknown) => typeof key === "string" && key === "stats"
        );
        showToast("File accepted → S3 upload queued", "success");
      } catch {
        showToast("Failed to accept file. Please try again.", "error");
      }
    },
    [data, reviewer, queueMutate, mutate, showToast]
  );

  const reject = useCallback(
    async (id: string) => {
      const optimisticData = data
        ? {
            ...data,
            items: data.items.filter((f) => f.id !== id),
            total: data.total - 1,
          }
        : undefined;

      try {
        setDone((d) => d + 1);
        setTimeout(() => setIdx((i) => i + 1), 50);
        await queueMutate(
          async () => {
            await rejectFile(id, reviewer, "Rejected via speed review");
            return undefined as unknown as typeof data;
          },
          {
            optimisticData,
            rollbackOnError: true,
            revalidate: true,
          }
        );
        await mutate(
          (key: unknown) => typeof key === "string" && key === "stats"
        );
        showToast("File rejected", "error");
      } catch {
        showToast("Failed to reject file. Please try again.", "error");
      }
    },
    [data, reviewer, queueMutate, mutate, showToast]
  );

  // Loading state
  if (isLoading) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            border: "3px solid #e5e7eb",
            borderTopColor: "#7c3aed",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            border: "1px solid #fecaca",
            padding: "32px 24px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 14, color: "#dc2626", marginBottom: 12 }}>
            Failed to load data.
          </div>
          <button
            onClick={() => queueMutate()}
            style={{
              padding: "8px 20px",
              background: "#7c3aed",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "24px 32px",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <button
          onClick={onExit}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 16px",
            background: "#fff",
            border: "1.5px solid #e5e7eb",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 600,
            color: "#6b7280",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          <ArrowLeft size={14} /> Back to Table
        </button>
        <div style={{ display: "flex", gap: 16, fontSize: 13, color: "#9ca3af" }}>
          <span>
            <span style={{ fontWeight: 700, color: "#7c3aed" }}>{done}</span>{" "}
            reviewed
          </span>
          <span>
            <span style={{ fontWeight: 700, color: "#d97706" }}>
              {files.length - idx}
            </span>{" "}
            remaining
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          height: 4,
          background: "#f3f4f6",
          borderRadius: 2,
          marginBottom: 28,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            background: "linear-gradient(90deg, #7c3aed, #a78bfa)",
            borderRadius: 2,
            width: `${total > 0 ? (done / total) * 100 : 0}%`,
            transition: "width 0.3s ease",
          }}
        />
      </div>

      {/* Card area */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          width: "100%",
        }}
      >
        {cur ? (
          <div style={{ position: "relative" }}>
            {/* Shadow preview of next card */}
            {files[idx + 1] && (
              <div
                style={{
                  position: "absolute",
                  top: 10,
                  left: "50%",
                  transform: "translateX(-50%) scale(0.94)",
                  width: 440,
                  maxWidth: "92vw",
                  height: 80,
                  background: "#fff",
                  borderRadius: 24,
                  boxShadow: "0 10px 30px rgba(0,0,0,0.04)",
                  opacity: 0.5,
                }}
              />
            )}
            <SpeedCard
              file={cur}
              fileDetail={fileDetail}
              onAccept={accept}
              onReject={reject}
              onDetail={onDetail ? () => onDetail(cur) : () => {}}
            />
          </div>
        ) : (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>🎉</div>
            <h3
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: "#111827",
                marginBottom: 8,
              }}
            >
              Queue cleared!
            </h3>
            <p
              style={{
                color: "#6b7280",
                fontSize: 14,
                marginBottom: 24,
              }}
            >
              You reviewed {done} file{done !== 1 ? "s" : ""} in this session.
            </p>
            <button
              onClick={onExit}
              style={{
                padding: "12px 28px",
                background: "#7c3aed",
                color: "#fff",
                border: "none",
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Back to Dashboard
            </button>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      {cur && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 40,
            padding: "24px 0",
            color: "#9ca3af",
          }}
        >
          <button
            onClick={() => reject(cur.id)}
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              border: "2.5px solid #fca5a5",
              background: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "all 0.15s",
              boxShadow: "0 2px 8px rgba(220,38,38,0.1)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#fef2f2";
              e.currentTarget.style.transform = "scale(1.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#fff";
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            <X size={22} color="#dc2626" />
          </button>
          <div style={{ fontSize: 13, color: "#d1d5db", fontWeight: 500 }}>
            ← swipe →
          </div>
          <button
            onClick={() => accept(cur.id)}
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              border: "2.5px solid #86efac",
              background: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "all 0.15s",
              boxShadow: "0 2px 8px rgba(22,163,74,0.1)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#f0fdf4";
              e.currentTarget.style.transform = "scale(1.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#fff";
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            <Check size={22} color="#16a34a" />
          </button>
        </div>
      )}
    </div>
  );
}
