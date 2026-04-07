"use client";

import { ValidationBreakdown, dimensionColor } from "@/lib/types";

interface ScoreBreakdownProps {
  breakdown: ValidationBreakdown;
}

const items = [
  { label: "Metadata", key: "metadata_completeness" as const },
  { label: "Semantic", key: "semantic_quality" as const },
  { label: "Uniqueness", key: "uniqueness" as const },
];

const MAX = 10;

export default function ScoreBreakdown({ breakdown }: ScoreBreakdownProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map(({ label, key }) => {
        const val = breakdown?.[key] ?? 0;
        const color = dimensionColor(val);
        return (
          <div key={key}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#4b5563" }}>{label}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color, fontFamily: "'DM Mono', monospace" }}>
                {Math.round(val)}
                <span style={{ color: "#9ca3af", fontWeight: 400 }}> / {MAX}</span>
              </span>
            </div>
            <div style={{ height: 6, background: "#f3f4f6", borderRadius: 3, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  borderRadius: 3,
                  background: color,
                  transition: "width 0.5s ease",
                  width: `${(val / MAX) * 100}%`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
