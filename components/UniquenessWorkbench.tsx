"use client";

import { useState, useCallback } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ExternalLink,
  Loader2,
  Sparkles,
  Trash2,
  X,
  XCircle,
  Layers,
  FileText,
  AlertTriangle,
} from "lucide-react";
import Badge from "@/components/Badge";
import MdPreview from "@/components/MdPreview";
import {
  startUniquenessReview,
  getPairwiseComparison,
  takeSimilarAction,
} from "@/lib/api";
import {
  similarityColor,
  similarityBg,
  STATUS_CONFIG,
  RECOMMENDATION_CONFIG,
} from "@/lib/types";
import type {
  UniquenessReviewSession,
  SimilarDocument,
  PairwiseComparison,
  FileStatus,
} from "@/lib/types";
import { useToast } from "@/components/Toast";

/* ─── Similarity Score Badge ─────────────────────────────── */

function SimilarityBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "4px 12px",
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 700,
        color: similarityColor(score),
        background: similarityBg(score),
        fontFamily: "var(--font-dm-mono), 'DM Mono', monospace",
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: similarityColor(score),
        }}
      />
      {pct}%
    </span>
  );
}

/* ─── Action State per Card ──────────────────────────────── */

type CardAction = "dismiss" | "delete" | "reject" | "keep_both" | null;

interface CardState {
  action: CardAction;
  loading: boolean;
}

/* ─── Similar Doc Card ───────────────────────────────────── */

interface SimilarCardProps {
  doc: SimilarDocument;
  fileId: string;
  expanded: boolean;
  onToggle: () => void;
  cardState: CardState;
  pairwise: PairwiseComparison | null;
  pairwiseLoading: boolean;
  onAction: (action: "dismiss" | "delete" | "reject" | "keep_both") => void;
}

function SimilarCard({
  doc,
  expanded,
  onToggle,
  cardState,
  pairwise,
  pairwiseLoading,
  onAction,
}: SimilarCardProps) {
  const acted = cardState.action !== null;
  const sc = STATUS_CONFIG[doc.status as FileStatus];

  const actionStyles: Record<string, React.CSSProperties> = {
    dismiss: { opacity: 0.45, borderColor: "#d1d5db" },
    delete: { opacity: 0.45, borderColor: "#fca5a5" },
    reject: { opacity: 0.45, borderColor: "#fca5a5" },
    keep_both: { borderColor: "#86efac", background: "#f0fdf4" },
  };

  const cardStyle: React.CSSProperties = acted && cardState.action
    ? actionStyles[cardState.action] || {}
    : {};

  const titleDecoration = (cardState.action === "delete" || cardState.action === "reject") ? "line-through" : "none";

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 12,
        border: "1.5px solid #f3f4f6",
        marginBottom: 8,
        transition: "all 0.2s",
        ...cardStyle,
      }}
    >
      {/* Card Header */}
      <button
        onClick={onToggle}
        disabled={acted && cardState.action !== "keep_both"}
        style={{
          width: "100%",
          padding: "14px 16px",
          background: "none",
          border: "none",
          cursor: acted && cardState.action !== "keep_both" ? "default" : "pointer",
          textAlign: "left",
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
        }}
      >
        <div style={{ marginTop: 2, flexShrink: 0 }}>
          {expanded ? <ChevronDown size={14} color="#6b7280" /> : <ChevronRight size={14} color="#6b7280" />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
            <SimilarityBadge score={doc.similarity_score} />
            {sc && <Badge label={sc.label} color={sc.color} bg={sc.bg} />}
            {doc.doc_type && <Badge label={doc.doc_type} color="#7c3aed" bg="#f3f0ff" />}
            {acted && cardState.action === "keep_both" && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 600, color: "#16a34a" }}>
                <Check size={12} /> Kept
              </span>
            )}
            {acted && (cardState.action === "delete" || cardState.action === "reject") && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 600, color: "#dc2626" }}>
                <XCircle size={12} /> {cardState.action === "delete" ? "Deleted" : "Rejected"}
              </span>
            )}
            {acted && cardState.action === "dismiss" && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 600, color: "#6b7280" }}>
                <X size={12} /> Dismissed
              </span>
            )}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 4, textDecoration: titleDecoration }}>
            {doc.title}
          </div>
          {doc.comparison_insight && (
            <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5, fontStyle: "italic" }}>
              {doc.comparison_insight}
            </div>
          )}
        </div>
      </button>

      {/* Expanded Detail */}
      {expanded && (
        <div style={{ borderTop: "1px solid #f3f4f6", padding: 16 }}>
          {/* Pairwise loading */}
          {pairwiseLoading && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 12, color: "#9ca3af", fontSize: 12 }}>
              <Loader2 size={14} style={{ color: "#7c3aed", animation: "spin 1s linear infinite" }} />
              Loading detailed comparison…
            </div>
          )}

          {/* Pairwise data */}
          {pairwise && (
            <div style={{ marginBottom: 16 }}>
              {/* Recommendation chip */}
              {pairwise.recommendation && (
                <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                  <Sparkles size={14} color="#7c3aed" />
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#4b5563" }}>AI suggests:</span>
                  {(() => {
                    const rc = RECOMMENDATION_CONFIG[pairwise.recommendation];
                    return rc ? <Badge label={rc.label} color={rc.color} bg={rc.bg} /> : null;
                  })()}
                </div>
              )}

              {/* Comparison insight */}
              {pairwise.comparison_insight && (
                <div style={{ padding: "10px 12px", background: "#f9fafb", borderRadius: 8, fontSize: 12, color: "#374151", lineHeight: 1.6, marginBottom: 12 }}>
                  {pairwise.comparison_insight}
                </div>
              )}

              {/* Overlap & Unique areas */}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                {pairwise.overlap_areas.length > 0 && (
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#d97706", marginBottom: 6 }}>
                      <Layers size={11} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
                      Overlap Areas
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {pairwise.overlap_areas.map((area) => (
                        <span key={area} style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 500, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a" }}>
                          {area}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {pairwise.unique_to_source.length > 0 && (
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#16a34a", marginBottom: 6 }}>
                      <FileText size={11} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
                      Unique to Source
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {pairwise.unique_to_source.map((area) => (
                        <span key={area} style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 500, color: "#166534", background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                          {area}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {pairwise.unique_to_similar.length > 0 && (
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#7c3aed", marginBottom: 6 }}>
                      <FileText size={11} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
                      Unique to Similar
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {pairwise.unique_to_similar.map((area) => (
                        <span key={area} style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 500, color: "#5b21b6", background: "#f3f0ff", border: "1px solid #ddd6fe" }}>
                          {area}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Similar doc markdown content */}
          {doc.md_content && (
            <div style={{ maxHeight: 300, overflow: "auto", border: "1px solid #f3f4f6", borderRadius: 8, padding: 12, background: "#fafafa", marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#9ca3af", marginBottom: 8 }}>
                Similar Document Content
              </div>
              <MdPreview content={doc.md_content} />
            </div>
          )}

          {/* Content snippet fallback */}
          {!doc.md_content && doc.content_snippet && (
            <div style={{ padding: 12, background: "#fafafa", borderRadius: 8, border: "1px solid #f3f4f6", marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#9ca3af", marginBottom: 6 }}>
                Content Preview
              </div>
              <div style={{ fontSize: 12, color: "#4b5563", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                {doc.content_snippet}
              </div>
            </div>
          )}

          {/* Source link */}
          {doc.source_url && (
            <a
              href={doc.source_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "#7c3aed", fontWeight: 600, marginBottom: 12, textDecoration: "none" }}
            >
              <ExternalLink size={11} /> View Source
            </a>
          )}

          {/* Action Buttons */}
          {!acted && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
              <button
                onClick={() => onAction("dismiss")}
                disabled={cardState.loading}
                style={{
                  padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                  background: "#fff", color: "#6b7280", border: "1.5px solid #d1d5db",
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                }}
              >
                <X size={12} /> Dismiss
              </button>
              <button
                onClick={() => onAction("keep_both")}
                disabled={cardState.loading}
                style={{
                  padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                  background: "#f0fdf4", color: "#16a34a", border: "1.5px solid #bbf7d0",
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                }}
              >
                <Check size={12} /> Keep Both
              </button>
              <button
                onClick={() => onAction("reject")}
                disabled={cardState.loading}
                style={{
                  padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                  background: "#fffbeb", color: "#d97706", border: "1.5px solid #fde68a",
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                }}
              >
                <AlertTriangle size={12} /> Reject
              </button>
              <button
                onClick={() => onAction("delete")}
                disabled={cardState.loading}
                style={{
                  padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                  background: "#fef2f2", color: "#dc2626", border: "1.5px solid #fca5a5",
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                }}
              >
                <Trash2 size={12} /> Delete
              </button>
              {cardState.loading && (
                <Loader2 size={14} style={{ color: "#7c3aed", animation: "spin 1s linear infinite", marginLeft: 4, alignSelf: "center" }} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Main Workbench Component ───────────────────────────── */

interface UniquenessWorkbenchProps {
  fileId: string;
  fileMdContent: string;
  fileTitle: string;
  onClose: () => void;
}

export default function UniquenessWorkbench({
  fileId,
  fileMdContent,
  fileTitle,
  onClose,
}: UniquenessWorkbenchProps) {
  const { showToast } = useToast();
  const reviewer = process.env.NEXT_PUBLIC_REVIEWER_EMAIL || "reviewer@example.com";

  const [session, setSession] = useState<UniquenessReviewSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Panel height state for bottom collapsible
  const [panelHeight, setPanelHeight] = useState(420);
  const [collapsed, setCollapsed] = useState(false);

  // Per-card state
  const [cardStates, setCardStates] = useState<Record<string, CardState>>({});
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [pairwiseData, setPairwiseData] = useState<Record<string, PairwiseComparison>>({});
  const [pairwiseLoading, setPairwiseLoading] = useState<Record<string, boolean>>({});

  // Sidebar tab for metadata
  const [sideTab, setSideTab] = useState<"docs" | "source">("docs");

  // Load session on mount
  const loadSession = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await startUniquenessReview(fileId);
      setSession(data);
      // Init card states
      const states: Record<string, CardState> = {};
      data.similar_documents.forEach((d) => {
        states[d.file_id] = { action: null, loading: false };
      });
      setCardStates(states);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load uniqueness review");
    } finally {
      setLoading(false);
    }
  }, [fileId]);

  // Load on first render
  useState(() => {
    loadSession();
  });

  // Toggle card expansion + lazy-load pairwise
  const handleToggleCard = useCallback(async (docFileId: string) => {
    if (expandedCard === docFileId) {
      setExpandedCard(null);
      return;
    }
    setExpandedCard(docFileId);

    // Lazy-load pairwise if not already loaded
    if (!pairwiseData[docFileId] && !pairwiseLoading[docFileId]) {
      setPairwiseLoading((prev) => ({ ...prev, [docFileId]: true }));
      try {
        const data = await getPairwiseComparison(fileId, docFileId);
        setPairwiseData((prev) => ({ ...prev, [docFileId]: data }));
      } catch {
        // Pairwise is optional, don't block
      } finally {
        setPairwiseLoading((prev) => ({ ...prev, [docFileId]: false }));
      }
    }
  }, [expandedCard, fileId, pairwiseData, pairwiseLoading]);

  // Handle action on a similar doc
  const handleAction = useCallback(async (docFileId: string, action: "dismiss" | "delete" | "reject" | "keep_both") => {
    setCardStates((prev) => ({
      ...prev,
      [docFileId]: { ...prev[docFileId], loading: true },
    }));
    try {
      const result = await takeSimilarAction(fileId, docFileId, action, reviewer);
      setCardStates((prev) => ({
        ...prev,
        [docFileId]: { action, loading: false },
      }));
      showToast(result.result || `Action "${action}" applied`, "success");
    } catch {
      setCardStates((prev) => ({
        ...prev,
        [docFileId]: { ...prev[docFileId], loading: false },
      }));
      showToast(`Failed to ${action}`, "error");
    }
  }, [fileId, reviewer, showToast]);

  const similarDocs = session?.similar_documents || [];

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: collapsed ? 48 : panelHeight,
        background: "#fff",
        borderTop: "2px solid #ede9fe",
        boxShadow: "0 -4px 24px rgba(0,0,0,0.08)",
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        transition: "height 0.25s ease",
      }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>

      {/* ── Panel Header ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 20px",
          borderBottom: collapsed ? "none" : "1px solid #f3f4f6",
          background: "#faf5ff",
          flexShrink: 0,
          cursor: "pointer",
        }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Sparkles size={16} color="#7c3aed" />
          <span style={{ fontSize: 14, fontWeight: 700, color: "#4b5563" }}>
            Uniqueness Review
          </span>
          {session && (
            <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 500 }}>
              · {similarDocs.length} similar document{similarDocs.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={(e) => { e.stopPropagation(); setCollapsed(!collapsed); }}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" }}
          >
            {collapsed ? <ChevronUp size={16} color="#6b7280" /> : <ChevronDown size={16} color="#6b7280" />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" }}
          >
            <X size={16} color="#6b7280" />
          </button>
        </div>
      </div>

      {/* ── Panel Body ── */}
      {!collapsed && (
        <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>

          {/* Loading state */}
          {loading && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
              <div style={{ display: "flex", gap: 8 }}>
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: 10, height: 10, borderRadius: "50%", background: "#7c3aed",
                      animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                    }}
                  />
                ))}
              </div>
              <span style={{ fontSize: 13, color: "#9ca3af" }}>Analyzing document uniqueness…</span>
            </div>
          )}

          {/* Error state */}
          {error && !loading && (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 13, color: "#dc2626", marginBottom: 10 }}>{error}</div>
                <button
                  onClick={loadSession}
                  style={{ padding: "8px 20px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* Empty state */}
          {session && similarDocs.length === 0 && !loading && (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ textAlign: "center", padding: 32 }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                  <Check size={24} color="#16a34a" />
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#16a34a", marginBottom: 4 }}>
                  No similar documents found
                </div>
                <div style={{ fontSize: 13, color: "#6b7280" }}>
                  This content is unique.
                </div>
              </div>
            </div>
          )}

          {/* Main content: left source doc + right sidebar with tabs */}
          {session && similarDocs.length > 0 && !loading && (
            <>
              {/* Left: Source document */}
              <div style={{ flex: 1, overflow: "auto", padding: 20, borderRight: "1px solid #f3f4f6" }}>
                {/* Session summary banner */}
                {session.session_summary && (
                  <div style={{
                    padding: "10px 14px",
                    background: "#f3f0ff",
                    border: "1px solid #ddd6fe",
                    borderRadius: 10,
                    fontSize: 12,
                    color: "#5b21b6",
                    lineHeight: 1.5,
                    marginBottom: 16,
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                  }}>
                    <Sparkles size={14} color="#7c3aed" style={{ flexShrink: 0, marginTop: 1 }} />
                    {session.session_summary}
                  </div>
                )}

                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#9ca3af", marginBottom: 8 }}>
                  Source Document
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 12 }}>
                  {fileTitle}
                </div>
                <div style={{ maxHeight: panelHeight - 180, overflow: "auto" }}>
                  <MdPreview content={fileMdContent} />
                </div>
              </div>

              {/* Right: Tabbed sidebar */}
              <div style={{ width: 420, flexShrink: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                {/* Tab switcher */}
                <div style={{ display: "flex", borderBottom: "1px solid #f3f4f6", flexShrink: 0 }}>
                  <button
                    onClick={() => setSideTab("docs")}
                    style={{
                      flex: 1, padding: "10px 0", background: "none", border: "none",
                      borderBottom: sideTab === "docs" ? "2px solid #7c3aed" : "2px solid transparent",
                      fontSize: 12, fontWeight: 600, cursor: "pointer",
                      color: sideTab === "docs" ? "#7c3aed" : "#9ca3af",
                    }}
                  >
                    Similar Docs ({similarDocs.length})
                  </button>
                  <button
                    onClick={() => setSideTab("source")}
                    style={{
                      flex: 1, padding: "10px 0", background: "none", border: "none",
                      borderBottom: sideTab === "source" ? "2px solid #7c3aed" : "2px solid transparent",
                      fontSize: 12, fontWeight: 600, cursor: "pointer",
                      color: sideTab === "source" ? "#7c3aed" : "#9ca3af",
                    }}
                  >
                    Metadata
                  </button>
                </div>

                {/* Tab content */}
                <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
                  {sideTab === "docs" && (
                    <>
                      {similarDocs.map((doc) => (
                        <SimilarCard
                          key={doc.file_id}
                          doc={doc}
                          fileId={fileId}
                          expanded={expandedCard === doc.file_id}
                          onToggle={() => handleToggleCard(doc.file_id)}
                          cardState={cardStates[doc.file_id] || { action: null, loading: false }}
                          pairwise={pairwiseData[doc.file_id] || null}
                          pairwiseLoading={pairwiseLoading[doc.file_id] || false}
                          onAction={(action) => handleAction(doc.file_id, action)}
                        />
                      ))}
                    </>
                  )}

                  {sideTab === "source" && session && (
                    <div>
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#9ca3af", marginBottom: 6 }}>File Info</div>
                        {([
                          ["Status", session.file_status],
                          ["Score", String(Math.round(session.file_validation_score)) + " / 30"],
                          ["Source URL", session.file_source_url?.split("/").slice(-2).join("/") || "—"],
                        ] as [string, string][]).map(([k, v]) => (
                          <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "4px 0", borderBottom: "1px solid #f3f4f6" }}>
                            <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>{k}</span>
                            <span style={{ fontSize: 11, color: "#374151", fontFamily: "var(--font-dm-mono), 'DM Mono', monospace" }}>{v}</span>
                          </div>
                        ))}
                      </div>

                      {session.file_uniqueness_insight && (
                        <div style={{ padding: "10px 12px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, marginTop: 12 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#16a34a", marginBottom: 4 }}>
                            Uniqueness Insight
                          </div>
                          <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.5, fontStyle: "italic" }}>
                            &ldquo;{session.file_uniqueness_insight}&rdquo;
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Resize handle at top of panel */}
      {!collapsed && (
        <div
          onMouseDown={(e) => {
            e.preventDefault();
            const startY = e.clientY;
            const startH = panelHeight;
            const onMove = (ev: MouseEvent) => {
              const delta = startY - ev.clientY;
              setPanelHeight(Math.min(window.innerHeight - 100, Math.max(200, startH + delta)));
            };
            const onUp = () => {
              window.removeEventListener("mousemove", onMove);
              window.removeEventListener("mouseup", onUp);
              document.body.style.cursor = "";
              document.body.style.userSelect = "";
            };
            document.body.style.cursor = "row-resize";
            document.body.style.userSelect = "none";
            window.addEventListener("mousemove", onMove);
            window.addEventListener("mouseup", onUp);
          }}
          style={{
            position: "absolute",
            top: -3,
            left: 0,
            right: 0,
            height: 6,
            cursor: "row-resize",
            zIndex: 51,
          }}
        />
      )}
    </div>
  );
}
