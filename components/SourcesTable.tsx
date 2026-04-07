"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Badge from "@/components/Badge";
import { ChevronUp, ChevronDown, ChevronsUpDown, Search, X } from "lucide-react";
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

type SortKey = "nav_label" | "url" | "brand" | "region" | "nav_section" | "last_ingested_at" | "created_at";
type SortDir = "asc" | "desc";

interface ColumnDef {
  label: string;
  key: SortKey;
  filterable?: boolean;
  width?: string;
}

const COLUMNS: ColumnDef[] = [
  { label: "Label", key: "nav_label", filterable: true },
  { label: "URL", key: "url", filterable: true },
  { label: "Brand", key: "brand", filterable: true },
  { label: "Region", key: "region", filterable: true },
  { label: "Section", key: "nav_section", filterable: true },
  { label: "Last Ingested", key: "last_ingested_at" },
  { label: "Created", key: "created_at" },
];

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

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronsUpDown size={12} style={{ opacity: 0.3 }} />;
  return dir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
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
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filters, setFilters] = useState<Partial<Record<SortKey, string>>>({});
  const [showFilters, setShowFilters] = useState(false);

  const hasActiveFilters = Object.values(filters).some((v) => v && v.trim() !== "");

  const processedSources = useMemo(() => {
    let result = [...sources];

    // Apply filters
    for (const [key, value] of Object.entries(filters)) {
      if (!value || !value.trim()) continue;
      const lower = value.toLowerCase();
      result = result.filter((s) => {
        const field = s[key as keyof SourceListItem];
        return field != null && String(field).toLowerCase().includes(lower);
      });
    }

    // Apply sort
    if (sortKey) {
      result.sort((a, b) => {
        const aVal = a[sortKey] ?? "";
        const bVal = b[sortKey] ?? "";
        const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true, sensitivity: "base" });
        return sortDir === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [sources, filters, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const handleFilterChange = (key: SortKey, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({});
    setShowFilters(false);
  };

  const renderSkeletonRows = () =>
    Array.from({ length: 5 }).map((_, i) => (
      <tr key={`skeleton-${i}`} style={{ borderBottom: "1px solid #f3f4f6" }}>
        {COLUMNS.map((col) => (
          <td key={col.key} style={{ padding: "13px 16px" }}>
            <SkeletonBlock width={col.key === "url" ? 200 : 90} />
          </td>
        ))}
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

      {/* Table toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 16px",
          borderBottom: "1px solid #f3f4f6",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => setShowFilters((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              background: showFilters || hasActiveFilters ? "#f3f0ff" : "#fff",
              color: showFilters || hasActiveFilters ? "#7c3aed" : "#6b7280",
              border: `1px solid ${showFilters || hasActiveFilters ? "#ddd6fe" : "#e5e7eb"}`,
            }}
          >
            <Search size={12} /> Filter
          </button>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "6px 10px",
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                background: "#fef2f2",
                color: "#dc2626",
                border: "1px solid #fecaca",
              }}
            >
              <X size={11} /> Clear filters
            </button>
          )}
        </div>
        {!isLoading && (
          <span style={{ fontSize: 12, color: "#9ca3af" }}>
            {processedSources.length} of {sources.length} source{sources.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #f3f0ff" }}>
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                onClick={() => handleSort(col.key)}
                style={{
                  padding: "12px 16px",
                  textAlign: "left",
                  fontSize: 11,
                  fontWeight: 700,
                  color: sortKey === col.key ? "#7c3aed" : "#9ca3af",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  cursor: "pointer",
                  userSelect: "none",
                  whiteSpace: "nowrap",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  {col.label}
                  <SortIcon active={sortKey === col.key} dir={sortDir} />
                </div>
              </th>
            ))}
          </tr>
          {showFilters && (
            <tr style={{ borderBottom: "1px solid #f3f0ff", background: "#faf5ff" }}>
              {COLUMNS.map((col) => (
                <th key={`filter-${col.key}`} style={{ padding: "6px 16px" }}>
                  {col.filterable ? (
                    <input
                      value={filters[col.key] || ""}
                      onChange={(e) => handleFilterChange(col.key, e.target.value)}
                      placeholder={`Filter…`}
                      style={{
                        width: "100%",
                        padding: "5px 8px",
                        border: "1px solid #e5e7eb",
                        borderRadius: 6,
                        fontSize: 11,
                        fontFamily: "inherit",
                        background: "#fff",
                        outline: "none",
                      }}
                    />
                  ) : null}
                </th>
              ))}
            </tr>
          )}
        </thead>
        <tbody>
          {isLoading ? (
            renderSkeletonRows()
          ) : processedSources.length === 0 ? (
            <tr>
              <td
                colSpan={COLUMNS.length}
                style={{ padding: 48, textAlign: "center", color: "#9ca3af", fontSize: 14 }}
              >
                {hasActiveFilters ? "No sources match the current filters." : emptyMessage}
              </td>
            </tr>
          ) : (
            processedSources.map(renderRow)
          )}
        </tbody>
      </table>
      {!isLoading && processedSources.length > 0 && renderPagination()}
    </div>
  );
}
