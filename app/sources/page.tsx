"use client";

import { useState, useCallback } from "react";
import { Upload, RefreshCw } from "lucide-react";
import { useSources } from "@/hooks/useSources";
import { useActiveJobs } from "@/hooks/useActiveJobs";
import SourcesTable from "@/components/SourcesTable";
import IngestWizard from "@/components/IngestWizard";

export default function SourcesPage() {
  const [page, setPage] = useState(1);
  const [regionFilter, setRegionFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [showIngest, setShowIngest] = useState(false);
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

      {/* Sources table */}
      {!error && (
        <SourcesTable
          sources={data?.items ?? []}
          activeJobs={activeJobs}
          isLoading={isLoading}
          page={data?.page ?? page}
          totalPages={data?.pages ?? 1}
          onPageChange={handlePageChange}
        />
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
