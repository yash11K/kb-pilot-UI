"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Link2,
  Loader2,
  RotateCw,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import ScoreBreakdown from "@/components/ScoreBreakdown";
import Badge from "@/components/Badge";
import MdPreview from "@/components/MdPreview";
import { scoreColor, scoreBg, DEEP_LINK_STATUS_CONFIG } from "@/lib/types";
import { getDeepLinks, confirmDeepLinks } from "@/lib/api";
import { streamContextChat } from "@/lib/api";
import { useToast } from "@/components/Toast";
import type { KBFile, DeepLink, ContextMessage } from "@/lib/types";

interface FileDetailsCollapsibleProps {
  file: KBFile;
  canAct: boolean;
  revalidating: boolean;
  showReject: boolean;
  rejectNotes: string;
  onRevalidate: () => void;
  onAccept: () => void;
  onReject: () => void;
  onShowReject: (show: boolean) => void;
  onRejectNotesChange: (notes: string) => void;
}

/** Parse YAML frontmatter from md_content */
function parseFrontmatter(content: string): Record<string, string> {
  const parts = content.split("---");
  if (parts.length < 3) return {};
  const raw = parts[1].trim();
  const result: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const idx = line.indexOf(":");
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      if (key && val) result[key] = val;
    }
  }
  return result;
}

/* ─── Deep Links Section ─────────────────────────────────── */

function DeepLinksSection({ sourceId, sourceUrl }: { sourceId: string; sourceUrl?: string }) {
  const [links, setLinks] = useState<DeepLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ingesting, setIngesting] = useState<Set<string>>(new Set());
  const { showToast } = useToast();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getDeepLinks(sourceId, "pending", sourceUrl)
      .then((data) => {
        if (!cancelled) setLinks(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [sourceId, sourceUrl]);

  const handleIngest = async (link: DeepLink) => {
    setIngesting((prev) => new Set(prev).add(link.id));
    try {
      await confirmDeepLinks(sourceId, [link.id]);
      setLinks((prev) =>
        prev.map((l) => (l.id === link.id ? { ...l, status: "confirmed" as const } : l))
      );
      showToast(`Ingestion started for ${link.anchor_text || link.url}`, "success");
    } catch {
      showToast("Failed to trigger ingestion", "error");
    } finally {
      setIngesting((prev) => {
        const next = new Set(prev);
        next.delete(link.id);
        return next;
      });
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "12px 0", display: "flex", alignItems: "center", gap: 8 }}>
        <Loader2 size={14} style={{ color: "#7c3aed", animation: "spin 1s linear infinite" }} />
        <span style={{ fontSize: 12, color: "#9ca3af" }}>Loading deep links…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "8px 10px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 6, fontSize: 11, color: "#991b1b" }}>
        {error}
      </div>
    );
  }

  if (links.length === 0) {
    return (
      <div style={{ padding: "12px 0", fontSize: 12, color: "#9ca3af", textAlign: "center" }}>
        No deep links discovered for this file.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {links.map((link) => {
        const cfg = DEEP_LINK_STATUS_CONFIG[link.status];
        const isIngesting = ingesting.has(link.id);
        const canIngest = link.status === "pending" || link.status === "confirmed";

        return (
          <div
            key={link.id}
            style={{
              padding: "8px 10px",
              background: "#f9fafb",
              border: "1px solid #f3f4f6",
              borderRadius: 8,
              fontSize: 11,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: "#111827", marginBottom: 2, wordBreak: "break-all" }}>
                  {link.anchor_text || link.url}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "#9ca3af",
                    fontFamily: "var(--font-dm-mono), 'DM Mono', monospace",
                    wordBreak: "break-all",
                  }}
                >
                  {link.url}
                </div>
              </div>
              <Badge label={cfg.label} color={cfg.color} bg={cfg.bg} />
            </div>
            {canIngest && (
              <button
                onClick={() => handleIngest(link)}
                disabled={isIngesting}
                style={{
                  marginTop: 6,
                  width: "100%",
                  padding: "5px 0",
                  background: isIngesting ? "#f3f4f6" : "#7c3aed",
                  color: isIngesting ? "#9ca3af" : "#fff",
                  border: "none",
                  borderRadius: 6,
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: isIngesting ? "default" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                }}
              >
                {isIngesting ? (
                  <>
                    <Loader2 size={10} style={{ animation: "spin 1s linear infinite" }} />
                    Ingesting…
                  </>
                ) : (
                  <>
                    <ExternalLink size={10} /> Ingest
                  </>
                )}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Context Agent Section (on-demand) ──────────────────── */

function ContextAgentSection({ fileId }: { fileId: string }) {
  const [input, setInput] = useState("");
  const [conversation, setConversation] = useState<ContextMessage[]>([]);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  const handleSend = useCallback(() => {
    const q = input.trim();
    if (!q || asking) return;

    abortRef.current?.abort();

    const userMsg: ContextMessage = { role: "user", content: q };
    const updated = [...conversation, userMsg];
    setConversation(updated);
    setInput("");
    setAsking(true);
    setError(null);

    let assistantText = "";

    const ctrl = streamContextChat(
      fileId,
      updated,
      (text) => {
        assistantText += text;
        setConversation([...updated, { role: "assistant", content: assistantText }]);
      },
      () => {
        setConversation([...updated, { role: "assistant", content: assistantText }]);
        setAsking(false);
      },
      (err) => {
        setError(err.message);
        setAsking(false);
      },
    );

    abortRef.current = ctrl;
  }, [input, asking, conversation, fileId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Conversation */}
      {conversation.length > 0 && (
        <div style={{ maxHeight: 200, overflow: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
          {conversation.map((msg, i) => (
            <div
              key={i}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                fontSize: 12,
                lineHeight: 1.5,
                ...(msg.role === "user"
                  ? { background: "#f3f0ff", color: "#5b21b6", marginLeft: 20, textAlign: "right" as const }
                  : { background: "#f9fafb", color: "#374151" }),
              }}
            >
              {msg.role === "assistant" ? <MdPreview content={msg.content} /> : msg.content}
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ padding: "6px 10px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 6, fontSize: 11, color: "#991b1b" }}>
          {error}
        </div>
      )}

      {/* Input */}
      <div style={{ display: "flex", gap: 6 }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about this file…"
          disabled={asking}
          style={{
            flex: 1,
            padding: "7px 10px",
            border: "1.5px solid #ede9fe",
            borderRadius: 8,
            fontSize: 12,
            outline: "none",
            fontFamily: "inherit",
            background: asking ? "#f9fafb" : "#fff",
          }}
        />
        <button
          onClick={handleSend}
          disabled={asking || !input.trim()}
          style={{
            padding: "7px 10px",
            background: asking || !input.trim() ? "#f3f4f6" : "#7c3aed",
            color: asking || !input.trim() ? "#9ca3af" : "#fff",
            border: "none",
            borderRadius: 8,
            cursor: asking || !input.trim() ? "default" : "pointer",
            display: "flex",
            alignItems: "center",
          }}
        >
          {asking ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={14} />}
        </button>
      </div>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────── */

export default function FileDetailsCollapsible({
  file,
  canAct,
  revalidating,
  showReject,
  rejectNotes,
  onRevalidate,
  onAccept,
  onReject,
  onShowReject,
  onRejectNotesChange,
}: FileDetailsCollapsibleProps) {
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [deepLinksExpanded, setDeepLinksExpanded] = useState(false);
  const [contextExpanded, setContextExpanded] = useState(false);

  const score = file.validation_score;
  const issueCount = file.validation_issues?.length ?? 0;
  const frontmatter = parseFrontmatter(file.md_content);
  const fmKeys = Object.keys(frontmatter);

  return (
    <div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* ── Section 1: File Details ── */}
      <div style={{ borderBottom: "1px solid #ede9fe", marginBottom: 12 }}>
        <button
          onClick={() => setDetailsExpanded(!detailsExpanded)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 0",
            background: "none",
            border: "none",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          {detailsExpanded ? <ChevronDown size={14} color="#6b7280" /> : <ChevronRight size={14} color="#6b7280" />}
          <span style={{ fontSize: 12, fontWeight: 700, color: "#4b5563", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            File Details
          </span>
          <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 12, fontWeight: 700, color: scoreColor(score), background: scoreBg(score) }}>
              {Math.round(score * 100)}%
            </span>
            {issueCount > 0 && (
              <span style={{ fontSize: 11, color: "#92400e", background: "#fffbeb", padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>
                {issueCount} issue{issueCount > 1 ? "s" : ""}
              </span>
            )}
          </span>
        </button>

        {detailsExpanded && (
          <div style={{ paddingBottom: 12 }}>
            {/* YAML Frontmatter Metadata */}
            {fmKeys.length > 0 && (
              <div style={{ background: "#faf5ff", border: "1px solid #e9d5ff", borderRadius: 10, padding: 12, marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9333ea", marginBottom: 8 }}>
                  YAML Metadata
                </div>
                {fmKeys.map((key) => (
                  <div
                    key={key}
                    style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px solid #ede9fe" }}
                  >
                    <span style={{ fontSize: 10, color: "#7c3aed", fontWeight: 600 }}>{key}</span>
                    <span style={{ fontSize: 10, color: "#6b21a8", fontFamily: "var(--font-dm-mono), 'DM Mono', monospace", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {frontmatter[key]}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Score breakdown */}
            <div style={{ marginBottom: 12 }}>
              <ScoreBreakdown breakdown={file.validation_breakdown} />
              <button
                onClick={onRevalidate}
                disabled={revalidating}
                style={{
                  marginTop: 8,
                  width: "100%",
                  padding: "7px 0",
                  background: revalidating ? "#f3f4f6" : "#f3f0ff",
                  color: revalidating ? "#9ca3af" : "#7c3aed",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: revalidating ? "default" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                }}
              >
                <RotateCw size={12} style={revalidating ? { animation: "spin 0.8s linear infinite" } : undefined} />
                {revalidating ? "Revalidating\u2026" : "Revalidate"}
              </button>
            </div>

            {/* Issues */}
            {issueCount > 0 && (
              <div style={{ marginBottom: 12 }}>
                {file.validation_issues.map((iss, i) => (
                  <div key={i} style={{ padding: "6px 10px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, fontSize: 11, color: "#92400e", marginBottom: 4 }}>
                    {iss}
                  </div>
                ))}
              </div>
            )}

            {/* Source metadata */}
            <div style={{ marginBottom: 12 }}>
              {([
                ["AEM URL", file.source_url?.split("/").slice(-2).join("/")],
                ["Component", file.component_type?.split("/").pop()],
                ["Node ID", file.aem_node_id],
                ["S3 Key", file.s3_key || "\u2014"],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #f3f4f6" }}>
                  <span style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600 }}>{k}</span>
                  <span style={{ fontSize: 10, color: "#374151", fontFamily: "var(--font-dm-mono), 'DM Mono', monospace", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {v}
                  </span>
                </div>
              ))}
            </div>

            {/* Reject form */}
            {showReject && (
              <div style={{ marginBottom: 10 }}>
                <textarea
                  value={rejectNotes}
                  onChange={(e) => onRejectNotesChange(e.target.value)}
                  placeholder="Reason for rejection (required)..."
                  style={{ width: "100%", height: 60, border: "1.5px solid #fca5a5", borderRadius: 6, padding: 8, fontSize: 11, resize: "none", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
                />
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  <button onClick={onReject} style={{ flex: 1, padding: "6px 0", background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", opacity: rejectNotes.trim() ? 1 : 0.5 }}>
                    Confirm Reject
                  </button>
                  <button onClick={() => onShowReject(false)} style={{ padding: "6px 10px", background: "#f3f4f6", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer", color: "#6b7280" }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Action buttons */}
            {canAct && !showReject && (
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={onAccept} style={{ flex: 1, padding: "8px 0", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                  <Check size={13} color="#fff" /> Accept
                </button>
                <button onClick={() => onShowReject(true)} style={{ flex: 1, padding: "8px 0", background: "#fff", color: "#dc2626", border: "1.5px solid #fca5a5", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                  <X size={13} color="#dc2626" /> Reject
                </button>
              </div>
            )}

            {/* Reviewed by */}
            {file.reviewed_by && (
              <div style={{ padding: "8px 10px", background: "#f9fafb", borderRadius: 8, marginTop: 8 }}>
                <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600, marginBottom: 2 }}>Reviewed by</div>
                <div style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>{file.reviewed_by}</div>
                {file.review_notes && (
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4, fontStyle: "italic" }}>
                    &ldquo;{file.review_notes}&rdquo;
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Section 2: Deep Links ── */}
      <div style={{ borderBottom: "1px solid #ede9fe", marginBottom: 12 }}>
        <button
          onClick={() => setDeepLinksExpanded(!deepLinksExpanded)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 0",
            background: "none",
            border: "none",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          {deepLinksExpanded ? <ChevronDown size={14} color="#6b7280" /> : <ChevronRight size={14} color="#6b7280" />}
          <Link2 size={13} color="#7c3aed" />
          <span style={{ fontSize: 12, fontWeight: 700, color: "#4b5563", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Deep Links
          </span>
        </button>

        {deepLinksExpanded && (
          <div style={{ paddingBottom: 12 }}>
            {file.source_id ? (
              <DeepLinksSection sourceId={file.source_id} sourceUrl={file.source_url} />
            ) : (
              <div style={{ padding: "12px 0", fontSize: 12, color: "#9ca3af", textAlign: "center" }}>
                No source associated with this file.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Section 3: Context Agent ── */}
      <div style={{ borderBottom: "1px solid #ede9fe", marginBottom: 12 }}>
        <button
          onClick={() => setContextExpanded(!contextExpanded)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 0",
            background: "none",
            border: "none",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          {contextExpanded ? <ChevronDown size={14} color="#6b7280" /> : <ChevronRight size={14} color="#6b7280" />}
          <Sparkles size={13} color="#7c3aed" />
          <span style={{ fontSize: 12, fontWeight: 700, color: "#4b5563", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Context Agent
          </span>
        </button>

        {contextExpanded && (
          <div style={{ paddingBottom: 12 }}>
            <ContextAgentSection fileId={file.id} />
          </div>
        )}
      </div>
    </div>
  );
}
