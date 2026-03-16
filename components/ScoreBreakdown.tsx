"use client";

import { ValidationBreakdown } from "@/lib/types";

interface ScoreBreakdownProps {
  breakdown: ValidationBreakdown;
}

const items = [
  { label: "Metadata Completeness", key: "metadata_completeness" as const, max: 0.3, color: "#7c3aed" },
  { label: "Semantic Quality", key: "semantic_quality" as const, max: 0.5, color: "#0891b2" },
  { label: "Uniqueness", key: "uniqueness" as const, max: 0.2, color: "#16a34a" },
];

export default function ScoreBreakdown({ breakdown }: ScoreBreakdownProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map(({ label, key, max, color }) => (
        <div key={key}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#4b5563" }}>{label}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color, fontFamily: "'DM Mono', monospace" }}>
              {((breakdown?.[key] || 0) * 100).toFixed(0)}%
              <span style={{ color: "#9ca3af", fontWeight: 400 }}> / {(max * 100).toFixed(0)}%</span>
            </span>
          </div>
          <div style={{ height: 6, background: "#f3f4f6", borderRadius: 3, overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                borderRadius: 3,
                background: color,
                transition: "width 0.5s ease",
                width: `${((breakdown?.[key] || 0) / max) * 100}%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
