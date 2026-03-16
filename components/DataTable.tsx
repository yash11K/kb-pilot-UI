"use client";

import { useState } from "react";
import Badge from "@/components/Badge";
import ScorePill from "@/components/ScorePill";
import { STATUS_CONFIG } from "@/lib/types";
import type { KBFileListItem } from "@/lib/types";
import SwipeRow from "@/components/SwipeRow";

interface DataTableProps {
  files: KBFileListItem[];
  onRowClick: (file: KBFileListItem) => void;
  onAccept?: (fileId: string) => void;
  onReject?: (fileId: string) => void;
  swipeable?: boolean;
  isLoading?: boolean;
  emptyMessage?: string;
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  hideStatus?: boolean;
}

const ALL_COLUMNS = ["Title", "Type", "Brand", "Region", "Score", "Status", "Created"];

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

export default function DataTable({
  files,
  onRowClick,
  onAccept,
  onReject,
  swipeable,
  isLoading,
  emptyMessage = "No files match the current filters.",
  page = 1,
  totalPages = 1,
  onPageChange,
  selectable,
  selectedIds,
  onSelectionChange,
  hideStatus,
}: DataTableProps) {
  const COLUMNS = hideStatus
    ? ALL_COLUMNS.filter((c) => c !== "Status")
    : ALL_COLUMNS;
  const colCount = COLUMNS.length + (selectable ? 1 : 0);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  const allSelected =
    selectable && files.length > 0 && files.every((f) => selectedIds?.has(f.id));

  const toggleAll = () => {
    if (!onSelectionChange) return;
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(files.map((f) => f.id)));
    }
  };

  const toggleOne = (id: string) => {
    if (!onSelectionChange || !selectedIds) return;
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const renderSkeletonRows = () =>
    Array.from({ length: 5 }).map((_, i) => (
      <tr key={`skeleton-${i}`} style={{ borderBottom: "1px solid #f3f4f6" }}>
        {selectable && (
          <td style={{ padding: "13px 12px", width: 40 }}>
            <SkeletonBlock width={16} />
          </td>
        )}
        <td style={{ padding: "13px 16px" }}>
          <SkeletonBlock width={140} />
          <div style={{ marginTop: 6 }}>
            <SkeletonBlock width={100} />
          </div>
        </td>
        <td style={{ padding: "13px 16px" }}>
          <SkeletonBlock width={60} />
        </td>
        <td style={{ padding: "13px 16px" }}>
          <SkeletonBlock width={70} />
        </td>
        <td style={{ padding: "13px 16px" }}>
          <SkeletonBlock width={50} />
        </td>
        <td style={{ padding: "13px 16px" }}>
          <SkeletonBlock width={48} />
        </td>
        {!hideStatus && (
          <td style={{ padding: "13px 16px" }}>
            <SkeletonBlock width={80} />
          </td>
        )}
        <td style={{ padding: "13px 16px" }}>
          <SkeletonBlock width={90} />
        </td>
      </tr>
    ));

  const renderRow = (file: KBFileListItem) => {
    if (swipeable && file.status === "pending_review" && onAccept && onReject) {
      return (
        <SwipeRow
          key={file.id}
          file={file}
          onAccept={() => onAccept(file.id)}
          onReject={() => onReject(file.id)}
          onClick={() => onRowClick(file)}
          hideStatus={hideStatus}
        />
      );
    }

    const statusCfg = STATUS_CONFIG[file.status] ?? {
      label: file.status,
      color: "#6b7280",
      bg: "#f3f4f6",
    };

    return (
      <tr
        key={file.id}
        onClick={() => onRowClick(file)}
        onMouseEnter={() => setHoveredRow(file.id)}
        onMouseLeave={() => setHoveredRow(null)}
        style={{
          borderBottom: "1px solid #f3f4f6",
          cursor: "pointer",
          background: hoveredRow === file.id ? "#faf5ff" : "transparent",
          transition: "background 0.15s ease",
        }}
      >
        {selectable && (
          <td
            style={{ padding: "13px 12px", width: 40 }}
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={selectedIds?.has(file.id) ?? false}
              onChange={() => toggleOne(file.id)}
              style={{ width: 16, height: 16, accentColor: "#7c3aed", cursor: "pointer" }}
            />
          </td>
        )}
        <td style={{ padding: "13px 16px" }}>
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 600,
              color: "#111827",
              marginBottom: 2,
            }}
          >
            {file.title}
          </div>
          <div
            style={{
              fontSize: 11,
              color: "#9ca3af",
              fontFamily: "var(--font-dm-mono), 'DM Mono', monospace",
            }}
          >
            {file.filename}
          </div>
        </td>
        <td style={{ padding: "13px 16px" }}>
          <Badge label={file.content_type} color="#7c3aed" bg="#f3f0ff" />
        </td>
        <td style={{ padding: "13px 16px", fontSize: 13, color: "#374151", fontWeight: 500 }}>
          {file.brand}
        </td>
        <td style={{ padding: "13px 16px", fontSize: 13, color: "#374151", fontWeight: 500 }}>
          {file.region}
        </td>
        <td style={{ padding: "13px 16px" }}>
          <ScorePill score={file.validation_score} />
        </td>
        {!hideStatus && (
          <td style={{ padding: "13px 16px" }}>
            <Badge label={statusCfg.label} color={statusCfg.color} bg={statusCfg.bg} />
          </td>
        )}
        <td
          style={{
            padding: "13px 16px",
            fontSize: 12,
            color: "#9ca3af",
            fontFamily: "var(--font-dm-mono), 'DM Mono', monospace",
          }}
        >
          {formatDate(file.created_at)}
        </td>
      </tr>
    );
  };

  const renderPagination = () => {
    if (!totalPages || totalPages <= 1) return null;

    const pages: number[] = [];
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }

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
      className="table-scroll"
      style={{
        background: "#fff",
        borderRadius: 14,
        border: "1px solid #ede9fe",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #f3f0ff" }}>
            {selectable && (
              <th style={{ padding: "12px 12px", width: 40 }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  style={{ width: 16, height: 16, accentColor: "#7c3aed", cursor: "pointer" }}
                />
              </th>
            )}
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
          ) : files.length === 0 ? (
            <tr>
              <td
                colSpan={colCount}
                style={{
                  padding: 48,
                  textAlign: "center",
                  color: "#9ca3af",
                  fontSize: 14,
                }}
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            files.map(renderRow)
          )}
        </tbody>
      </table>
      {!isLoading && files.length > 0 && renderPagination()}
    </div>
  );
}
