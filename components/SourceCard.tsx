"use client";

import { useRef, useEffect } from "react";
import Link from "next/link";
import { ChevronRight, ChevronDown, Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import Badge from "@/components/Badge";
import { useJobStream } from "@/hooks/useJobStream";
import type { SourceListItem, LogEntry, JobStreamStatus } from "@/lib/types";

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface SourceCardProps {
  source: SourceListItem;
  activeJobId: string | null;
  isPreviewOpen: boolean;
  onTogglePreview: () => void;
}

function StatusIndicator({ status }: { status: JobStreamStatus }) {
  if (status === "queued") {
    return <Clock size={14} style={{ color: "#9ca3af" }} />;
  }
  if (status === "streaming" || status === "connecting") {
    return <Loader2 size={14} style={{ color: "#7c3aed", animation: "spin 1s linear infinite" }} />;
  }
  if (status === "completed") {
    return <CheckCircle2 size={14} style={{ color: "#16a34a" }} />;
  }
  if (status === "error") {
    return <XCircle size={14} style={{ color: "#dc2626" }} />;
  }
  return null;
}

function statusLabel(status: JobStreamStatus): string {
  switch (status) {
    case "queued": return "Queued";
    case "connecting": return "Connecting...";
    case "streaming": return "Processing...";
    case "completed": return "Completed";
    case "error": return "Failed";
    default: return "";
  }
}

function statusColor(status: JobStreamStatus): string {
  switch (status) {
    case "queued": return "#9ca3af";
    case "connecting":
    case "streaming": return "#7c3aed";
    case "completed": return "#16a34a";
    case "error": return "#dc2626";
    default: return "#6b7280";
  }
}

/** Compact inline preview panel shown below the card when expanded. */
function InlinePreview({ jobId, sourceId }: { jobId: string; sourceId: string }) {
  const stream = useJobStream(jobId);
  const logEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (logEndRef.current && containerRef.current) {
      const el = containerRef.current;
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
      if (isNearBottom) {
        logEndRef.current.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [stream.logs.length]);

  const lastLogs = stream.logs.slice(-15);

  return (
    <div style={{ borderTop: "1px solid #ede9fe", padding: "14px 20px", background: "#faf5ff" }}>
      {/* Status + progress */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <StatusIndicator status={stream.status} />
        <span style={{ fontSize: 12, fontWeight: 600, color: statusColor(stream.status) }}>
          {statusLabel(stream.status)}
        </span>
        {stream.currentStage && stream.status === "streaming" && (
          <span style={{ fontSize: 11, color: "#6b7280", marginLeft: 4 }}>
            — {stream.currentStage}
          </span>
        )}
        {stream.progress && (
          <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: "auto" }}>
            {stream.progress.current}/{stream.progress.total}
          </span>
        )}
      </div>

      {/* Progress bar */}
      {stream.progress && stream.status === "streaming" && (
        <div style={{ height: 4, background: "#e5e7eb", borderRadius: 2, marginBottom: 10, overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${Math.min(100, (stream.progress.current / stream.progress.total) * 100)}%`,
              background: "linear-gradient(90deg, #7c3aed, #a78bfa)",
              borderRadius: 2,
              transition: "width 0.3s ease",
            }}
          />
        </div>
      )}

      {/* Log lines */}
      <div
        ref={containerRef}
        style={{
          maxHeight: 200,
          overflowY: "auto",
          fontFamily: "'DM Mono', monospace",
          fontSize: 11,
          lineHeight: 1.6,
          color: "#374151",
        }}
      >
        {lastLogs.map((log: LogEntry) => (
          <div key={log.id} style={{ padding: "2px 0", borderBottom: "1px solid #f3f0ff" }}>
            <span style={{ color: "#9ca3af", marginRight: 8 }}>
              {log.timestamp.toLocaleTimeString("en-US", { hour12: false })}
            </span>
            {log.agent && (
              <span style={{
                fontSize: 9,
                fontWeight: 700,
                color: log.agent === "extractor" ? "#0891b2" : "#d97706",
                background: log.agent === "extractor" ? "#ecfeff" : "#fffbeb",
                borderRadius: 4,
                padding: "1px 5px",
                marginRight: 6,
                textTransform: "uppercase",
              }}>
                {log.agent}
              </span>
            )}
            <span>{log.message}</span>
          </div>
        ))}
        <div ref={logEndRef} />
      </div>

      {/* Summary card */}
      {stream.summary && (
        <div style={{
          marginTop: 10,
          padding: "10px 14px",
          background: "#f0fdf4",
          borderRadius: 10,
          border: "1px solid #bbf7d0",
          fontSize: 12,
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
        }}>
          <span><strong>{stream.summary.files_created}</strong> files</span>
          <span style={{ color: "#16a34a" }}><strong>{stream.summary.files_auto_approved}</strong> approved</span>
          <span style={{ color: "#7c3aed" }}><strong>{stream.summary.files_pending_review}</strong> pending</span>
          <span style={{ color: "#dc2626" }}><strong>{stream.summary.files_auto_rejected}</strong> rejected</span>
          <span style={{ color: "#6b7280" }}><strong>{stream.summary.duplicates_skipped}</strong> duplicates</span>
        </div>
      )}

      {/* Error card */}
      {stream.error && (
        <div style={{
          marginTop: 10,
          padding: "10px 14px",
          background: "#fef2f2",
          borderRadius: 10,
          border: "1px solid #fecaca",
          fontSize: 12,
          color: "#dc2626",
        }}>
          {stream.error.message}
        </div>
      )}

      {/* Link to full detail */}
      <div style={{ marginTop: 10, textAlign: "right" }}>
        <Link
          href={`/sources/${sourceId}`}
          style={{ fontSize: 11, color: "#7c3aed", textDecoration: "none", fontWeight: 600 }}
          onClick={(e) => e.stopPropagation()}
        >
          View full details →
        </Link>
      </div>
    </div>
  );
}

export default function SourceCard({ source, activeJobId, isPreviewOpen, onTogglePreview }: SourceCardProps) {
  const isActive = !!activeJobId;

  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          background: "#fff",
          borderRadius: isPreviewOpen ? "14px 14px 0 0" : 14,
          border: `1px solid ${isActive ? "#c4b5fd" : "#ede9fe"}`,
          borderBottom: isPreviewOpen ? "none" : undefined,
          padding: "20px 24px",
          transition: "background 0.15s, border-color 0.15s",
          cursor: "pointer",
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#faf5ff")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
      >
        {/* Main content — click navigates */}
        <Link
          href={`/sources/${source.id}`}
          style={{ flex: 1, textDecoration: "none", display: "block", minWidth: 0 }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              {source.nav_label && (
                <div style={{ fontSize: 14, fontWeight: 600, color: "#111827", marginBottom: 4 }}>
                  {source.nav_label}
                </div>
              )}
              <div
                style={{
                  fontSize: 12,
                  color: "#9ca3af",
                  fontFamily: "'DM Mono', monospace",
                  marginBottom: 6,
                  wordBreak: "break-all",
                }}
              >
                {source.url}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <Badge label={source.brand} color="#7c3aed" bg="#f3f0ff" />
                <Badge label={source.region} color="#0891b2" bg="#ecfeff" />
                {source.nav_section && (
                  <Badge label={source.nav_section} color="#6b7280" bg="#f3f4f6" />
                )}
              </div>
            </div>

            {/* Status area */}
            <div style={{ textAlign: "right", whiteSpace: "nowrap", marginLeft: 16 }}>
              {isActive ? (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#7c3aed",
                    animation: "pulse 1.5s ease-in-out infinite",
                  }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#7c3aed" }}>Processing...</span>
                </div>
              ) : (
                <span style={{ fontSize: 12, color: "#9ca3af" }}>
                  {source.last_ingested_at ? `Last ingested ${fmtDate(source.last_ingested_at)}` : "Never ingested"}
                </span>
              )}
              {isActive && activeJobId && (
                <div style={{ fontSize: 10, color: "#9ca3af", fontFamily: "'DM Mono', monospace", marginTop: 2 }}>
                  {activeJobId.slice(0, 8)}
                </div>
              )}
            </div>
          </div>
        </Link>

        {/* Chevron toggle — separate click target */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onTogglePreview();
          }}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 4,
            borderRadius: 6,
            color: "#9ca3af",
            display: "flex",
            alignItems: "center",
            marginTop: 2,
            transition: "color 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#7c3aed")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#9ca3af")}
          title={isPreviewOpen ? "Collapse preview" : "Expand preview"}
        >
          {isPreviewOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </button>
      </div>

      {/* Expandable preview panel */}
      {isPreviewOpen && activeJobId && (
        <div style={{
          background: "#fff",
          borderRadius: "0 0 14px 14px",
          border: "1px solid #c4b5fd",
          borderTop: "none",
          overflow: "hidden",
        }}>
          <InlinePreview jobId={activeJobId} sourceId={source.id} />
        </div>
      )}

      {/* Expand with no active job — show last ingested info */}
      {isPreviewOpen && !activeJobId && (
        <div style={{
          background: "#fff",
          borderRadius: "0 0 14px 14px",
          border: "1px solid #ede9fe",
          borderTop: "none",
          padding: "16px 20px",
        }}>
          <div style={{ fontSize: 12, color: "#6b7280", textAlign: "center" }}>
            No active ingestion job.{" "}
            <Link
              href={`/sources/${source.id}`}
              style={{ color: "#7c3aed", textDecoration: "none", fontWeight: 600 }}
            >
              View full history →
            </Link>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
