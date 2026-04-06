"use client";

import { useStats } from "@/hooks/useStats";
import { useRouter, usePathname } from "next/navigation";
import { File, Clock, Check, X, Zap } from "lucide-react";
import type { ReactNode } from "react";

interface StatsStripProps {
  activeFilter?: string;
}

interface StatCardConfig {
  label: string;
  key: "total_files" | "pending_review" | "approved" | "rejected" | "avg_score";
  icon: ReactNode;
  accent: string;
  href: string | null;
}

const CARDS: StatCardConfig[] = [
  { label: "Total Files", key: "total_files", icon: <File size={18} />, accent: "#7c3aed", href: "/files" },
  { label: "Pending Review", key: "pending_review", icon: <Clock size={18} />, accent: "#d97706", href: "/files?tab=pending" },
  { label: "Approved / In S3", key: "approved", icon: <Check size={18} />, accent: "#16a34a", href: "/files?status=in_s3" },
  { label: "Rejected", key: "rejected", icon: <X size={18} />, accent: "#dc2626", href: "/files?status=rejected" },
  { label: "Avg Score", key: "avg_score", icon: <Zap size={18} />, accent: "#0891b2", href: null },
];

function isCardActive(card: StatCardConfig, pathname: string, searchParams: string): boolean {
  if (!card.href) return false;

  const [cardPath, cardQuery] = card.href.split("?");
  if (pathname !== cardPath) return false;

  // If the card has no query params, it's active only when the page has no filtering params
  if (!cardQuery) {
    return !searchParams.includes("status=") && !searchParams.includes("tab=");
  }

  // If the card has query params, check they match
  return searchParams.includes(cardQuery);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function StatsStrip({ activeFilter: _activeFilter }: StatsStripProps) {
  const { data: stats, isLoading } = useStats();
  const router = useRouter();
  const pathname = usePathname();

  // Build search params string from window.location for active state detection
  const searchParams = typeof window !== "undefined" ? window.location.search : "";

  if (isLoading || !stats) {
    return (
      <div className="stats-grid" style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              minWidth: 140,
              background: "#fff",
              border: "1.5px solid #e5e7eb",
              borderRadius: 14,
              padding: "16px 18px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div className="skeleton-pulse" style={{ width: 80, height: 12, borderRadius: 4 }} />
              <div className="skeleton-pulse" style={{ width: 18, height: 18, borderRadius: 4 }} />
            </div>
            <div className="skeleton-pulse" style={{ width: 60, height: 28, borderRadius: 6 }} />
          </div>
        ))}
        <style>{`
          @keyframes skeleton-pulse {
            0%, 100% { opacity: 0.4; }
            50% { opacity: 0.15; }
          }
          .skeleton-pulse {
            background: #d1d5db;
            animation: skeleton-pulse 1.5s ease-in-out infinite;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="stats-grid" style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
      {CARDS.map((card) => {
        const active = isCardActive(card, pathname, searchParams);
        const value =
          card.key === "avg_score"
            ? `${Math.round((stats.avg_score || 0) * 100)}%`
            : stats[card.key];

        return (
          <button
            key={card.key}
            onClick={() => {
              if (card.href) router.push(card.href);
            }}
            style={{
              flex: 1,
              minWidth: 140,
              background: active ? `${card.accent}08` : "#fff",
              border: `1.5px solid ${active ? card.accent : "#e5e7eb"}`,
              borderRadius: 14,
              padding: "16px 18px",
              cursor: "pointer",
              textAlign: "left" as const,
              transition: "all 0.2s",
              boxShadow: active
                ? `0 0 0 3px ${card.accent}18`
                : "0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#6b7280",
                  letterSpacing: "0.02em",
                  textTransform: "uppercase" as const,
                }}
              >
                {card.label}
              </span>
              <span style={{ opacity: 0.5 }}>{card.icon}</span>
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: card.accent,
                fontFamily: "'DM Sans', sans-serif",
                letterSpacing: "-0.02em",
              }}
            >
              {value}
            </div>
          </button>
        );
      })}
    </div>
  );
}
