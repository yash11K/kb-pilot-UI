"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Edit,
  ExternalLink,
  Link2,
  Loader2,
  RotateCw,
  X,
} from "lucide-react";
import Badge from "@/components/Badge";
import ScorePill from "@/components/ScorePill";
import ScoreBreakdown from "@/components/ScoreBreakdown";
import MdPreview from "@/components/MdPreview";
import { useFileDetail } from "@/hooks/useFileDetail";
import { useSourceDetail } from "@/hooks/useSourceDetail";
import {
  acceptFile,
  rejectFile,
  updateFileContent,
  revalidateFile,
  getDeepLinks,
  confirmDeepLinks,
} from "@/lib/api";
import {
  STATUS_CONFIG,
  scoreColor,
  scoreBg,
  DEEP_LINK_STATUS_CONFIG,
} from "@/lib/types";
import { useToast } from "@/components/Toast";
import type { DeepLink } from "@/lib/types";
import { useSWRConfig } from "swr";

/* ─── Helpers ────────────────────────────────────────────── */

function fmtDate(d: string | null) {
  return d
    ? new Date(d).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
}

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

/* ─── Deep Links Panel ───────────────────────────────────── */

function DeepLinksPanel({ sourceId, sourceUrl }: { sourceId: string; sourceUrl?: string }) {
  const [links, setLinks] = useState<DeepLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [ingesting, setIngesting] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getDeepLinks(sourceId, "pending", sourceUrl)
      .then((data) => { if (!cancelled) setLinks(data); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sourceId, sourceUrl]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const pending = links.filter((l) => l.status === "pending");
    if (selected.size === pending.length) setSelected(new Set());
    else setSelected(new Set(pending.map((l) => l.id)));
  };

  const handleIngest = async () => {
    if (selected.size === 0 || ingesting) return;
    setIngesting(true);
    try {
      await confirmDeepLinks(sourceId, Array.from(selected));
      setLinks((prev) =>
        prev.map((l) => selected.has(l.id) ? { ...l, status: "confirmed" as const } : l)
      );
      showToast(`Ingestion started for ${selected.size} link(s)`, "success");
      setSelected(new Set());
    } catch {
      showToast("Failed to trigger ingestion", "error");
    } finally {
      setIngesting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 16, color: "#9ca3af", fontSize: 13 }}>
        <Loader2 size={14} style={{ color: "#7c3aed", animation: "spin 1s linear infinite" }} />
        Loading deep links…
      </div>
    );
  }

  if (error) {
    return <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, fontSize: 12, color: "#991b1b" }}>{error}</div>;
  }

  if (links.length === 0) {
    return <div style={{ padding: 16, fontSize: 13, color: "#9ca3af", textAlign: "center" }}>No deep links discovered for this file.</div>;
  }

  const pendingLinks = links.filter((l) => l.status === "pending");

  return (
    <div>
      {/* Action bar */}
      {pendingLinks.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <button onClick={toggleAll} style={{ padding: "5px 12px", background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 11, fontWeight: 600, color: "#374151", cursor: "pointer" }}>
            {selected.size === pendingLinks.length ? "Deselect All" : "Select All"}
          </button>
          <button
            onClick={handleIngest}
            disabled={ingesting || selected.size === 0}
            style={{
              padding: "5px 12px",
              background: selected.size > 0 ? "#7c3aed" : "#d1d5db",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              cursor: selected.size > 0 ? "pointer" : "default",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            {ingesting ? <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> : <ExternalLink size={11} />}
            Ingest Selected ({selected.size})
          </button>
        </div>
      )}

      {/* Links list */}
      {links.map((link) => {
        const cfg = DEEP_LINK_STATUS_CONFIG[link.status];
        const canSelect = link.status === "pending";
        return (
          <label
            key={link.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 10px",
              borderRadius: 8,
              cursor: canSelect ? "pointer" : "default",
              background: selected.has(link.id) ? "#f3f0ff" : "transparent",
              transition: "background 0.1s",
              marginBottom: 2,
            }}
          >
            {canSelect && (
              <input
                type="checkbox"
                checked={selected.has(link.id)}
                onChange={() => toggle(link.id)}
                style={{ accentColor: "#7c3aed", width: 15, height: 15, cursor: "pointer" }}
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "#111827" }}>
                {link.anchor_text || link.url}
              </div>
              {link.anchor_text && (
                <div style={{ fontSize: 10.5, color: "#9ca3af", fontFamily: "var(--font-dm-mono), 'DM Mono', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {link.url}
                </div>
              )}
            </div>
            <Badge label={cfg.label} color={cfg.color} bg={cfg.bg} />
          </label>
        );
      })}
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────── */

export default function FileReviewPage() {
  const params = useParams();
  const router = useRouter();
  const sourceId = params.sourceId as string;
  const fileId = params.fileId as string;
  const { showToast } = useToast();
  const { mutate: globalMutate } = useSWRConfig();

  const { data: file, isLoading, error: fileError, mutate: mutateFile } = useFileDetail(fileId, "files");
  const { data: source } = useSourceDetail(sourceId);

  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [revalidating, setRevalidating] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejectNotes, setRejectNotes] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [deepLinksOpen, setDeepLinksOpen] = useState(true);

  const reviewer = process.env.NEXT_PUBLIC_REVIEWER_EMAIL || "reviewer@example.com";
  const canAct = file?.status === "pending_review";
  const sc = file ? STATUS_CONFIG[file.status] || STATUS_CONFIG.pending_validation : null;

  const invalidateCache = async () => {
    await globalMutate(
      (key: string) =>
        typeof key === "string" &&
        (key.startsWith("queue:") || key.startsWith("files:") || key.startsWith("file-detail:") || key === "stats")
    );
  };

  const handleAccept = async () => {
    try {
      await acceptFile(fileId, reviewer);
      await mutateFile();
      await invalidateCache();
      showToast("File accepted → S3 upload queued", "success");
    } catch {
      showToast("Failed to accept file", "error");
    }
  };

  const handleReject = async () => {
    if (!rejectNotes.trim()) return;
    try {
      await rejectFile(fileId, reviewer, rejectNotes);
      await mutateFile();
      await invalidateCache();
      showToast("File rejected", "error");
      setShowReject(false);
      setRejectNotes("");
    } catch {
      showToast("Failed to reject file", "error");
    }
  };

  const handleRevalidate = async () => {
    setRevalidating(true);
    try {
      const updated = await revalidateFile(fileId);
      await mutateFile(updated, { revalidate: false });
      await invalidateCache();
      showToast("Revalidation complete", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Revalidation failed", "error");
    } finally {
      setRevalidating(false);
    }
  };

  const handleSaveContent = async () => {
    try {
      await updateFileContent(fileId, editContent, reviewer);
      await mutateFile();
      showToast("Content updated", "success");
      setEditing(false);
    } catch {
      showToast("Failed to update content", "error");
    }
  };

  const frontmatter = file ? parseFrontmatter(file.md_content) : {};
  const fmKeys = Object.keys(frontmatter);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Top Bar ── */}
      <div
        style={{
          padding: "14px 32px",
          borderBottom: "1px solid #f3f4f6",
          background: "#fff",
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => router.push(`/sources/${sourceId}`)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 4,
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            color: "#7c3aed",
          }}
        >
          <ArrowLeft size={18} />
        </button>
        <span style={{ fontSize: 13, color: "#9ca3af" }}>
          <button
            onClick={() => router.push("/sources")}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#7c3aed", fontSize: 13, fontWeight: 600, padding: 0, fontFamily: "inherit" }}
          >
            Sources
          </button>
          {" / "}
          <button
            onClick={() => router.push(`/sources/${sourceId}`)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#7c3aed", fontSize: 13, fontWeight: 600, padding: 0, fontFamily: "inherit" }}
          >
            {source?.nav_label || source?.url || sourceId.slice(0, 8)}
          </button>
          {" / "}
          <span style={{ color: "#374151", fontWeight: 600 }}>
            {file?.title || file?.filename || "Loading…"}
          </span>
        </span>
      </div>

      {/* ── Loading ── */}
      {isLoading && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 36, height: 36, border: "3px solid #e5e7eb", borderTopColor: "#7c3aed", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        </div>
      )}

      {/* ── Error ── */}
      {fileError && !isLoading && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #fecaca", padding: "32px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 14, color: "#dc2626", marginBottom: 12 }}>Failed to load file.</div>
            <button onClick={() => mutateFile()} style={{ padding: "8px 20px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Retry
            </button>
          </div>
        </div>
      )}

      {/* ── Main Content ── */}
      {file && !isLoading && (
        <>
          <div style={{ flex: 1, overflow: "auto", display: "flex" }}>
            {/* Left: Content Preview */}
            <div style={{ flex: 1, padding: 32, overflow: "auto", borderRight: "1px solid #f3f4f6" }}>
              {/* File header */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                {sc && <Badge label={sc.label} color={sc.color} bg={sc.bg} />}
                <ScorePill score={file.validation_score} />
                <Badge label={file.content_type} color="#7c3aed" bg="#f3f0ff" />
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: "0 0 4px" }}>
                {file.title || file.filename}
              </h1>
              <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 20, fontFamily: "var(--font-dm-mono), 'DM Mono', monospace" }}>
                {file.filename} · {file.region}/{file.brand} · {fmtDate(file.created_at)}
              </div>

              {/* Edit toggle */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#4b5563", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {editing ? "Edit Content" : "Content Preview"}
                </span>
                {canAct && (
                  <button
                    onClick={() => { setEditContent(file.md_content); setEditing(!editing); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8,
                      fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer",
                      background: editing ? "#fef2f2" : "#f3f0ff",
                      color: editing ? "#dc2626" : "#7c3aed",
                    }}
                  >
                    {editing ? <><X size={13} /> Cancel</> : <><Edit size={13} /> Edit</>}
                  </button>
                )}
              </div>

              {editing ? (
                <div>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    style={{
                      width: "100%", minHeight: 400, border: "1.5px solid #e5e7eb", borderRadius: 12, padding: 20,
                      fontFamily: "var(--font-dm-mono), 'DM Mono', monospace", fontSize: 13, lineHeight: 1.7,
                      resize: "vertical", outline: "none", color: "#1f2937", background: "#fafafa", boxSizing: "border-box",
                    }}
                  />
                  <button onClick={handleSaveContent} style={{ marginTop: 10, padding: "10px 24px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    Save Changes
                  </button>
                </div>
              ) : (
                <MdPreview content={file.md_content} />
              )}
            </div>

            {/* Right: Details + Deep Links */}
            <div style={{ width: 360, flexShrink: 0, padding: 24, overflow: "auto" }}>
              {/* ── File Details Section ── */}
              <div style={{ borderBottom: "1px solid #ede9fe", marginBottom: 16 }}>
                <button
                  onClick={() => setDetailsOpen(!detailsOpen)}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "10px 0", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
                >
                  {detailsOpen ? <ChevronDown size={14} color="#6b7280" /> : <ChevronRight size={14} color="#6b7280" />}
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#4b5563", textTransform: "uppercase", letterSpacing: "0.06em" }}>File Details</span>
                  <span style={{ marginLeft: "auto", padding: "2px 8px", borderRadius: 6, fontSize: 12, fontWeight: 700, color: scoreColor(file.validation_score), background: scoreBg(file.validation_score) }}>
                    {Math.round(file.validation_score * 100)}%
                  </span>
                </button>

                {detailsOpen && (
                  <div style={{ paddingBottom: 12 }}>
                    {/* YAML Metadata */}
                    {fmKeys.length > 0 && (
                      <div style={{ background: "#faf5ff", border: "1px solid #e9d5ff", borderRadius: 10, padding: 12, marginBottom: 12 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9333ea", marginBottom: 8 }}>YAML Metadata</div>
                        {fmKeys.map((key) => (
                          <div key={key} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px solid #ede9fe" }}>
                            <span style={{ fontSize: 10.5, color: "#7c3aed", fontWeight: 600 }}>{key}</span>
                            <span style={{ fontSize: 10.5, color: "#6b21a8", fontFamily: "var(--font-dm-mono), 'DM Mono', monospace", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {frontmatter[key]}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Score breakdown */}
                    <ScoreBreakdown breakdown={file.validation_breakdown} />
                    <button
                      onClick={handleRevalidate}
                      disabled={revalidating}
                      style={{
                        marginTop: 10, width: "100%", padding: "8px 0",
                        background: revalidating ? "#f3f4f6" : "#f3f0ff",
                        color: revalidating ? "#9ca3af" : "#7c3aed",
                        border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600,
                        cursor: revalidating ? "default" : "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                      }}
                    >
                      <RotateCw size={13} style={revalidating ? { animation: "spin 0.8s linear infinite" } : undefined} />
                      {revalidating ? "Revalidating…" : "Revalidate"}
                    </button>

                    {/* Issues */}
                    {file.validation_issues?.length > 0 && (
                      <div style={{ marginTop: 10 }}>
                        {file.validation_issues.map((iss, i) => (
                          <div key={i} style={{ padding: "6px 10px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, fontSize: 11, color: "#92400e", marginBottom: 4 }}>{iss}</div>
                        ))}
                      </div>
                    )}

                    {/* Source metadata */}
                    <div style={{ marginTop: 10 }}>
                      {([
                        ["AEM URL", file.source_url?.split("/").slice(-2).join("/")],
                        ["Component", file.component_type?.split("/").pop()],
                        ["Node ID", file.aem_node_id],
                        ["S3 Key", file.s3_key || "—"],
                      ] as [string, string][]).map(([k, v]) => (
                        <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #f3f4f6" }}>
                          <span style={{ fontSize: 10.5, color: "#9ca3af", fontWeight: 600 }}>{k}</span>
                          <span style={{ fontSize: 10.5, color: "#374151", fontFamily: "var(--font-dm-mono), 'DM Mono', monospace", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span>
                        </div>
                      ))}
                    </div>

                    {/* Reject form */}
                    {showReject && (
                      <div style={{ marginTop: 10 }}>
                        <textarea
                          value={rejectNotes}
                          onChange={(e) => setRejectNotes(e.target.value)}
                          placeholder="Reason for rejection (required)..."
                          style={{ width: "100%", height: 60, border: "1.5px solid #fca5a5", borderRadius: 6, padding: 8, fontSize: 12, resize: "none", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
                        />
                        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                          <button onClick={handleReject} style={{ flex: 1, padding: "7px 0", background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: rejectNotes.trim() ? 1 : 0.5 }}>Confirm Reject</button>
                          <button onClick={() => setShowReject(false)} style={{ padding: "7px 12px", background: "#f3f4f6", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer", color: "#6b7280" }}>Cancel</button>
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    {canAct && !showReject && (
                      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                        <button onClick={handleAccept} style={{ flex: 1, padding: "9px 0", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                          <Check size={14} color="#fff" /> Accept
                        </button>
                        <button onClick={() => setShowReject(true)} style={{ flex: 1, padding: "9px 0", background: "#fff", color: "#dc2626", border: "1.5px solid #fca5a5", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                          <X size={14} color="#dc2626" /> Reject
                        </button>
                      </div>
                    )}

                    {/* Reviewed by */}
                    {file.reviewed_by && (
                      <div style={{ padding: "8px 10px", background: "#f9fafb", borderRadius: 8, marginTop: 10 }}>
                        <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600, marginBottom: 2 }}>Reviewed by</div>
                        <div style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>{file.reviewed_by}</div>
                        {file.review_notes && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4, fontStyle: "italic" }}>&ldquo;{file.review_notes}&rdquo;</div>}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── Deep Links Section ── */}
              <div style={{ borderBottom: "1px solid #ede9fe", marginBottom: 16 }}>
                <button
                  onClick={() => setDeepLinksOpen(!deepLinksOpen)}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "10px 0", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
                >
                  {deepLinksOpen ? <ChevronDown size={14} color="#6b7280" /> : <ChevronRight size={14} color="#6b7280" />}
                  <Link2 size={13} color="#7c3aed" />
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#4b5563", textTransform: "uppercase", letterSpacing: "0.06em" }}>Deep Links</span>
                </button>
                {deepLinksOpen && (
                  <div style={{ paddingBottom: 12 }}>
                    <DeepLinksPanel sourceId={sourceId} sourceUrl={file.source_url} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
