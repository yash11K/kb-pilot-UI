"use client";

import { useState, useCallback } from "react";
import { Upload, RefreshCw } from "lucide-react";
import { useSources } from "@/hooks/useSources";
import { useActiveJobs } from "@/hooks/useActiveJobs";
import SourceCard from "@/components/SourceCard";
import IngestWizard from "@/components/IngestWizard";

export default function SourcesPage() {
  const [page, setPage] = useState(1);
  const [regionFilter, setRegionFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [showIngest, setShowIngest] = useState(false);
  const [previewSourceId, setPreviewSourceId] = useState<string | null>(null);

  const { activeJobs, mutate: activeJobsMutate } = useActiveJobs();
  const { data, isLoading, error, mutate } = useSources({
    region: regionFilter || undefined,
    brand: brandFilter || undefined,
    page,
    size: 20,
  });

  const handlePageChange = useCallback((p: number) => setPage(p), []);

  return (
    <div style={{ padding: "24px 32px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: 0 }}>
          Sources
        </h2>
        <button
          onClick={() => setShowIngest(true)}
          style={{
            padding: "10px 20px",
            background: "#7c3aed",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Upload size={15} /> New Ingestion
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <select
          value={regionFilter}
          onChange={(e) => { setRegionFilter(e.target.value); setPage(1); }}
          style={{
            padding: "8px 12px",
            border: "1.5px solid #e5e7eb",
            borderRadius: 8,
            fontSize: 13,
            fontFamily: "inherit",
            background: "#fff",
          }}
        >
          <option value="">All Regions</option>
          {["US", "EU", "APAC", "LATAM"].map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <input
          value={brandFilter}
          onChange={(e) => { setBrandFilter(e.target.value); setPage(1); }}
          placeholder="Filter by brand…"
          style={{
            padding: "8px 12px",
            border: "1.5px solid #e5e7eb",
            borderRadius: 8,
            fontSize: 13,
            fontFamily: "inherit",
            width: 180,
          }}
        />
        <button
          onClick={() => mutate()}
          style={{
            padding: "8px 12px",
            background: "#f3f0ff",
            border: "1px solid #ede9fe",
            borderRadius: 8,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            fontWeight: 600,
            color: "#7c3aed",
          }}
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                background: "#fff",
                borderRadius: 14,
                border: "1px solid #ede9fe",
                padding: "20px 24px",
                marginBottom: 12,
              }}
            >
              <div style={{ width: 300, height: 14, background: "#e5e7eb", borderRadius: 4, marginBottom: 10, animation: "pulse 1.5s ease-in-out infinite" }} />
              <div style={{ width: 120, height: 22, background: "#e5e7eb", borderRadius: 12, animation: "pulse 1.5s ease-in-out infinite" }} />
            </div>
          ))}
          <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
        </>
      )}

      {/* Error */}
      {error && !isLoading && (
        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            border: "1px solid #fecaca",
            padding: "32px 24px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 14, color: "#dc2626", marginBottom: 12 }}>Failed to load sources.</div>
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
      )}

      {/* Source cards */}
      {!isLoading && !error && data?.items.map((s) => (
        <SourceCard
          key={s.id}
          source={s}
          activeJobId={activeJobs[s.id] || null}
          isPreviewOpen={previewSourceId === s.id}
          onTogglePreview={() =>
            setPreviewSourceId((prev) => (prev === s.id ? null : s.id))
          }
        />
      ))}

      {/* Empty */}
      {!isLoading && !error && data && data.items.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 24px", color: "#9ca3af", fontSize: 14 }}>
          No sources found.
        </div>
      )}

      {/* Pagination */}
      {!isLoading && !error && data && data.pages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
          <button
            disabled={page <= 1}
            onClick={() => handlePageChange(page - 1)}
            style={{
              padding: "6px 14px",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              background: "#fff",
              fontSize: 13,
              cursor: page <= 1 ? "default" : "pointer",
              opacity: page <= 1 ? 0.4 : 1,
            }}
          >
            Previous
          </button>
          <span style={{ padding: "6px 10px", fontSize: 13, color: "#6b7280" }}>
            Page {data.page} of {data.pages}
          </span>
          <button
            disabled={page >= data.pages}
            onClick={() => handlePageChange(page + 1)}
            style={{
              padding: "6px 14px",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              background: "#fff",
              fontSize: 13,
              cursor: page >= data.pages ? "default" : "pointer",
              opacity: page >= data.pages ? 0.4 : 1,
            }}
          >
            Next
          </button>
        </div>
      )}

      {showIngest && (
        <IngestWizard
          onClose={() => setShowIngest(false)}
          onComplete={() => {
            mutate();
            activeJobsMutate();
          }}
        />
      )}
    </div>
  );
}
