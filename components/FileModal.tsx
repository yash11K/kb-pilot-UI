"use client";

import { useState } from "react";
import { useSWRConfig } from "swr";
import { X, Check, Edit, RotateCw } from "lucide-react";
import Badge from "@/components/Badge";
import ScorePill from "@/components/ScorePill";
import ScoreBreakdown from "@/components/ScoreBreakdown";
import MdPreview from "@/components/MdPreview";
import { STATUS_CONFIG, scoreColor, scoreBg } from "@/lib/types";
import { useFileDetail } from "@/hooks/useFileDetail";
import { acceptFile, rejectFile, updateFileContent, revalidateFile } from "@/lib/api";
import { useToast } from "@/components/Toast";

interface FileModalProps {
  fileId: string;
  source: "queue" | "files";
  onClose: () => void;
}

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

export default function FileModal({ fileId, source, onClose }: FileModalProps) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [rejectNotes, setRejectNotes] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [revalidating, setRevalidating] = useState(false);

  const { mutate: globalMutate } = useSWRConfig();
  const { showToast } = useToast();
  const { data, error: fileError, isLoading: fileLoading, mutate: mutateFileDetail } = useFileDetail(fileId, source);
  const file = data;

  const reviewer =
    process.env.NEXT_PUBLIC_REVIEWER_EMAIL || "reviewer@example.com";

  const canAct = file?.status === "pending_review" || source === "queue";
  const sc = file
    ? STATUS_CONFIG[file.status] || STATUS_CONFIG.pending_validation
    : null;

  const invalidateCache = async () => {
    await globalMutate(
      (key: string) =>
        typeof key === "string" &&
        (key.startsWith("queue:") ||
          key.startsWith("files:") ||
          key.startsWith("file-detail:") ||
          key === "stats")
    );
  };

  const handleAccept = async () => {
    try {
      await acceptFile(fileId, reviewer);
      onClose();
      await invalidateCache();
      showToast("File accepted → S3 upload queued", "success");
    } catch {
      showToast("Failed to accept file. Please try again.", "error");
    }
  };

  const handleRevalidate = async () => {
    setRevalidating(true);
    try {
      const updated = await revalidateFile(fileId);
      await mutateFileDetail(updated, { revalidate: false });
      await invalidateCache();
      showToast("Revalidation complete", "success");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Revalidation failed";
      showToast(msg, "error");
    } finally {
      setRevalidating(false);
    }
  };

  const handleReject = async () => {
    if (!rejectNotes.trim()) return;
    try {
      await rejectFile(fileId, reviewer, rejectNotes);
      onClose();
      await invalidateCache();
      showToast("File rejected", "error");
    } catch {
      showToast("Failed to reject file. Please try again.", "error");
    }
  };

  const handleSaveContent = async () => {
    const previousData = file;
    try {
      await mutateFileDetail(
        async (current) => {
          await updateFileContent(fileId, editContent, reviewer);
          return current ? { ...current, md_content: editContent } : current;
        },
        {
          optimisticData: previousData
            ? { ...previousData, md_content: editContent }
            : undefined,
          rollbackOnError: true,
          revalidate: false,
        }
      );
      showToast("Content updated", "success");
      setEditing(false);
    } catch {
      showToast("Failed to update content. Please try again.", "error");
    }
  };

  return (
    <>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1000,
          background: "rgba(0,0,0,0.35)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backdropFilter: "blur(4px)",
          animation: "fadeIn 0.2s ease",
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="modal-responsive"
          style={{
            width: "92vw",
            maxWidth: 960,
            height: "90vh",
            background: "#fff",
            borderRadius: 20,
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 25px 60px rgba(0,0,0,0.15)",
            animation: "slideUp 0.25s ease",
          }}
        >
          {/* Loading state */}
          {fileLoading && !file ? (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  border: "3px solid #e5e7eb",
                  borderTopColor: "#7c3aed",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : fileError && !file ? (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  background: "#fff",
                  borderRadius: 14,
                  border: "1px solid #fecaca",
                  padding: "32px 24px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 14, color: "#dc2626", marginBottom: 12 }}>
                  Failed to load data.
                </div>
                <button
                  onClick={() => mutateFileDetail()}
                  style={{
                    padding: "8px 20px",
                    background: "#7c3aed",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Retry
                </button>
              </div>
            </div>
          ) : !file ? (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  border: "3px solid #e5e7eb",
                  borderTopColor: "#7c3aed",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : (
            <>
              {/* Header */}
              <div
                style={{
                  padding: "20px 28px",
                  borderBottom: "1px solid #f3f4f6",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginBottom: 6,
                      flexWrap: "wrap",
                    }}
                  >
                    {sc && (
                      <Badge label={sc.label} color={sc.color} bg={sc.bg} />
                    )}
                    <ScorePill score={file.validation_score} />
                    <Badge
                      label={file.content_type}
                      color="#7c3aed"
                      bg="#f3f0ff"
                    />
                  </div>
                  <h2
                    style={{
                      fontSize: 20,
                      fontWeight: 700,
                      color: "#111827",
                      margin: 0,
                    }}
                  >
                    {file.title || file.filename}
                  </h2>
                  <div
                    style={{
                      fontSize: 12,
                      color: "#9ca3af",
                      marginTop: 4,
                      fontFamily: "var(--font-dm-mono), 'DM Mono', monospace",
                    }}
                  >
                    {file.filename} · {file.region}/{file.brand} ·{" "}
                    {fmtDate(file.created_at)}
                  </div>
                </div>
                <button
                  onClick={onClose}
                  style={{
                    background: "#f3f4f6",
                    border: "none",
                    borderRadius: 10,
                    width: 36,
                    height: 36,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                >
                  <X size={16} color="#6b7280" />
                </button>
              </div>

              {/* Body */}
              <div className="modal-body-responsive" style={{ flex: 1, overflow: "auto", display: "flex" }}>
                {/* Left panel: Content */}
                <div
                  style={{
                    flex: 1,
                    padding: 28,
                    overflow: "auto",
                    borderRight: "1px solid #f3f4f6",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 16,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#4b5563",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                      }}
                    >
                      {editing ? "Edit Content" : "Content Preview"}
                    </span>
                    {canAct && (
                      <button
                        onClick={() => {
                          if (editing) {
                            setEditContent(file.md_content);
                          } else {
                            setEditContent(file.md_content);
                          }
                          setEditing(!editing);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "6px 14px",
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 600,
                          border: "none",
                          cursor: "pointer",
                          background: editing ? "#fef2f2" : "#f3f0ff",
                          color: editing ? "#dc2626" : "#7c3aed",
                        }}
                      >
                        {editing ? (
                          <>
                            <X size={13} /> Cancel
                          </>
                        ) : (
                          <>
                            <Edit size={13} /> Edit
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  {editing ? (
                    <div style={{ height: "calc(100% - 50px)" }}>
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        style={{
                          width: "100%",
                          height: "calc(100% - 44px)",
                          border: "1.5px solid #e5e7eb",
                          borderRadius: 10,
                          padding: 16,
                          fontFamily:
                            "var(--font-dm-mono), 'DM Mono', monospace",
                          fontSize: 13,
                          lineHeight: 1.7,
                          resize: "none",
                          outline: "none",
                          color: "#1f2937",
                          background: "#fafafa",
                          boxSizing: "border-box",
                        }}
                      />
                      <button
                        onClick={handleSaveContent}
                        style={{
                          marginTop: 8,
                          padding: "8px 20px",
                          background: "#7c3aed",
                          color: "#fff",
                          border: "none",
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Save Changes
                      </button>
                    </div>
                  ) : (
                    <MdPreview content={file.md_content} />
                  )}
                </div>

                {/* Right panel: Meta & Actions */}
                <div
                  className="modal-right-panel"
                  style={{
                    width: 300,
                    padding: 24,
                    overflow: "auto",
                    flexShrink: 0,
                  }}
                >
                  {/* Validation Score */}
                  <div style={{ marginBottom: 24 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#4b5563",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        marginBottom: 12,
                      }}
                    >
                      Validation Score
                    </div>
                    <div
                      style={{
                        textAlign: "center",
                        padding: "16px 0",
                        marginBottom: 16,
                        background: scoreBg(file.validation_score),
                        borderRadius: 12,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 36,
                          fontWeight: 800,
                          color: scoreColor(file.validation_score),
                        }}
                      >
                        {Math.round(file.validation_score * 100)}%
                      </div>
                    </div>
                    <ScoreBreakdown breakdown={file.validation_breakdown} />
                    <button
                      onClick={handleRevalidate}
                      disabled={revalidating}
                      style={{
                        marginTop: 14,
                        width: "100%",
                        padding: "9px 0",
                        background: revalidating ? "#f3f4f6" : "#f3f0ff",
                        color: revalidating ? "#9ca3af" : "#7c3aed",
                        border: "none",
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: revalidating ? "default" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                      }}
                    >
                      <RotateCw
                        size={13}
                        style={
                          revalidating
                            ? { animation: "spin 0.8s linear infinite" }
                            : undefined
                        }
                      />
                      {revalidating ? "Revalidating…" : "Revalidate"}
                    </button>
                  </div>

                  {/* Issues */}
                  {file.validation_issues?.length > 0 && (
                    <div style={{ marginBottom: 24 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#4b5563",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          marginBottom: 8,
                        }}
                      >
                        Issues
                      </div>
                      {file.validation_issues?.map((iss, i) => (
                        <div
                          key={i}
                          style={{
                            padding: "8px 12px",
                            background: "#fffbeb",
                            border: "1px solid #fde68a",
                            borderRadius: 8,
                            fontSize: 12,
                            color: "#92400e",
                            marginBottom: 6,
                          }}
                        >
                          ⚠ {iss}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Source metadata */}
                  <div style={{ marginBottom: 24 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#4b5563",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        marginBottom: 8,
                      }}
                    >
                      Source
                    </div>
                    {(
                      [
                        [
                          "AEM URL",
                          file.source_url?.split("/").slice(-2).join("/"),
                        ],
                        [
                          "Component",
                          file.component_type?.split("/").pop(),
                        ],
                        ["Node ID", file.aem_node_id],
                        ["S3 Key", file.s3_key || "—"],
                      ] as [string, string][]
                    ).map(([k, v]) => (
                      <div
                        key={k}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          padding: "5px 0",
                          borderBottom: "1px solid #f3f4f6",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            color: "#9ca3af",
                            fontWeight: 600,
                          }}
                        >
                          {k}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            color: "#374151",
                            fontFamily:
                              "var(--font-dm-mono), 'DM Mono', monospace",
                            maxWidth: 160,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {v}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Reject form */}
                  {showReject && (
                    <div style={{ marginBottom: 16 }}>
                      <textarea
                        value={rejectNotes}
                        onChange={(e) => setRejectNotes(e.target.value)}
                        placeholder="Reason for rejection (required)..."
                        style={{
                          width: "100%",
                          height: 80,
                          border: "1.5px solid #fca5a5",
                          borderRadius: 8,
                          padding: 10,
                          fontSize: 12,
                          resize: "none",
                          outline: "none",
                          fontFamily: "inherit",
                          boxSizing: "border-box",
                        }}
                      />
                      <div
                        style={{ display: "flex", gap: 8, marginTop: 8 }}
                      >
                        <button
                          onClick={handleReject}
                          style={{
                            flex: 1,
                            padding: "8px 0",
                            background: "#dc2626",
                            color: "#fff",
                            border: "none",
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                            opacity: rejectNotes.trim() ? 1 : 0.5,
                          }}
                        >
                          Confirm Reject
                        </button>
                        <button
                          onClick={() => setShowReject(false)}
                          style={{
                            padding: "8px 14px",
                            background: "#f3f4f6",
                            border: "none",
                            borderRadius: 8,
                            fontSize: 12,
                            cursor: "pointer",
                            color: "#6b7280",
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  {canAct && !showReject && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      <button
                        onClick={handleAccept}
                        style={{
                          padding: "12px 0",
                          background: "#7c3aed",
                          color: "#fff",
                          border: "none",
                          borderRadius: 10,
                          fontSize: 14,
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                          boxShadow: "0 2px 8px rgba(124,58,237,0.25)",
                        }}
                      >
                        <Check size={16} color="#fff" /> Accept &amp; Push to S3
                      </button>
                      <button
                        onClick={() => setShowReject(true)}
                        style={{
                          padding: "12px 0",
                          background: "#fff",
                          color: "#dc2626",
                          border: "1.5px solid #fca5a5",
                          borderRadius: 10,
                          fontSize: 14,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                        }}
                      >
                        <X size={16} color="#dc2626" /> Reject
                      </button>
                    </div>
                  )}

                  {/* Reviewed by */}
                  {file.reviewed_by && (
                    <div
                      style={{
                        padding: "12px 14px",
                        background: "#f9fafb",
                        borderRadius: 10,
                        marginTop: 12,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          color: "#9ca3af",
                          fontWeight: 600,
                          marginBottom: 4,
                        }}
                      >
                        Reviewed by
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          color: "#374151",
                          fontWeight: 500,
                        }}
                      >
                        {file.reviewed_by}
                      </div>
                      {file.review_notes && (
                        <div
                          style={{
                            fontSize: 12,
                            color: "#6b7280",
                            marginTop: 6,
                            fontStyle: "italic",
                          }}
                        >
                          &ldquo;{file.review_notes}&rdquo;
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
