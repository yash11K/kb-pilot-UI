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
import ScorePill from "@/components/ScorePill";
import Badge from "@/components/Badge";
import MdPreview from "@/components/MdPreview";
import { DEEP_LINK_STATUS_CONFIG, scoreColor } from "@/lib/types";
import { getDeepLinks, confirmDeepLinks } from "@/lib/api";
import { streamContextChat } from "@/lib/api";
import { useToast } from "@/components/Toast";
import type { KBFile, DeepLink, ContextMessage } from "@/lib/types";

interface FileDetailsCollapsibleProps {
  file: KBFile;
  canAct: boolean;
  revalidating: boolean;
  recheckingUniqueness: boolean;
  showReject: boolean;
  rejectNotes: string;
  onRevalidate: () => void;
  onRecheckUniqueness: () => void;
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

      {error && (
        <div style={{ padding: "6px 10px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 6, fontSize: 11, color: "#991b1b" }}>
          {error}
        </div>
      )}

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
  recheckingUniqueness,
  showReject,
  rejectNotes,
  onRevalidate,
  onRecheckUniqueness,
  onAccept,
  onReject,
  onShowReject,
  onRejectNotesChange,
}: FileDetailsCollapsibleProps) {
  const [metadataExpanded, setMetadataExpanded] = useState(false);
  const [deepLinksExpanded, setDeepLinksExpanded] = useState(false);
  const [contextExpanded, setContextExpanded] = useState(false);

  const issueCount = file.validation_issues?.length ?? 0;
  const frontmatter = parseFrontmatter(file.md_content);
  const fmKeys = Object.keys(frontmatter);

  return (
    <div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* ── Overall Score ── */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#4b5563" }}>Overall Score</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: scoreColor(file.validation_score), fontFamily: "'DM Mono', monospace" }}>
            {Math.round(file.validation_score)}<span style={{ color: "#9ca3af", fontWeight: 400 }}> / 30</span>
          </span>
        </div>
        <div style={{ height: 8, background: "#f3f4f6", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ height: "100%", borderRadius: 4, background: scoreColor(file.validation_score), transition: "width 0.5s ease", width: `${(file.validation_score / 30) * 100}%` }} />
        </div>
      </div>

      {/* ── Revalidate CTA (top-level) ── */}
      <button
        onClick={onRevalidate}
        disabled={revalidating}
        style={{
          marginTop: 4,
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

      {/* ── Validation Scores Breakdown ── */}
      <div style={{ marginTop: 12 }}>
        <ScoreBreakdown breakdown={file.validation_breakdown} />
      </div>

      {/* ── Uniqueness Insight ── */}
      <div style={{ marginTop: 12, padding: "10px 12px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#16a34a", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
          ★ Uniqueness Insight
        </div>
        {file.uniqueness_insight ? (
          <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.5, fontStyle: "italic" }}>
            &ldquo;{file.uniqueness_insight}&rdquo;
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "#9ca3af" }}>
            No uniqueness data available — run uniqueness check
          </div>
        )}
        <button
          onClick={onRecheckUniqueness}
          disabled={recheckingUniqueness}
          style={{
            marginTop: 8,
            width: "100%",
            padding: "6px 0",
            background: recheckingUniqueness ? "#f3f4f6" : file.uniqueness_insight ? "#ecfdf5" : "#16a34a",
            color: recheckingUniqueness ? "#9ca3af" : file.uniqueness_insight ? "#16a34a" : "#fff",
            border: file.uniqueness_insight ? "1px solid #bbf7d0" : "none",
            borderRadius: 7,
            fontSize: 11,
            fontWeight: 600,
            cursor: recheckingUniqueness ? "default" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
          }}
        >
          <RotateCw size={11} style={recheckingUniqueness ? { animation: "spin 0.8s linear infinite" } : undefined} />
          {recheckingUniqueness ? "Checking\u2026" : "Re-check Uniqueness"}
        </button>
      </div>

      {/* ── Validation Issues (top-level) ── */}
      {issueCount > 0 && (
        <div style={{ marginTop: 8 }}>
          {file.validation_issues.map((iss, i) => (
            <div key={i} style={{ padding: "6px 10px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, fontSize: 11, color: "#92400e", marginBottom: 4 }}>
              {iss}
            </div>
          ))}
        </div>
      )}

      {/* ── Reject form (top-level) ── */}
      {showReject && (
        <div style={{ marginTop: 8 }}>
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

      {/* ── Accept / Reject buttons (top-level) ── */}
      {canAct && !showReject && (
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <button onClick={onAccept} style={{ flex: 1, padding: "8px 0", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
            <Check size={13} color="#fff" /> Accept
          </button>
          <button onClick={() => onShowReject(true)} style={{ flex: 1, padding: "8px 0", background: "#fff", color: "#dc2626", border: "1.5px solid #fca5a5", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
            <X size={13} color="#dc2626" /> Reject
          </button>
        </div>
      )}

      {/* ── Reviewed by (top-level) ── */}
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

      {/* ── Section: Metadata (renamed from "File Details") ── */}
      <div style={{ borderTop: "1px solid #ede9fe", marginTop: 12, paddingTop: 4 }}>
        <button
          onClick={() => setMetadataExpanded(!metadataExpanded)}
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
          {metadataExpanded ? <ChevronDown size={14} color="#6b7280" /> : <ChevronRight size={14} color="#6b7280" />}
          <span style={{ fontSize: 12, fontWeight: 700, color: "#4b5563", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Metadata
          </span>
        </button>

        {metadataExpanded && (
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
                    style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "3px 0", borderBottom: "1px solid #ede9fe" }}
                  >
                    <span style={{ fontSize: 10, color: "#7c3aed", fontWeight: 600, flexShrink: 0 }}>{key}</span>
                    <span style={{ fontSize: 10, color: "#6b21a8", fontFamily: "var(--font-dm-mono), 'DM Mono', monospace", wordBreak: "break-all", textAlign: "right" }}>
                      {frontmatter[key]}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Source metadata */}
            <div>
              {([
                ["AEM URL", file.source_url?.split("/").slice(-2).join("/")],
                ["Component", file.component_type?.split("/").pop()],
                ["Node ID", file.aem_node_id],
                ["S3 Key", file.s3_key || "\u2014"],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "4px 0", borderBottom: "1px solid #f3f4f6" }}>
                  <span style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600, flexShrink: 0 }}>{k}</span>
                  <span style={{ fontSize: 10, color: "#374151", fontFamily: "var(--font-dm-mono), 'DM Mono', monospace", wordBreak: "break-all", textAlign: "right" }}>
                    {v}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Section: Deep Links ── */}
      <div style={{ borderTop: "1px solid #ede9fe", marginTop: 12, paddingTop: 4 }}>
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

      {/* ── Section: Context Agent ── */}
      <div style={{ borderTop: "1px solid #ede9fe", marginTop: 12, paddingTop: 4 }}>
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
