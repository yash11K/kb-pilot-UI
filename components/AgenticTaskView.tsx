"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  X,
  ArrowDown,
  Download,
  CheckCircle2,
  XCircle,
  Loader2,
  Wrench,
  ChevronDown,
  ChevronRight,
  Sparkles,
  SkipForward,
} from "lucide-react";
import {
  AGENT_COLORS,
  AGENT_IDENTITY,
  SYSTEM_STEP_IDENTITY,
} from "@/lib/types";
import type {
  URLTask,
  AgentStep,
  SSECompleteEvent,
  SSEErrorEvent,
  JobStreamStatus,
} from "@/lib/types";
import type { ActiveToolCall } from "@/hooks/useJobStream";

// ── Helpers ──────────────────────────────────────────────────

function fmtElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return min > 0 ? `${min}m ${sec}s` : `${sec}s`;
}

function truncateUrl(url: string, maxLen = 60): string {
  try {
    const u = new URL(url);
    const path = u.pathname;
    if (path.length <= maxLen) return path;
    return "..." + path.slice(-maxLen);
  } catch {
    return url.length > maxLen ? "..." + url.slice(-maxLen) : url;
  }
}

function scoreColor(score: number): string {
  if (score >= 21) return "#16a34a";
  if (score >= 6) return "#d97706";
  return "#dc2626";
}

function scoreBg(score: number): string {
  if (score >= 21) return "#f0fdf4";
  if (score >= 6) return "#fffbeb";
  return "#fef2f2";
}

const STATUS_CHIP: Record<string, { color: string; bg: string; label: string }> = {
  approved: { color: "#16a34a", bg: "#f0fdf4", label: "Approved" },
  pending_review: { color: "#7c3aed", bg: "#f3f0ff", label: "Pending Review" },
  auto_rejected: { color: "#dc2626", bg: "#fef2f2", label: "Rejected" },
};

// ── Props ────────────────────────────────────────────────────

interface AgenticTaskViewProps {
  jobId: string;
  sourceUrl?: string;
  status: JobStreamStatus;
  currentStage: string | null;
  progress: { current: number; total: number } | null;
  urlTasks: URLTask[];
  logs: { raw: unknown }[];
  summary: SSECompleteEvent | null;
  error: SSEErrorEvent | null;
  startedAt: number | null;
  activeToolCall: ActiveToolCall | null;
  onClose: () => void;
}

export default function AgenticTaskView({
  jobId,
  sourceUrl,
  status,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  currentStage,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  progress,
  urlTasks,
  logs,
  summary,
  error,
  startedAt,
  activeToolCall,
  onClose,
}: AgenticTaskViewProps) {
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

  // ── Auto-scroll ──────────────────────────────────────────
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [urlTasks, autoScroll]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 40);
  }, []);

  const jumpToBottom = () => {
    setAutoScroll(true);
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  };

  // ── Collapse state ───────────────────────────────────────
  const [manuallyToggled, setManuallyToggled] = useState<Set<string>>(new Set());
  const [expandedUrls, setExpandedUrls] = useState<Set<string>>(new Set());

  const toggleCard = (url: string) => {
    setManuallyToggled((prev) => {
      const next = new Set(prev);
      next.add(url);
      return next;
    });
    setExpandedUrls((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const isExpanded = (task: URLTask): boolean => {
    if (manuallyToggled.has(task.url)) return expandedUrls.has(task.url);
    return task.status === "crawling";
  };

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

  // ── Progress ─────────────────────────────────────────────
  const completedTasks = urlTasks.filter((t) => t.status === "completed").length;
  const totalTasks = urlTasks.length;
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
          animation: "atv-modalIn 0.25s ease",
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
          {(status === "streaming" || status === "connecting" || status === "queued") && (
            <div style={{ position: "relative", width: 20, height: 20 }}>
              <Sparkles size={20} color="#7c3aed" style={{ animation: "atv-sparkle 2s ease-in-out infinite" }} />
            </div>
          )}

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>
              AI Ingestion Agent
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

          {totalTasks > 0 && (
            <div
              style={{
                fontSize: 11,
                color: "#7c3aed",
                fontWeight: 600,
                background: "#f3f0ff",
                padding: "3px 10px",
                borderRadius: 20,
                whiteSpace: "nowrap",
              }}
            >
              {completedTasks}/{totalTasks} pages
            </div>
          )}

          {startedAt != null && (
            <div style={{ fontSize: 12, color: "#6b7280", fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap" }}>
              {fmtElapsed(elapsed)}
            </div>
          )}

          <button
            onClick={downloadLogs}
            title="Download logs as JSON"
            style={{ background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, display: "flex" }}
          >
            <Download size={16} color="#9ca3af" />
          </button>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, display: "flex" }}
          >
            <X size={18} color="#9ca3af" />
          </button>
        </div>

        {/* ── Global progress bar ─────────────────────────── */}
        {totalTasks > 0 && (
          <div style={{ padding: "0 24px", paddingTop: 8, paddingBottom: 4 }}>
            <div style={{ height: 3, background: "#ede9fe", borderRadius: 2, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: isTerminal
                    ? "100%"
                    : totalTasks > 0
                      ? `${Math.round((completedTasks / totalTasks) * 100)}%`
                      : "0%",
                  background: status === "error"
                    ? "#dc2626"
                    : "linear-gradient(90deg, #7c3aed, #a78bfa)",
                  borderRadius: 2,
                  transition: "width 0.4s ease",
                }}
              />
            </div>
          </div>
        )}

        {/* ── Task list ───────────────────────────────────── */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          style={{
            flex: 1,
            overflow: "auto",
            padding: "12px 24px",
            background: "#fafafa",
          }}
        >
          {urlTasks.length === 0 && (
            <div style={{ textAlign: "center", padding: 48, color: "#9ca3af", fontSize: 13 }}>
              {status === "connecting"
                ? "Connecting to agent stream..."
                : status === "queued"
                  ? "Waiting for available slot..."
                  : "Waiting for agent to start..."}
            </div>
          )}

          {urlTasks.map((task) => (
            <URLTaskCard
              key={task.url}
              task={task}
              expanded={isExpanded(task)}
              onToggle={() => toggleCard(task.url)}
              activeToolCall={activeToolCall}
            />
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
          @keyframes atv-modalIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes atv-sparkle { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.15); opacity: 0.7; } }
          @keyframes atv-pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.8); opacity: 0; } }
          @keyframes atv-spin { to { transform: rotate(360deg); } }
          @keyframes atv-toolPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
          @keyframes atv-blink { 50% { opacity: 0; } }
          @keyframes atv-slideIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        `}</style>
      </div>
    </div>
  );
}

// ── URL Task Card ────────────────────────────────────────────

function URLTaskCard({
  task,
  expanded,
  onToggle,
  activeToolCall,
}: {
  task: URLTask;
  expanded: boolean;
  onToggle: () => void;
  activeToolCall: ActiveToolCall | null;
}) {
  const statusIcon = () => {
    switch (task.status) {
      case "crawling":
        return <Loader2 size={14} color="#7c3aed" style={{ animation: "atv-spin 1s linear infinite" }} />;
      case "completed":
        return <CheckCircle2 size={14} color="#16a34a" />;
      case "skipped":
        return <SkipForward size={14} color="#9ca3af" />;
      case "error":
        return <XCircle size={14} color="#dc2626" />;
    }
  };

  const fileCount = task.steps.reduce((sum, s) => sum + s.fileResults.length, 0);

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 12,
        border: task.status === "crawling" ? "1px solid #c4b5fd" : "1px solid #e5e7eb",
        marginBottom: 8,
        overflow: "hidden",
        animation: "atv-slideIn 0.2s ease",
        boxShadow: task.status === "crawling" ? "0 0 0 1px rgba(124,58,237,0.08)" : "none",
      }}
    >
      {/* Card header */}
      <button
        onClick={onToggle}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 16px",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        {expanded ? <ChevronDown size={14} color="#9ca3af" /> : <ChevronRight size={14} color="#9ca3af" />}
        {statusIcon()}
        <span
          style={{
            flex: 1,
            fontSize: 12,
            fontFamily: "'DM Mono', monospace",
            color: task.status === "skipped" ? "#9ca3af" : "#374151",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {truncateUrl(task.url)}
        </span>

        {task.depth > 0 && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: "#6b7280",
              background: "#f3f4f6",
              padding: "2px 7px",
              borderRadius: 10,
            }}
          >
            depth {task.depth}
          </span>
        )}

        {fileCount > 0 && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: "#7c3aed",
              background: "#f3f0ff",
              padding: "2px 7px",
              borderRadius: 10,
            }}
          >
            {fileCount} file{fileCount !== 1 ? "s" : ""}
          </span>
        )}

        {task.status === "skipped" && task.skipReason && (
          <span style={{ fontSize: 10, color: "#9ca3af", fontStyle: "italic" }}>
            {task.skipReason}
          </span>
        )}
      </button>

      {/* Expanded content */}
      {expanded && task.steps.length > 0 && (
        <div style={{ padding: "0 16px 12px 16px" }}>
          <div style={{ borderLeft: "2px solid #ede9fe", marginLeft: 7, paddingLeft: 18 }}>
            {task.steps.map((step) => (
              <AgentStepRow
                key={step.id}
                step={step}
                activeToolCall={activeToolCall}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Agent Step Row ───────────────────────────────────────────

function AgentStepRow({
  step,
  activeToolCall,
}: {
  step: AgentStep;
  activeToolCall: ActiveToolCall | null;
}) {
  const identity = step.agent ? AGENT_IDENTITY[step.agent] : SYSTEM_STEP_IDENTITY;
  const agentColor = step.agent ? AGENT_COLORS[step.agent] : { color: "#6b7280", bg: "#f3f4f6" };
  const isActive = step.status === "active";

  return (
    <div style={{ position: "relative", paddingBottom: 12 }}>
      {/* Timeline dot */}
      <div
        style={{
          position: "absolute",
          left: -25,
          top: 6,
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: isActive ? agentColor.color : step.status === "completed" ? "#16a34a" : "#dc2626",
          border: "2px solid #fff",
          boxShadow: isActive ? `0 0 0 3px ${agentColor.bg}` : "none",
        }}
      >
        {isActive && (
          <div
            style={{
              position: "absolute",
              inset: -3,
              borderRadius: "50%",
              border: `2px solid ${agentColor.color}`,
              animation: "atv-pulse 1.5s ease-out infinite",
            }}
          />
        )}
      </div>

      {/* Agent identity + stage label */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <div
          style={{
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: agentColor.bg,
            color: agentColor.color,
            fontSize: 10,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {identity?.icon || "?"}
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: agentColor.color }}>
          {identity?.name || "Agent"}
        </span>
        <span style={{ fontSize: 11, color: "#6b7280" }}>
          {step.label}
        </span>
        {isActive && (
          <Loader2
            size={12}
            color={agentColor.color}
            style={{ animation: "atv-spin 1s linear infinite", marginLeft: 2 }}
          />
        )}
      </div>

      {/* Tool calls */}
      {step.toolCalls.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6, paddingLeft: 28 }}>
          {step.toolCalls.map((tc) => {
            const isToolActive = isActive && activeToolCall?.tool === tc.tool && activeToolCall?.agent === tc.agent;
            return (
              <ToolCallChip key={tc.id} tool={tc.tool} label={tc.label} active={isToolActive} agent={tc.agent} />
            );
          })}
        </div>
      )}

      {/* Thinking stream */}
      {step.thinkingText && (
        <ThinkingStream text={step.thinkingText} active={isActive} />
      )}

      {/* File results */}
      {step.fileResults.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6, paddingLeft: 28 }}>
          {step.fileResults.map((f, i) => (
            <FileResultCard key={`${f.filename}-${i}`} file={f} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tool Call Chip ───────────────────────────────────────────

function ToolCallChip({
  tool,
  label,
  active,
  agent,
}: {
  tool: string;
  label: string;
  active: boolean;
  agent: string;
}) {
  const color = AGENT_COLORS[agent]?.color || "#7c3aed";
  const bg = AGENT_COLORS[agent]?.bg || "#f3f0ff";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 8px",
        borderRadius: 6,
        fontSize: 10,
        fontWeight: 500,
        fontFamily: "'DM Mono', monospace",
        color,
        background: bg,
        border: `1px solid ${color}20`,
        animation: active ? "atv-toolPulse 1.2s ease-in-out infinite" : "none",
      }}
      title={label}
    >
      <Wrench size={10} />
      {tool}
    </span>
  );
}

// ── Thinking Stream ─────────────────────────────────────────

function ThinkingStream({ text, active }: { text: string; active: boolean }) {
  // Show last ~300 chars when active to keep it focused
  const displayText = active && text.length > 300 ? "..." + text.slice(-300) : text;

  return (
    <div
      style={{
        marginTop: 4,
        marginLeft: 28,
        padding: "6px 10px",
        background: "#f9fafb",
        borderRadius: 6,
        borderLeft: "2px solid #e5e7eb",
        fontSize: 11,
        fontFamily: "'DM Mono', monospace",
        color: "#6b7280",
        fontStyle: "italic",
        lineHeight: 1.6,
        maxHeight: active ? 120 : 60,
        overflow: "hidden",
        position: "relative",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        transition: "max-height 0.3s ease",
      }}
    >
      {displayText}
      {active && (
        <span
          style={{
            display: "inline-block",
            width: 2,
            height: 13,
            background: "#7c3aed",
            marginLeft: 1,
            verticalAlign: "text-bottom",
            animation: "atv-blink 0.8s step-end infinite",
          }}
        />
      )}
      {/* Fade-out mask at top when overflowing */}
      {active && text.length > 200 && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 24,
            background: "linear-gradient(to bottom, #f9fafb, transparent)",
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}

// ── File Result Card ────────────────────────────────────────

function FileResultCard({ file }: { file: { filename: string; status: string; score?: number } }) {
  const statusConf = STATUS_CHIP[file.status] || { color: "#6b7280", bg: "#f3f4f6", label: file.status };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "5px 10px",
        background: "#fff",
        borderRadius: 8,
        border: "1px solid #e5e7eb",
        fontSize: 11,
        animation: "atv-slideIn 0.2s ease",
      }}
    >
      <span
        style={{
          fontFamily: "'DM Mono', monospace",
          color: "#374151",
          fontWeight: 500,
          flex: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {file.filename}
      </span>

      {file.score != null && (
        <span
          style={{
            padding: "1px 6px",
            borderRadius: 10,
            fontSize: 10,
            fontWeight: 700,
            color: scoreColor(file.score),
            background: scoreBg(file.score),
          }}
        >
          {Math.round((file.score / 30) * 100)}%
        </span>
      )}

      <span
        style={{
          padding: "1px 6px",
          borderRadius: 10,
          fontSize: 9,
          fontWeight: 600,
          color: statusConf.color,
          background: statusConf.bg,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {statusConf.label}
      </span>
    </div>
  );
}

// ── Summary Card ────────────────────────────────────────────

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

// ── Error Card ──────────────────────────────────────────────

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
