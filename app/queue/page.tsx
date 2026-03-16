"use client";

import { Suspense, useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useSWRConfig } from "swr";
import { RotateCw } from "lucide-react";
import StatsStrip from "@/components/StatsStrip";
import FilterBar from "@/components/FilterBar";
import DataTable from "@/components/DataTable";
import SpeedReview from "@/components/SpeedReview";
import FileModal from "@/components/FileModal";
import { useQueueFiles } from "@/hooks/useQueueFiles";
import { useStats } from "@/hooks/useStats";
import { useRevalidationJob } from "@/hooks/useRevalidationJob";
import { acceptFile, rejectFile, batchRevalidate } from "@/lib/api";
import { useToast } from "@/components/Toast";
import type { QueueFilters } from "@/lib/types";

function QueuePageContent() {
  const searchParams = useSearchParams();
  const { mutate } = useSWRConfig();
  const { showToast } = useToast();
  const { data: stats } = useStats();

  const [speedMode, setSpeedMode] = useState(
    searchParams.get("mode") === "speed"
  );
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchJobId, setBatchJobId] = useState<string | null>(null);
  const [filters, setFilters] = useState<QueueFilters>({
    search: "",
    region: "",
    brand: "",
    content_type: "",
    page: 1,
    size: 20,
    sort_by: "",
    sort_order: undefined,
  });

  const { data, isLoading, error, mutate: queueMutate } = useQueueFiles(filters);
  const { data: revalJob } = useRevalidationJob(batchJobId);

  // When batch job completes, invalidate caches and clear state
  useEffect(() => {
    if (!revalJob || revalJob.status === "in_progress") return;
    const done = revalJob.status === "completed";
    const summary = done
      ? `Revalidation complete — ${revalJob.completed} updated, ${revalJob.failed} failed, ${revalJob.not_found} not found`
      : `Revalidation failed${revalJob.error_message ? `: ${revalJob.error_message}` : ""}`;
    showToast(summary, done ? "success" : "error");
    setBatchJobId(null);
    setSelectedIds(new Set());
    mutate(
      (key: unknown) =>
        typeof key === "string" &&
        (key.startsWith("queue:") ||
          key.startsWith("file-detail:") ||
          key === "stats"),
    );
  }, [revalJob, mutate, showToast]);

  const handleBatchRevalidate = useCallback(async () => {
    if (selectedIds.size === 0) return;
    try {
      const res = await batchRevalidate(Array.from(selectedIds));
      setBatchJobId(res.job_id);
      showToast(`Revalidating ${selectedIds.size} file(s)…`, "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Batch revalidation failed";
      showToast(msg, "error");
    }
  }, [selectedIds, showToast]);

  const reviewer =
    process.env.NEXT_PUBLIC_REVIEWER_EMAIL || "reviewer@example.com";

  const handleAccept = useCallback(
    async (fileId: string) => {
      const optimisticData = data
        ? {
            ...data,
            items: data.items.filter((f) => f.id !== fileId),
            total: data.total - 1,
          }
        : undefined;

      try {
        await queueMutate(
          async () => {
            await acceptFile(fileId, reviewer);
            return undefined as unknown as typeof data;
          },
          {
            optimisticData,
            rollbackOnError: true,
            revalidate: true,
          }
        );
        await mutate(
          (key: unknown) => typeof key === "string" && key === "stats"
        );
        showToast("File accepted → S3 upload queued", "success");
      } catch {
        showToast("Failed to accept file. Please try again.", "error");
      }
    },
    [data, reviewer, queueMutate, mutate, showToast]
  );

  const handleReject = useCallback(
    async (fileId: string) => {
      const optimisticData = data
        ? {
            ...data,
            items: data.items.filter((f) => f.id !== fileId),
            total: data.total - 1,
          }
        : undefined;

      try {
        await queueMutate(
          async () => {
            await rejectFile(fileId, reviewer, "Rejected via swipe");
            return undefined as unknown as typeof data;
          },
          {
            optimisticData,
            rollbackOnError: true,
            revalidate: true,
          }
        );
        await mutate(
          (key: unknown) => typeof key === "string" && key === "stats"
        );
        showToast("File rejected", "error");
      } catch {
        showToast("Failed to reject file. Please try again.", "error");
      }
    },
    [data, reviewer, queueMutate, mutate, showToast]
  );

  const handleFilterChange = useCallback((key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  }, []);

  const handleSearch = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, search: value, page: 1 }));
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  }, []);

  const hasActiveFilters = !!(filters.search || filters.region || filters.brand || filters.content_type);
  const hasItems = (data?.items?.length ?? 0) > 0;

  return (
    <>
      {/* StatsStrip */}
      <div style={{ padding: "24px 32px 0" }}>
        <StatsStrip />
      </div>

      {speedMode ? (
        <SpeedReview
          onExit={() => setSpeedMode(false)}
          onDetail={(file) => setSelectedFileId(file.id)}
        />
      ) : (
        <>
          {/* FilterBar */}
          <div style={{ padding: "20px 32px 0" }}>
            <FilterBar
              activeTab="queue"
              filters={filters}
              onFilterChange={handleFilterChange}
              onSearch={handleSearch}
              onSpeedReview={() => setSpeedMode(true)}
              pendingCount={stats?.pending_review}
            />
          </div>

          {/* Selection action bar */}
          {selectedIds.size > 0 && !batchJobId && (
            <div style={{ padding: "0 32px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 16px",
                  background: "#f3f0ff",
                  borderRadius: 10,
                  marginBottom: 10,
                  fontSize: 13,
                  color: "#7c3aed",
                }}
              >
                <span style={{ fontWeight: 600 }}>
                  {selectedIds.size} file{selectedIds.size !== 1 ? "s" : ""} selected
                </span>
                <button
                  onClick={handleBatchRevalidate}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 14px",
                    background: "#7c3aed",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <RotateCw size={13} />
                  Revalidate Selected
                </button>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  style={{
                    padding: "6px 14px",
                    background: "transparent",
                    color: "#7c3aed",
                    border: "1px solid #ddd6fe",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Batch revalidation progress */}
          {batchJobId && revalJob && revalJob.status === "in_progress" && (
            <div style={{ padding: "0 32px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 16px",
                  background: "#f3f0ff",
                  borderRadius: 10,
                  marginBottom: 10,
                  fontSize: 13,
                  color: "#7c3aed",
                }}
              >
                <RotateCw
                  size={14}
                  style={{ animation: "spin 0.8s linear infinite" }}
                />
                <span style={{ fontWeight: 600 }}>
                  Revalidating… {revalJob.completed + revalJob.failed + revalJob.not_found}/{revalJob.total_files}
                </span>
                <div
                  style={{
                    flex: 1,
                    height: 4,
                    background: "#e5e7eb",
                    borderRadius: 2,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      background: "#7c3aed",
                      borderRadius: 2,
                      width: `${revalJob.total_files > 0 ? ((revalJob.completed + revalJob.failed + revalJob.not_found) / revalJob.total_files) * 100 : 0}%`,
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>
              </div>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* Swipe hint banner */}
          {hasItems && (
            <div style={{ padding: "0 32px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 14px",
                  background: "#faf5ff",
                  borderRadius: 10,
                  marginBottom: 10,
                  fontSize: 12,
                  color: "#7c3aed",
                }}
              >
                💡 Swipe rows right to accept, left to reject — or try Speed
                Review for card-based triage.
              </div>
            </div>
          )}

          {/* Error state */}
          {error && !isLoading && (
            <div style={{ padding: "0 32px 32px", flex: 1 }}>
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
                  onClick={() => queueMutate()}
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
          )}

          {/* DataTable */}
          {!error && (
            <div style={{ padding: "0 32px 32px", flex: 1 }}>
              <DataTable
                files={data?.items || []}
                swipeable={true}
                selectable={true}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                onRowClick={(file) => setSelectedFileId(file.id)}
                onAccept={handleAccept}
                onReject={handleReject}
                isLoading={isLoading}
                emptyMessage={hasActiveFilters ? "No files match the current filters." : "No files pending review."}
                page={data?.page || 1}
                totalPages={data?.pages || 1}
                onPageChange={handlePageChange}
                hideStatus
              />
            </div>
          )}
        </>
      )}

      {/* FileModal */}
      {selectedFileId && (
        <FileModal
          fileId={selectedFileId}
          source="queue"
          onClose={() => setSelectedFileId(null)}
        />
      )}
    </>
  );
}

export default function QueuePage() {
  return (
    <Suspense fallback={<div style={{ padding: "24px 32px" }}>Loading...</div>}>
      <QueuePageContent />
    </Suspense>
  );
}
