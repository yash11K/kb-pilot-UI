"use client";

import { Search, Layers, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";

interface FilterBarProps {
  activeTab: "queue" | "files";
  filters: {
    search?: string;
    region?: string;
    brand?: string;
    content_type?: string;
    status?: string;
  };
  onFilterChange: (key: string, value: string) => void;
  onSearch: (value: string) => void;
  onSpeedReview?: () => void;
  pendingCount?: number;
  showStatusFilter?: boolean;
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          appearance: "none",
          background: "#fff",
          border: "1.5px solid #e5e7eb",
          borderRadius: 9,
          padding: "7px 32px 7px 12px",
          fontSize: 13,
          fontWeight: 500,
          color: "#374151",
          cursor: "pointer",
          fontFamily: "inherit",
          outline: "none",
        }}
      >
        <option value="">{label}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        color="#9ca3af"
        style={{
          position: "absolute",
          right: 10,
          top: "50%",
          transform: "translateY(-50%)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

export default function FilterBar({
  activeTab,
  filters,
  onFilterChange,
  onSearch,
  onSpeedReview,
  pendingCount,
  showStatusFilter,
}: FilterBarProps) {
  const router = useRouter();

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 14,
        flexWrap: "wrap",
        gap: 12,
      }}
    >
      {/* Left side: tabs + speed review */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button
          onClick={() => router.push("/queue")}
          style={{
            padding: "8px 18px",
            borderRadius: 10,
            background: activeTab === "queue" ? "#7c3aed" : "#fff",
            color: activeTab === "queue" ? "#fff" : "#6b7280",
            border: activeTab === "queue" ? "none" : "1.5px solid #e5e7eb",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Review Queue
        </button>
        <button
          onClick={() => router.push("/files")}
          style={{
            padding: "8px 18px",
            borderRadius: 10,
            background: activeTab === "files" ? "#7c3aed" : "#fff",
            color: activeTab === "files" ? "#fff" : "#6b7280",
            border: activeTab === "files" ? "none" : "1.5px solid #e5e7eb",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          All Files
        </button>
        {onSpeedReview && (pendingCount ?? 0) > 0 && (
          <button
            onClick={onSpeedReview}
            style={{
              padding: "8px 18px",
              borderRadius: 10,
              marginLeft: 4,
              background: "linear-gradient(135deg, #7c3aed, #a78bfa)",
              color: "#fff",
              border: "none",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              gap: 7,
              boxShadow: "0 2px 10px rgba(124,58,237,0.3)",
            }}
          >
            <Layers size={14} />
            Speed Review
            <span
              style={{
                background: "rgba(255,255,255,0.25)",
                padding: "1px 8px",
                borderRadius: 8,
                fontSize: 11,
              }}
            >
              {pendingCount}
            </span>
          </button>
        )}
      </div>

      {/* Right side: search + filter dropdowns */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{ position: "relative" }}>
          <input
            value={filters.search || ""}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search files..."
            style={{
              padding: "7px 12px 7px 34px",
              border: "1.5px solid #e5e7eb",
              borderRadius: 9,
              fontSize: 13,
              outline: "none",
              fontFamily: "inherit",
              width: 200,
            }}
          />
          <Search
            size={14}
            color="#9ca3af"
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
            }}
          />
        </div>
        <FilterSelect
          label="Region"
          value={filters.region || ""}
          onChange={(v) => onFilterChange("region", v)}
          options={["US", "EU", "APAC", "LATAM"]}
        />
        <FilterSelect
          label="Brand"
          value={filters.brand || ""}
          onChange={(v) => onFilterChange("brand", v)}
          options={["Avis", "Budget"]}
        />
        <FilterSelect
          label="Type"
          value={filters.content_type || ""}
          onChange={(v) => onFilterChange("content_type", v)}
          options={[
            "faq",
            "terms_and_conditions",
            "policy",
            "general_info",
            "announcement",
            "other",
          ]}
        />
        {showStatusFilter && (
          <FilterSelect
            label="Status"
            value={filters.status || ""}
            onChange={(v) => onFilterChange("status", v)}
            options={[
              "pending_review",
              "approved",
              "in_s3",
              "auto_rejected",
              "rejected",
            ]}
          />
        )}
      </div>
    </div>
  );
}
