"use client";

import { Suspense, useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useSWRConfig } from "swr";
import { RotateCw } from "lucide-react";
import StatsStrip from "@/components/StatsStrip";
import FilterBar from "@/components/FilterBar";
import DataTable from "@/components/DataTable";
import FileModal from "@/components/FileModal";
import { useAllFiles } from "@/hooks/useAllFiles";
import { useRevalidationJob } from "@/hooks/useRevalidationJob";
import { batchRevalidate } from "@/lib/api";
import { useToast } from "@/components/Toast";
import type { FileFilters, FileStatus } from "@/lib/types";

function FilesPageContent() {
  const searchParams = useSearchParams();
  const initialStatus = (searchParams.get("status") as FileStatus) || "";
  const { mutate: globalMutate } = useSWRConfig();
  const { showToast } = useToast();

  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchJobId, setBatchJobId] = useState<string | null>(null);
  const [filters, setFilters] = useState<FileFilters>({
    search: "",
    region: "",
    brand: "",
    content_type: "",
    status: initialStatus || undefined,
    page: 1,
    size: 20,
    sort_by: "",
    sort_order: undefined,
  });

  const { data, isLoading, error, mutate } = useAllFiles(filters);
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
    globalMutate(
      (key: string) =>
        typeof key === "string" &&
        (key.startsWith("files:") ||
          key.startsWith("file-detail:") ||
          key === "stats"),
    );
  }, [revalJob, globalMutate, showToast]);

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

  const handleFilterChange = useCallback((key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value || undefined, page: 1 }));
  }, []);

  const handleSearch = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, search: value, page: 1 }));
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  }, []);

  return (
    <>
      {/* StatsStrip */}
      <div style={{ padding: "24px 32px 0" }}>
        <StatsStrip />
      </div>

      {/* FilterBar */}
      <div style={{ padding: "20px 32px 0" }}>
        <FilterBar
          activeTab="files"
          filters={filters}
          onFilterChange={handleFilterChange}
          onSearch={handleSearch}
          showStatusFilter={true}
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
              onClick={() => mutate()}
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
            swipeable={false}
            selectable={true}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            onRowClick={(file) => setSelectedFileId(file.id)}
            isLoading={isLoading}
            page={data?.page || 1}
            totalPages={data?.pages || 1}
            onPageChange={handlePageChange}
          />
        </div>
      )}

      {/* FileModal */}
      {selectedFileId && (
        <FileModal
          fileId={selectedFileId}
          source="files"
          onClose={() => setSelectedFileId(null)}
        />
      )}
    </>
  );
}

export default function FilesPage() {
  return (
    <Suspense fallback={<div style={{ padding: "24px 32px" }}>Loading...</div>}>
      <FilesPageContent />
    </Suspense>
  );
}
