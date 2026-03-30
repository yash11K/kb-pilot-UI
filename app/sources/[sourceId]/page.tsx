"use client";

import { useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, RefreshCw, Eye, Link2, Check, X as XIcon } from "lucide-react";
import { useSourceDetail } from "@/hooks/useSourceDetail";
import { useSourceJobs } from "@/hooks/useSourceJobs";
import { useJobStream } from "@/hooks/useJobStream";
import { useDeepLinks } from "@/hooks/useDeepLinks";
import { useAllFiles } from "@/hooks/useAllFiles";
import { reIngestSource, confirmDeepLinks, dismissDeepLinks } from "@/lib/api";
import Badge from "@/components/Badge";
import DataTable from "@/components/DataTable";
import FileModal from "@/components/FileModal";
import AgenticTaskView from "@/components/AgenticTaskView";
import TabSwitcher from "@/components/TabSwitcher";
import { JOB_STATUS_CONFIG } from "@/lib/types";
import { useToast } from "@/components/Toast";
import type { IngestionJob } from "@/lib/types";

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const METRIC_KEYS: { label: string; key: keyof IngestionJob }[] = [
  { label: "Nodes Found", key: "total_nodes_found" },
  { label: "Files Created", key: "files_created" },
  { label: "Auto-Approved", key: "files_auto_approved" },
  { label: "Pending Review", key: "files_pending_review" },
  { label: "Auto-Rejected", key: "files_auto_rejected" },
  { label: "Duplicates Skipped", key: "duplicates_skipped" },
];

type SourceTab = "overview" | "jobs" | "deep-links";

export default function SourceDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const sourceId = params.sourceId as string;
  const router = useRouter();
  const { showToast } = useToast();

  const initialTab = (searchParams.get("tab") as SourceTab) || "overview";
  const [activeTab, setActiveTab] = useState<SourceTab>(initialTab);
  const [jobPage, setJobPage] = useState(1);
  const [reIngesting, setReIngesting] = useState(false);
  const [viewingJobId, setViewingJobId] = useState<string | null>(null);
  const [viewingSourceUrl, setViewingSourceUrl] = useState<string | undefined>();
  const [selectedLinks, setSelectedLinks] = useState<Set<string>>(new Set());
  const [confirmingLinks, setConfirmingLinks] = useState(false);
  const [dismissingLinks, setDismissingLinks] = useState(false);
  const [filePage, setFilePage] = useState(1);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  const { data: source, isLoading: sourceLoading, error: sourceError } = useSourceDetail(sourceId);
  const { data: jobsData, isLoading: jobsLoading, error: jobsError, mutate: jobsMutate } = useSourceJobs(sourceId, jobPage);
  const stream = useJobStream(viewingJobId);
  const { data: deepLinks, isLoading: linksLoading, mutate: linksMutate } = useDeepLinks(sourceId);
  const { data: filesData, isLoading: filesLoading } = useAllFiles({ source_id: sourceId, page: filePage, size: 10 });

  const openLogs = (job: IngestionJob) => {
    setViewingJobId(job.id);
    setViewingSourceUrl(job.source_url);
  };

  const closeLogs = () => {
    setViewingJobId(null);
    setViewingSourceUrl(undefined);
  };

  const toggleLink = (id: string) => {
    setSelectedLinks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllLinks = () => {
    if (selectedLinks.size === deepLinks.length) {
      setSelectedLinks(new Set());
    } else {
      setSelectedLinks(new Set(deepLinks.map((l) => l.id)));
    }
  };

  const handleConfirmLinks = async () => {
    if (confirmingLinks || selectedLinks.size === 0) return;
    setConfirmingLinks(true);
    try {
      await confirmDeepLinks(sourceId, Array.from(selectedLinks));
      showToast(`Ingestion started for ${selectedLinks.size} link(s)`, "success");
      setSelectedLinks(new Set());
      linksMutate();
      jobsMutate();
    } catch {
      showToast("Failed to confirm deep links", "error");
    } finally {
      setConfirmingLinks(false);
    }
  };

  const handleDismissLinks = async () => {
    if (dismissingLinks || selectedLinks.size === 0) return;
    setDismissingLinks(true);
    try {
      await dismissDeepLinks(sourceId, Array.from(selectedLinks));
      showToast(`Dismissed ${selectedLinks.size} link(s)`, "success");
      setSelectedLinks(new Set());
      linksMutate();
    } catch {
      showToast("Failed to dismiss deep links", "error");
    } finally {
      setDismissingLinks(false);
    }
  };

  // Group deep links by found_in_page
  const linksByPage = deepLinks.reduce<Record<string, typeof deepLinks>>((acc, link) => {
    const page = link.found_in_page || "Unknown";
    if (!acc[page]) acc[page] = [];
    acc[page].push(link);
    return acc;
  }, {});

  const handleReIngest = async () => {
    if (reIngesting) return;
    setReIngesting(true);
    try {
      await reIngestSource(sourceId);
      showToast("Re-ingestion started", "success");
      jobsMutate();
      setActiveTab("jobs");
    } catch {
      showToast("Failed to start re-ingestion", "error");
    } finally {
      setReIngesting(false);
    }
  };

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "jobs", label: "Jobs", count: jobsData?.total },
    { key: "deep-links", label: "Deep Links", count: deepLinks.length },
  ];

  return (
    <div style={{ padding: "24px 32px" }}>
      {/* Back button */}
      <button
        onClick={() => router.push("/sources")}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: 13,
          color: "#7c3aed",
          fontWeight: 600,
          marginBottom: 16,
          padding: 0,
        }}
      >
        <ArrowLeft size={15} /> Back to Sources
      </button>

      {/* Source loading */}
      {sourceLoading && (
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #ede9fe", padding: "24px", marginBottom: 24 }}>
          <div style={{ width: 300, height: 16, background: "#e5e7eb", borderRadius: 4, marginBottom: 12, animation: "pulse 1.5s ease-in-out infinite" }} />
          <div style={{ width: 200, height: 12, background: "#e5e7eb", borderRadius: 4, animation: "pulse 1.5s ease-in-out infinite" }} />
          <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
        </div>
      )}

      {/* Source error */}
      {sourceError && !sourceLoading && (
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #fecaca", padding: "32px 24px", textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 14, color: "#dc2626" }}>Failed to load source.</div>
        </div>
      )}

      {/* Source header card */}
      {source && (
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #ede9fe", padding: "24px", marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 12, color: "#9ca3af", fontFamily: "'DM Mono', monospace", marginBottom: 8, wordBreak: "break-all" }}>
                {source.url}
              </div>
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                <Badge label={source.brand} color="#7c3aed" bg="#f3f0ff" />
                <Badge label={source.region} color="#0891b2" bg="#ecfeff" />
              </div>
              {source.last_ingested_at && (
                <div style={{ fontSize: 12, color: "#9ca3af" }}>
                  Last ingested: {fmtDate(source.last_ingested_at)}
                </div>
              )}
            </div>
            <button
              onClick={handleReIngest}
              disabled={reIngesting}
              style={{
                padding: "10px 20px",
                background: "#7c3aed",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 700,
                cursor: reIngesting ? "default" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                opacity: reIngesting ? 0.6 : 1,
              }}
            >
              <RefreshCw size={14} style={reIngesting ? { animation: "spin 0.8s linear infinite" } : undefined} />
              {reIngesting ? "Starting…" : "Re-Ingest"}
            </button>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Tabs */}
      {source && (
        <>
          <TabSwitcher
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={(key) => setActiveTab(key as SourceTab)}
          />

          {/* ─── Overview Tab ─── */}
          {activeTab === "overview" && (
            <div
              style={{
                background: "#fff",
                borderRadius: 14,
                border: "1px solid #ede9fe",
                padding: "24px",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: 20,
                }}
              >
                {[
                  { label: "Total Jobs", value: source.total_jobs, color: "#7c3aed" },
                  { label: "Completed", value: source.completed_jobs, color: "#16a34a" },
                  { label: "Failed", value: source.failed_jobs, color: "#dc2626" },
                  { label: "Active", value: source.active_jobs, color: "#d97706" },
                  { label: "Total Files", value: source.total_files, color: "#7c3aed" },
                  { label: "Pending Review", value: source.pending_review, color: "#d97706" },
                  { label: "Approved", value: source.approved, color: "#16a34a" },
                  { label: "Rejected", value: source.rejected, color: "#dc2626" },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    style={{
                      padding: "16px",
                      background: "#faf5ff",
                      borderRadius: 12,
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                      {stat.label}
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: stat.color }}>
                      {stat.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Source Files */}
              <div style={{ marginTop: 24 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 12 }}>
                  Files
                </div>
                <DataTable
                  files={filesData?.items ?? []}
                  isLoading={filesLoading}
                  emptyMessage="No files for this source yet."
                  page={filePage}
                  totalPages={filesData?.pages ?? 1}
                  onPageChange={setFilePage}
                  onRowClick={(file) => router.push(`/sources/${sourceId}/files/${file.id}`)}
                  onQuickView={(file) => setSelectedFileId(file.id)}
                />
              </div>
            </div>
          )}

          {/* ─── Jobs Tab ─── */}
          {activeTab === "jobs" && (
            <>
              {/* Jobs loading */}
              {jobsLoading && (
                <>
                  {[1, 2].map((i) => (
                    <div key={i} style={{ background: "#fff", borderRadius: 14, border: "1px solid #ede9fe", padding: "20px 24px", marginBottom: 12 }}>
                      <div style={{ width: 260, height: 14, background: "#e5e7eb", borderRadius: 4, marginBottom: 8, animation: "pulse 1.5s ease-in-out infinite" }} />
                      <div style={{ width: 80, height: 22, background: "#e5e7eb", borderRadius: 12, animation: "pulse 1.5s ease-in-out infinite" }} />
                    </div>
                  ))}
                </>
              )}

              {/* Jobs error */}
              {jobsError && !jobsLoading && (
                <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #fecaca", padding: "32px 24px", textAlign: "center" }}>
                  <div style={{ fontSize: 14, color: "#dc2626", marginBottom: 12 }}>Failed to load jobs.</div>
                  <button onClick={() => jobsMutate()} style={{ padding: "8px 20px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    Retry
                  </button>
                </div>
              )}

              {/* Job cards */}
              {!jobsLoading && !jobsError && jobsData?.items.map((j) => {
                const jc = JOB_STATUS_CONFIG[j.status] || { label: j.status, color: "#6b7280", bg: "#f3f4f6" };
                return (
                  <div key={j.id} style={{ background: "#fff", borderRadius: 14, border: "1px solid #ede9fe", padding: "20px 24px", marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 12, color: "#9ca3af", fontFamily: "'DM Mono', monospace", marginBottom: 4 }}>
                          {j.source_url}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Badge label={jc.label} color={jc.color} bg={jc.bg} />
                          {j.status === "in_progress" && (
                            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#7c3aed", animation: "pulse 2s infinite" }} />
                          )}
                          {j.max_depth > 0 && (
                            <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 500 }}>
                              {j.pages_crawled} page{j.pages_crawled !== 1 ? "s" : ""} crawled
                              {j.status === "in_progress"
                                ? ` (depth ${j.current_depth}/${j.max_depth})`
                                : ` (depth ${j.max_depth})`}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <button
                          onClick={() => openLogs(j)}
                          style={{
                            padding: "6px 14px",
                            background: "#f3f0ff",
                            border: "1px solid #ede9fe",
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 600,
                            color: "#7c3aed",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                            transition: "background 0.15s",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#ede9fe")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "#f3f0ff")}
                        >
                          <Eye size={13} /> View Progress
                        </button>
                        <div style={{ fontSize: 12, color: "#9ca3af" }}>{fmtDate(j.started_at)}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                      {METRIC_KEYS.map(({ label, key }) => (
                        <div key={key}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
                          <div style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>{j[key] as number}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Empty jobs */}
              {!jobsLoading && !jobsError && jobsData && jobsData.items.length === 0 && (
                <div style={{ textAlign: "center", padding: "32px 24px", color: "#9ca3af", fontSize: 14 }}>
                  No ingestion jobs for this source yet.
                </div>
              )}

              {/* Jobs pagination */}
              {!jobsLoading && !jobsError && jobsData && jobsData.pages > 1 && (
                <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
                  <button
                    disabled={jobPage <= 1}
                    onClick={() => setJobPage(jobPage - 1)}
                    style={{ padding: "6px 14px", border: "1px solid #e5e7eb", borderRadius: 8, background: "#fff", fontSize: 13, cursor: jobPage <= 1 ? "default" : "pointer", opacity: jobPage <= 1 ? 0.4 : 1 }}
                  >
                    Previous
                  </button>
                  <span style={{ padding: "6px 10px", fontSize: 13, color: "#6b7280" }}>
                    Page {jobsData.page} of {jobsData.pages}
                  </span>
                  <button
                    disabled={jobPage >= jobsData.pages}
                    onClick={() => setJobPage(jobPage + 1)}
                    style={{ padding: "6px 14px", border: "1px solid #e5e7eb", borderRadius: 8, background: "#fff", fontSize: 13, cursor: jobPage >= jobsData.pages ? "default" : "pointer", opacity: jobPage >= jobsData.pages ? 0.4 : 1 }}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}

          {/* ─── Deep Links Tab ─── */}
          {activeTab === "deep-links" && (
            <>
              {linksLoading && (
                <div style={{ textAlign: "center", padding: "32px 24px", color: "#9ca3af", fontSize: 14 }}>
                  Loading deep links...
                </div>
              )}

              {!linksLoading && deepLinks.length === 0 && (
                <div style={{ textAlign: "center", padding: "32px 24px", color: "#9ca3af", fontSize: 14 }}>
                  No deep links discovered for this source yet.
                </div>
              )}

              {!linksLoading && deepLinks.length > 0 && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                      <Link2 size={16} />
                      {deepLinks.length} link{deepLinks.length !== 1 ? "s" : ""} discovered
                    </h3>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={toggleAllLinks}
                        style={{ padding: "6px 14px", background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "#374151", cursor: "pointer" }}
                      >
                        {selectedLinks.size === deepLinks.length ? "Deselect All" : "Select All"}
                      </button>
                      <button
                        onClick={handleConfirmLinks}
                        disabled={confirmingLinks || selectedLinks.size === 0}
                        style={{
                          padding: "6px 14px",
                          background: selectedLinks.size > 0 ? "#16a34a" : "#d1d5db",
                          color: "#fff",
                          border: "none",
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: selectedLinks.size > 0 ? "pointer" : "default",
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        <Check size={13} /> Ingest Selected ({selectedLinks.size})
                      </button>
                      <button
                        onClick={handleDismissLinks}
                        disabled={dismissingLinks || selectedLinks.size === 0}
                        style={{
                          padding: "6px 14px",
                          background: selectedLinks.size > 0 ? "#dc2626" : "#d1d5db",
                          color: "#fff",
                          border: "none",
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: selectedLinks.size > 0 ? "pointer" : "default",
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        <XIcon size={13} /> Dismiss ({selectedLinks.size})
                      </button>
                    </div>
                  </div>

                  {Object.entries(linksByPage).map(([page, links]) => (
                    <div key={page} style={{ background: "#fff", borderRadius: 14, border: "1px solid #ede9fe", padding: "16px 20px", marginBottom: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                        Found in: {page}
                      </div>
                      {links.map((link) => (
                        <label
                          key={link.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "8px 10px",
                            borderRadius: 8,
                            cursor: "pointer",
                            transition: "background 0.1s",
                            background: selectedLinks.has(link.id) ? "#f3f0ff" : "transparent",
                          }}
                          onMouseEnter={(e) => { if (!selectedLinks.has(link.id)) e.currentTarget.style.background = "#f9fafb"; }}
                          onMouseLeave={(e) => { if (!selectedLinks.has(link.id)) e.currentTarget.style.background = "transparent"; }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedLinks.has(link.id)}
                            onChange={() => toggleLink(link.id)}
                            style={{ accentColor: "#7c3aed", width: 16, height: 16 }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
                              {link.anchor_text || link.url}
                            </div>
                            {link.anchor_text && (
                              <div style={{ fontSize: 11, color: "#9ca3af", fontFamily: "'DM Mono', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {link.url}
                              </div>
                            )}
                          </div>
                          {link.found_in_node && (
                            <span style={{ fontSize: 10, color: "#6b7280", background: "#f3f4f6", borderRadius: 6, padding: "2px 8px", whiteSpace: "nowrap" }}>
                              {link.found_in_node}
                            </span>
                          )}
                        </label>
                      ))}
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </>
      )}

      {/* File Detail Modal */}
      {selectedFileId && (
        <FileModal
          fileId={selectedFileId}
          source="files"
          onClose={() => setSelectedFileId(null)}
        />
      )}

      {/* Agentic Task View Modal */}
      {viewingJobId && (
        <AgenticTaskView
          jobId={viewingJobId}
          sourceUrl={viewingSourceUrl}
          status={stream.status}
          currentStage={stream.currentStage}
          progress={stream.progress}
          urlTasks={stream.urlTasks}
          logs={stream.logs}
          summary={stream.summary}
          error={stream.error}
          startedAt={stream.startedAt}
          activeToolCall={stream.activeToolCall}
          onClose={closeLogs}
        />
      )}

      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  );
}
