"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  X,
  ArrowDown,
  Trash2,
  Download,
  Filter,
  CheckCircle2,
  XCircle,
  Loader2,
  Wrench,
} from "lucide-react";
import {
  SSE_EVENT_COLORS,
  AGENT_COLORS,
} from "@/lib/types";
import type {
  LogEntry,
  SSEEventType,
  SSECompleteEvent,
  SSEErrorEvent,
  JobStreamStatus,
} from "@/lib/types";
import type { ActiveToolCall } from "@/hooks/useJobStream";

// ── Helpers ──────────────────────────────────────────────────

function fmtTime(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${h}:${m}:${s}.${ms}`;
}

function fmtElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return min > 0 ? `${min}m ${sec}s` : `${sec}s`;
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  progress: "Progress",
  tool_call: "Tool Calls",
  agent_log: "Agent Logs",
  complete: "Complete",
  error: "Error",
  crawl_page_start: "Crawl Start",
  crawl_page_complete: "Crawl Done",
  crawl_page_skipped: "Crawl Skipped",
  crawl_page_error: "Crawl Error",
  crawl_summary: "Crawl Summary",
};

const TOOL_LABELS: Record<string, string> = {
  html_to_markdown: "Converting HTML → Markdown",
  generate_md_file: "Generating markdown file",
  parse_frontmatter: "Parsing frontmatter",
  check_duplicate: "Checking for duplicates",
};

// ── Props ────────────────────────────────────────────────────

interface LogViewerProps {
  jobId: string;
  sourceUrl?: string;
  status: JobStreamStatus;
  currentStage: string | null;
  progress: { current: number; total: number } | null;
  logs: LogEntry[];
  summary: SSECompleteEvent | null;
  error: SSEErrorEvent | null;
  startedAt: number | null;
  activeToolCall: ActiveToolCall | null;
  onClearLogs: () => void;
  onClose: () => void;
}

export default function LogViewer({
  jobId,
  sourceUrl,
  status,
  currentStage,
  progress,
  logs,
  summary,
  error,
  startedAt,
  activeToolCall,
  onClearLogs,
  onClose,
}: LogViewerProps) {
  // ── Filters ──────────────────────────────────────────────
  const [activeTypes, setActiveTypes] = useState<Set<SSEEventType>>(
    () => new Set<SSEEventType>(["progress", "tool_call", "agent_log", "complete", "error", "crawl_page_start", "crawl_page_complete", "crawl_page_skipped", "crawl_page_error", "crawl_summary"]),
  );
  const [activeAgents, setActiveAgents] = useState<Set<string>>(
    new Set(["extractor", "validator"]),
  );
  const [showChunks, setShowChunks] = useState(false);

  const toggleType = (t: SSEEventType) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      next.has(t) ? next.delete(t) : next.add(t);
      return next;
    });
  };

  const toggleAgent = (a: string) => {
    setActiveAgents((prev) => {
      const next = new Set(prev);
      next.has(a) ? next.delete(a) : next.add(a);
      return next;
    });
  };

  // ── Filtered logs ────────────────────────────────────────
  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (!activeTypes.has(l.eventType)) return false;
      if (l.agent && !activeAgents.has(l.agent)) return false;
      // Hide chunk entries unless toggled on
      if (
        l.eventType === "agent_log" &&
        !showChunks &&
        "chunk" in l.raw &&
        (l.raw as { chunk?: string }).chunk
      )
        return false;
      return true;
    });
  }, [logs, activeTypes, activeAgents, showChunks]);

  // ── Auto-scroll ──────────────────────────────────────────
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filtered, autoScroll]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 40;
    setAutoScroll(atBottom);
  }, []);

  const jumpToBottom = () => {
    setAutoScroll(true);
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  // ── Elapsed timer ────────────────────────────────────────
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startedAt || status === "completed" || status === "error") return;
    const iv = setInterval(() => setElapsed(Date.now() - startedAt), 1000);
    return () => clearInterval(iv);
  }, [startedAt, status]);

  useEffect(() => {
    if (startedAt && (status === "completed" || status === "error")) {
      setElapsed(Date.now() - startedAt);
    }
  }, [status, startedAt]);

  // ── Download ─────────────────────────────────────────────
  const downloadLogs = () => {
    const blob = new Blob(
      [JSON.stringify(logs.map((l) => l.raw), null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `job-${jobId}-logs.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Progress percentage ──────────────────────────────────
  const pct =
    progress && progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : null;

  const isTerminal = status === "completed" || status === "error";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.35)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "92vw",
          maxWidth: 960,
          height: "90vh",
          background: "#fff",
          borderRadius: 20,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 25px 60px rgba(0,0,0,0.15)",
          animation: "logModalIn 0.25s ease",
          position: "relative",
        }}
      >
        {/* ── Header ──────────────────────────────────────── */}
        <div
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid #ede9fe",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          {status === "completed" && <CheckCircle2 size={20} color="#16a34a" />}
          {status === "error" && <XCircle size={20} color="#dc2626" />}
          {(status === "streaming" || status === "connecting") && (
            <Loader2 size={20} color="#7c3aed" style={{ animation: "logSpin 1s linear infinite" }} />
          )}

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>
              Live Ingestion Logs
            </div>
            {sourceUrl && (
              <div
                style={{
                  fontSize: 11,
                  color: "#9ca3af",
                  fontFamily: "'DM Mono', monospace",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {sourceUrl}
              </div>
            )}
          </div>

          {startedAt != null && (
            <div style={{ fontSize: 12, color: "#6b7280", fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap" }}>
              {fmtElapsed(elapsed)}
            </div>
          )}

          <button
            onClick={onClose}
            aria-label="Close log viewer"
            style={{ background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, display: "flex" }}
          >
            <X size={18} color="#9ca3af" />
          </button>
        </div>

        {/* ── Active tool call indicator ──────────────────── */}
        {activeToolCall && (
          <div
            style={{
              padding: "8px 24px",
              borderBottom: "1px solid #f3f0ff",
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: AGENT_COLORS[activeToolCall.agent]?.bg || "#f3f0ff",
              animation: "logToolPulse 1.5s ease-in-out infinite",
            }}
          >
            <Wrench
              size={14}
              color={AGENT_COLORS[activeToolCall.agent]?.color || "#7c3aed"}
              style={{ animation: "logSpin 2s linear infinite" }}
            />
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: AGENT_COLORS[activeToolCall.agent]?.color || "#7c3aed",
                textTransform: "capitalize",
              }}
            >
              {activeToolCall.agent}
            </span>
            <span style={{ fontSize: 12, color: "#4b5563" }}>
              {TOOL_LABELS[activeToolCall.tool] || `Calling ${activeToolCall.tool}`}
            </span>
            <div style={{ marginLeft: "auto", display: "flex", gap: 3 }}>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    background: AGENT_COLORS[activeToolCall.agent]?.color || "#7c3aed",
                    animation: `logDotBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Progress bar ────────────────────────────────── */}
        {(currentStage || progress) && (
          <div style={{ padding: "10px 24px 6px", borderBottom: "1px solid #f3f0ff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#4b5563" }}>
                {stageLabel(currentStage)}
              </span>
              {pct != null && (
                <span style={{ fontSize: 11, color: "#9ca3af", fontFamily: "'DM Mono', monospace" }}>
                  {progress!.current}/{progress!.total} ({pct}%)
                </span>
              )}
            </div>
            <div style={{ height: 4, background: "#ede9fe", borderRadius: 2, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: isTerminal ? "100%" : pct != null ? `${pct}%` : "30%",
                  background: status === "error" ? "#dc2626" : "linear-gradient(90deg, #7c3aed, #a78bfa)",
                  borderRadius: 2,
                  transition: "width 0.4s ease",
                  ...(pct == null && !isTerminal ? { animation: "logIndeterminate 1.5s ease-in-out infinite" } : {}),
                }}
              />
            </div>
          </div>
        )}

        {/* ── Filter bar ──────────────────────────────────── */}
        <div
          style={{
            padding: "8px 24px",
            borderBottom: "1px solid #f3f0ff",
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
          }}
        >
          <Filter size={13} color="#9ca3af" />
          {(["progress", "tool_call", "agent_log"] as SSEEventType[]).map((t) => {
            const active = activeTypes.has(t);
            const c = SSE_EVENT_COLORS[t];
            return (
              <button
                key={t}
                onClick={() => toggleType(t)}
                style={{
                  padding: "3px 10px",
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: 600,
                  border: "1px solid",
                  borderColor: active ? c.color : "#e5e7eb",
                  background: active ? c.bg : "#fff",
                  color: active ? c.color : "#9ca3af",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {EVENT_TYPE_LABELS[t]}
              </button>
            );
          })}

          <div style={{ width: 1, height: 16, background: "#e5e7eb", margin: "0 4px" }} />

          {["extractor", "validator"].map((a) => {
            const active = activeAgents.has(a);
            const c = AGENT_COLORS[a];
            return (
              <button
                key={a}
                onClick={() => toggleAgent(a)}
                style={{
                  padding: "3px 10px",
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: 600,
                  border: "1px solid",
                  borderColor: active ? c.color : "#e5e7eb",
                  background: active ? c.bg : "#fff",
                  color: active ? c.color : "#9ca3af",
                  cursor: "pointer",
                  textTransform: "capitalize",
                  transition: "all 0.15s",
                }}
              >
                {a}
              </button>
            );
          })}

          <div style={{ width: 1, height: 16, background: "#e5e7eb", margin: "0 4px" }} />

          <label style={{ fontSize: 11, color: "#6b7280", display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={showChunks}
              onChange={(e) => setShowChunks(e.target.checked)}
              style={{ accentColor: "#7c3aed" }}
            />
            LLM output
          </label>

          <div style={{ flex: 1 }} />

          <button onClick={onClearLogs} title="Clear log view" style={{ background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, display: "flex" }}>
            <Trash2 size={14} color="#9ca3af" />
          </button>
          <button onClick={downloadLogs} title="Download logs as JSON" style={{ background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, display: "flex" }}>
            <Download size={14} color="#9ca3af" />
          </button>
        </div>

        {/* ── Log stream ──────────────────────────────────── */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          style={{
            flex: 1,
            overflow: "auto",
            padding: "8px 24px",
            fontFamily: "'DM Mono', monospace",
            fontSize: 12,
            lineHeight: 1.7,
            background: "#fafafa",
          }}
        >
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: 32, color: "#9ca3af", fontSize: 13 }}>
              {logs.length === 0
                ? status === "connecting"
                  ? "Connecting to stream…"
                  : "Waiting for events…"
                : "No events match current filters."}
            </div>
          )}
          {filtered.map((entry) => (
            <LogLine key={entry.id} entry={entry} />
          ))}
        </div>

        {/* Jump to bottom */}
        {!autoScroll && (
          <button
            onClick={jumpToBottom}
            style={{
              position: "absolute",
              bottom: summary || error ? 180 : 24,
              right: 40,
              padding: "6px 14px",
              background: "#7c3aed",
              color: "#fff",
              border: "none",
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
              boxShadow: "0 4px 12px rgba(124,58,237,0.3)",
              zIndex: 10,
            }}
          >
            <ArrowDown size={12} /> Jump to bottom
          </button>
        )}

        {/* ── Summary / Error card ────────────────────────── */}
        {summary && <SummaryCard summary={summary} />}
        {error && !summary && <ErrorCard error={error} />}

        {/* ── Animations ──────────────────────────────────── */}
        <style>{`
          @keyframes logModalIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes logSpin { to { transform: rotate(360deg); } }
          @keyframes logIndeterminate { 0% { transform: translateX(-100%); } 100% { transform: translateX(400%); } }
          @keyframes logToolPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
          @keyframes logDotBounce { 0%, 80%, 100% { transform: translateY(0); opacity: 0.4; } 40% { transform: translateY(-4px); opacity: 1; } }
        `}</style>
      </div>
    </div>
  );
}

// ── Log line ─────────────────────────────────────────────────

function LogLine({ entry }: { entry: LogEntry }) {
  const ec = SSE_EVENT_COLORS[entry.eventType];
  const ac = entry.agent ? AGENT_COLORS[entry.agent] : null;
  const isChunk = entry.eventType === "agent_log" && "chunk" in entry.raw && (entry.raw as { chunk?: string }).chunk;

  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: "flex-start",
        padding: "2px 0",
      }}
    >
      <span style={{ color: "#9ca3af", flexShrink: 0 }}>
        {fmtTime(entry.timestamp)}
      </span>
      <span
        style={{
          padding: "1px 7px",
          borderRadius: 10,
          fontSize: 10,
          fontWeight: 600,
          color: ec.color,
          background: ec.bg,
          flexShrink: 0,
          minWidth: 64,
          textAlign: "center",
        }}
      >
        {entry.eventType}
      </span>
      {ac && (
        <span
          style={{
            padding: "1px 7px",
            borderRadius: 10,
            fontSize: 10,
            fontWeight: 600,
            color: ac.color,
            background: ac.bg,
            flexShrink: 0,
          }}
        >
          {entry.agent}
        </span>
      )}
      {isChunk ? (
        <span
          style={{
            color: "#6b7280",
            wordBreak: "break-word",
            fontStyle: "italic",
            background: "#f3f4f6",
            padding: "1px 6px",
            borderRadius: 4,
            maxWidth: "100%",
            whiteSpace: "pre-wrap",
          }}
        >
          {entry.message}
        </span>
      ) : (
        <span style={{ color: "#374151", wordBreak: "break-word" }}>
          {entry.message}
        </span>
      )}
    </div>
  );
}

// ── Summary card ─────────────────────────────────────────────

function SummaryCard({ summary }: { summary: SSECompleteEvent }) {
  const metrics = [
    { label: "Files Created", value: summary.files_created },
    { label: "Auto-Approved", value: summary.files_auto_approved },
    { label: "Pending Review", value: summary.files_pending_review },
    { label: "Auto-Rejected", value: summary.files_auto_rejected },
    { label: "Duplicates Skipped", value: summary.duplicates_skipped },
  ];

  return (
    <div
      style={{
        margin: "0 24px 16px",
        padding: 16,
        background: "#f0fdf4",
        border: "1px solid #bbf7d0",
        borderRadius: 12,
        display: "flex",
        alignItems: "center",
        gap: 20,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <CheckCircle2 size={18} color="#16a34a" />
        <span style={{ fontSize: 13, fontWeight: 700, color: "#16a34a" }}>Pipeline Complete</span>
      </div>
      {metrics.map((m) => (
        <div key={m.label} style={{ textAlign: "center" }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {m.label}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>{m.value}</div>
        </div>
      ))}
    </div>
  );
}

// ── Error card ───────────────────────────────────────────────

function ErrorCard({ error }: { error: SSEErrorEvent }) {
  return (
    <div
      style={{
        margin: "0 24px 16px",
        padding: 16,
        background: "#fef2f2",
        border: "1px solid #fecaca",
        borderRadius: 12,
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <XCircle size={18} color="#dc2626" />
      <span style={{ fontSize: 13, fontWeight: 600, color: "#dc2626" }}>{error.message}</span>
    </div>
  );
}

// ── Stage label helper ───────────────────────────────────────

function stageLabel(stage: string | null): string {
  if (!stage) return "Initializing…";
  const map: Record<string, string> = {
    started: "Pipeline started",
    extraction: "Extracting content…",
    extraction_complete: "Extraction complete",
    processing: "Processing files…",
    duplicate_skipped: "Duplicate skipped",
    validation: "Validating…",
    validated: "File validated",
    validation_error: "Validation error",
    s3_upload: "Uploading to S3…",
  };
  return map[stage] || stage;
}
