"use client";

import { useState } from "react";
import Link from "next/link";
import Badge from "@/components/Badge";
import type { SourceListItem } from "@/lib/types";

interface SourcesTableProps {
  sources: SourceListItem[];
  activeJobs: Record<string, string>;
  isLoading?: boolean;
  emptyMessage?: string;
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
}

const COLUMNS = ["Label", "URL", "Brand", "Region", "Section", "Last Ingested", "Created"];

function SkeletonBlock({ width }: { width: number | string }) {
  return (
    <div
      style={{
        width,
        height: 14,
        borderRadius: 6,
        background: "#e5e7eb",
        animation: "pulse 1.5s ease-in-out infinite",
      }}
    />
  );
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SourcesTable({
  sources,
  activeJobs,
  isLoading,
  emptyMessage = "No sources found.",
  page = 1,
  totalPages = 1,
  onPageChange,
}: SourcesTableProps) {
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  const renderSkeletonRows = () =>
    Array.from({ length: 5 }).map((_, i) => (
      <tr key={`skeleton-${i}`} style={{ borderBottom: "1px solid #f3f4f6" }}>
        <td style={{ padding: "13px 16px" }}><SkeletonBlock width={120} /></td>
        <td style={{ padding: "13px 16px" }}><SkeletonBlock width={200} /></td>
        <td style={{ padding: "13px 16px" }}><SkeletonBlock width={60} /></td>
        <td style={{ padding: "13px 16px" }}><SkeletonBlock width={50} /></td>
        <td style={{ padding: "13px 16px" }}><SkeletonBlock width={80} /></td>
        <td style={{ padding: "13px 16px" }}><SkeletonBlock width={90} /></td>
        <td style={{ padding: "13px 16px" }}><SkeletonBlock width={90} /></td>
      </tr>
    ));

  const renderRow = (source: SourceListItem) => {
    const isActive = !!activeJobs[source.id];

    return (
      <tr
        key={source.id}
        onMouseEnter={() => setHoveredRow(source.id)}
        onMouseLeave={() => setHoveredRow(null)}
        style={{
          borderBottom: "1px solid #f3f4f6",
          cursor: "pointer",
          background: hoveredRow === source.id ? "#faf5ff" : "transparent",
          transition: "background 0.15s ease",
        }}
      >
        <td style={{ padding: "13px 16px" }}>
          <Link
            href={`/sources/${source.id}`}
            style={{ textDecoration: "none", color: "#111827", fontSize: 13.5, fontWeight: 600 }}
          >
            {source.nav_label || "—"}
          </Link>
        </td>
        <td style={{ padding: "13px 16px" }}>
          <Link
            href={`/sources/${source.id}`}
            style={{
              textDecoration: "none",
              fontSize: 12,
              color: "#6b7280",
              fontFamily: "var(--font-dm-mono), 'DM Mono', monospace",
              wordBreak: "break-all",
            }}
          >
            {source.url}
          </Link>
        </td>
        <td style={{ padding: "13px 16px" }}>
          <Badge label={source.brand} color="#7c3aed" bg="#f3f0ff" />
        </td>
        <td style={{ padding: "13px 16px" }}>
          <Badge label={source.region} color="#0891b2" bg="#ecfeff" />
        </td>
        <td style={{ padding: "13px 16px", fontSize: 13, color: "#374151" }}>
          {source.nav_section || "—"}
        </td>
        <td style={{ padding: "13px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {isActive && (
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#7c3aed",
                  animation: "pulse 1.5s ease-in-out infinite",
                  flexShrink: 0,
                }}
              />
            )}
            <span
              style={{
                fontSize: 12,
                color: isActive ? "#7c3aed" : "#9ca3af",
                fontWeight: isActive ? 600 : 400,
                fontFamily: "var(--font-dm-mono), 'DM Mono', monospace",
              }}
            >
              {isActive ? "Processing..." : fmtDate(source.last_ingested_at)}
            </span>
          </div>
        </td>
        <td
          style={{
            padding: "13px 16px",
            fontSize: 12,
            color: "#9ca3af",
            fontFamily: "var(--font-dm-mono), 'DM Mono', monospace",
          }}
        >
          {fmtDate(source.created_at)}
        </td>
      </tr>
    );
  };

  const renderPagination = () => {
    if (!totalPages || totalPages <= 1) return null;
    const pages: number[] = [];
    for (let i = 1; i <= totalPages; i++) pages.push(i);

    return (
      <div
        style={{
          padding: "12px 16px",
          borderTop: "1px solid #f3f4f6",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 8,
        }}
      >
        <button
          onClick={() => onPageChange?.(page - 1)}
          disabled={page <= 1}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            fontSize: 13,
            cursor: page <= 1 ? "default" : "pointer",
            opacity: page <= 1 ? 0.5 : 1,
            background: "#fff",
            color: "#6b7280",
            border: "1px solid #e5e7eb",
          }}
        >
          Prev
        </button>
        {pages.map((p) => (
          <button
            key={p}
            onClick={() => onPageChange?.(p)}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              fontSize: 13,
              cursor: "pointer",
              background: p === page ? "#7c3aed" : "#fff",
              color: p === page ? "#fff" : "#6b7280",
              border: p === page ? "none" : "1px solid #e5e7eb",
            }}
          >
            {p}
          </button>
        ))}
        <button
          onClick={() => onPageChange?.(page + 1)}
          disabled={page >= totalPages}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            fontSize: 13,
            cursor: page >= totalPages ? "default" : "pointer",
            opacity: page >= totalPages ? 0.5 : 1,
            background: "#fff",
            color: "#6b7280",
            border: "1px solid #e5e7eb",
          }}
        >
          Next
        </button>
      </div>
    );
  };

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 14,
        border: "1px solid #ede9fe",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #f3f0ff" }}>
            {COLUMNS.map((col) => (
              <th
                key={col}
                style={{
                  padding: "12px 16px",
                  textAlign: "left",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#9ca3af",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            renderSkeletonRows()
          ) : sources.length === 0 ? (
            <tr>
              <td
                colSpan={COLUMNS.length}
                style={{ padding: 48, textAlign: "center", color: "#9ca3af", fontSize: 14 }}
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sources.map(renderRow)
          )}
        </tbody>
      </table>
      {!isLoading && sources.length > 0 && renderPagination()}
    </div>
  );
}
