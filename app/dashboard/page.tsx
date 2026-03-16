"use client";

import { useState } from "react";
import Link from "next/link";
import StatsStrip from "@/components/StatsStrip";
import { useStats } from "@/hooks/useStats";
import { useRouter } from "next/navigation";
import { Layers, Inbox, Upload, File } from "lucide-react";
import { useActiveJobs } from "@/hooks/useActiveJobs";
import { useSources } from "@/hooks/useSources";
import IngestWizard from "@/components/IngestWizard";

export default function DashboardPage() {
  const { data: stats } = useStats();
  const router = useRouter();
  const [showIngestWizard, setShowIngestWizard] = useState(false);
  const { activeJobs, mutate: activeJobsMutate } = useActiveJobs();
  const { data: recentSources } = useSources({ page: 1, size: 5 });

  const pending = stats?.pending_review ?? 0;
  const total = stats?.total_files ?? 0;

  return (
    <>
      <div style={{ padding: "24px 32px 0" }}>
        <StatsStrip />
      </div>

      <div style={{ padding: "24px 32px" }}>
        <h1
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: "#111827",
            marginBottom: 8,
          }}
        >
          Welcome to KB Manager
        </h1>
        <p
          style={{
            color: "#6b7280",
            fontSize: 14,
            marginBottom: 24,
          }}
        >
          Monitor your AEM knowledge base ingestion pipeline.
        </p>

        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            border: "1px solid #ede9fe",
            padding: 24,
          }}
        >
          <h2
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "#4b5563",
              marginBottom: 12,
            }}
          >
            Quick Actions
          </h2>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {/* Speed Review */}
            <button
              onClick={() => router.push("/queue?mode=speed")}
              style={{
                padding: "14px 20px",
                borderRadius: 12,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 13,
                fontWeight: 600,
                background: "linear-gradient(135deg, #7c3aed, #a78bfa)",
                color: "#fff",
                border: "none",
                boxShadow: "0 2px 10px rgba(124,58,237,0.3)",
              }}
            >
              <Layers size={16} />
              Speed Review
              {pending > 0 && (
                <span
                  style={{
                    background: "rgba(255,255,255,0.25)",
                    borderRadius: 10,
                    padding: "1px 8px",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {pending}
                </span>
              )}
            </button>

            {/* Review Queue */}
            <button
              onClick={() => router.push("/queue")}
              style={{
                padding: "14px 20px",
                borderRadius: 12,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 13,
                fontWeight: 600,
                background: "#faf5ff",
                border: "1.5px solid #ede9fe",
                color: "#7c3aed",
              }}
            >
              <Inbox size={16} />
              Review Queue
              {pending > 0 && (
                <span
                  style={{
                    background: "#7c3aed",
                    color: "#fff",
                    borderRadius: 10,
                    padding: "1px 8px",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {pending}
                </span>
              )}
            </button>

            {/* New Ingestion */}
            <button
              onClick={() => setShowIngestWizard(true)}
              style={{
                padding: "14px 20px",
                borderRadius: 12,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 13,
                fontWeight: 600,
                background: "#faf5ff",
                border: "1.5px solid #ede9fe",
                color: "#7c3aed",
              }}
            >
              <Upload size={16} />
              New Ingestion
            </button>

            {/* All Files */}
            <button
              onClick={() => router.push("/files")}
              style={{
                padding: "14px 20px",
                borderRadius: 12,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 13,
                fontWeight: 600,
                background: "#faf5ff",
                border: "1.5px solid #ede9fe",
                color: "#7c3aed",
              }}
            >
              <File size={16} />
              All Files
              {total > 0 && (
                <span
                  style={{
                    background: "#7c3aed",
                    color: "#fff",
                    borderRadius: 10,
                    padding: "1px 8px",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {total}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
      {/* Recent Activity */}
      <div style={{ padding: "0 32px 24px" }}>
        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            border: "1px solid #ede9fe",
            padding: 24,
          }}
        >
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#4b5563", marginBottom: 12 }}>
            Recent Activity
          </h2>

          {recentSources?.items.length === 0 && (
            <div style={{ fontSize: 13, color: "#9ca3af", padding: "12px 0" }}>
              No sources yet. Start by ingesting some content.
            </div>
          )}

          {recentSources?.items.map((s) => {
            const isActive = !!activeJobs[s.id];
            return (
              <Link
                key={s.id}
                href={`/sources/${s.id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 12px",
                  borderRadius: 10,
                  textDecoration: "none",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#faf5ff")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {/* Status dot */}
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: isActive ? "#7c3aed" : "#16a34a",
                    flexShrink: 0,
                    animation: isActive ? "pulse 1.5s ease-in-out infinite" : undefined,
                  }}
                />

                {/* Label */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
                    {s.nav_label || s.url}
                  </div>
                  {s.nav_label && (
                    <div style={{ fontSize: 11, color: "#9ca3af", fontFamily: "'DM Mono', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.url}
                    </div>
                  )}
                </div>

                {/* Status text */}
                <div style={{ fontSize: 12, color: isActive ? "#7c3aed" : "#9ca3af", whiteSpace: "nowrap", fontWeight: isActive ? 600 : 400 }}>
                  {isActive
                    ? "Processing..."
                    : s.last_ingested_at
                      ? new Date(s.last_ingested_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                      : "Never ingested"}
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {showIngestWizard && (
        <IngestWizard
          onClose={() => setShowIngestWizard(false)}
          onComplete={() => activeJobsMutate()}
        />
      )}
    </>
  );
}
