"use client";

import { useState } from "react";
import Link from "next/link";
import StatsStrip from "@/components/StatsStrip";
import { useStats } from "@/hooks/useStats";
import { useRouter } from "next/navigation";
import { Layers, Inbox, Upload, File, Zap, ArrowRight, Link2 } from "lucide-react";
import { useActiveJobs } from "@/hooks/useActiveJobs";
import { useSources } from "@/hooks/useSources";
import { useDiscoveryLinks } from "@/hooks/useDiscoveryLinks";
import IngestWizard from "@/components/IngestWizard";

export default function DashboardPage() {
  const { data: stats } = useStats();
  const router = useRouter();
  const [showIngestWizard, setShowIngestWizard] = useState(false);
  const { activeJobs, mutate: activeJobsMutate } = useActiveJobs();
  const { data: recentSources } = useSources({ page: 1, size: 5 });
  const { data: pendingLinks } = useDiscoveryLinks("pending");

  const pending = stats?.pending_review ?? 0;
  const total = stats?.total_files ?? 0;
  const activeJobEntries = Object.entries(activeJobs);
  const pendingLinkCount = pendingLinks?.length ?? 0;

  return (
    <>
      <div style={{ padding: "24px 32px 0" }}>
        <StatsStrip />
      </div>

      <div style={{ padding: "24px 32px" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111827", marginBottom: 8 }}>
          Welcome to KB Manager
        </h1>
        <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 24 }}>
          Monitor your AEM knowledge base ingestion pipeline.
        </p>

        {/* Quick Actions */}
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #ede9fe", padding: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#4b5563", marginBottom: 12 }}>
            Quick Actions
          </h2>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button
              onClick={() => router.push("/files?tab=pending&mode=speed")}
              style={{
                padding: "14px 20px", borderRadius: 12, cursor: "pointer", display: "flex",
                alignItems: "center", gap: 10, fontSize: 13, fontWeight: 600,
                background: "linear-gradient(135deg, #7c3aed, #a78bfa)", color: "#fff",
                border: "none", boxShadow: "0 2px 10px rgba(124,58,237,0.3)",
              }}
            >
              <Layers size={16} /> Speed Review
              {pending > 0 && (
                <span style={{ background: "rgba(255,255,255,0.25)", borderRadius: 10, padding: "1px 8px", fontSize: 11, fontWeight: 700 }}>
                  {pending}
                </span>
              )}
            </button>
            <button
              onClick={() => router.push("/files?tab=pending")}
              style={{
                padding: "14px 20px", borderRadius: 12, cursor: "pointer", display: "flex",
                alignItems: "center", gap: 10, fontSize: 13, fontWeight: 600,
                background: "#faf5ff", border: "1.5px solid #ede9fe", color: "#7c3aed",
              }}
            >
              <Inbox size={16} /> Pending Review
              {pending > 0 && (
                <span style={{ background: "#7c3aed", color: "#fff", borderRadius: 10, padding: "1px 8px", fontSize: 11, fontWeight: 700 }}>
                  {pending}
                </span>
              )}
            </button>
            <button
              onClick={() => setShowIngestWizard(true)}
              style={{
                padding: "14px 20px", borderRadius: 12, cursor: "pointer", display: "flex",
                alignItems: "center", gap: 10, fontSize: 13, fontWeight: 600,
                background: "#faf5ff", border: "1.5px solid #ede9fe", color: "#7c3aed",
              }}
            >
              <Upload size={16} /> New Ingestion
            </button>
            <button
              onClick={() => router.push("/files")}
              style={{
                padding: "14px 20px", borderRadius: 12, cursor: "pointer", display: "flex",
                alignItems: "center", gap: 10, fontSize: 13, fontWeight: 600,
                background: "#faf5ff", border: "1.5px solid #ede9fe", color: "#7c3aed",
              }}
            >
              <File size={16} /> All Files
              {total > 0 && (
                <span style={{ background: "#7c3aed", color: "#fff", borderRadius: 10, padding: "1px 8px", fontSize: 11, fontWeight: 700 }}>
                  {total}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Callout cards row */}
      <div style={{ padding: "0 32px", display: "flex", gap: 16, marginBottom: 24 }}>
        {/* Active Ingestions */}
        {activeJobEntries.length > 0 && (
          <div
            style={{
              flex: 1,
              background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
              borderRadius: 14,
              padding: "20px 24px",
              color: "#fff",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Zap size={16} />
              <span style={{ fontSize: 14, fontWeight: 700 }}>
                {activeJobEntries.length} Active Ingestion{activeJobEntries.length !== 1 ? "s" : ""}
              </span>
            </div>
            {activeJobEntries.slice(0, 3).map(([sourceId]) => {
              const src = recentSources?.items.find((s) => s.id === sourceId);
              return (
                <Link
                  key={sourceId}
                  href={`/sources/${sourceId}?tab=jobs`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 10px",
                    borderRadius: 8,
                    textDecoration: "none",
                    color: "rgba(255,255,255,0.9)",
                    fontSize: 12,
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#a78bfa", animation: "pulse 1.5s ease-in-out infinite", flexShrink: 0 }} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {src?.nav_label || src?.url || sourceId.slice(0, 8)}
                  </span>
                  <ArrowRight size={12} style={{ marginLeft: "auto", flexShrink: 0 }} />
                </Link>
              );
            })}
          </div>
        )}

        {/* Pending Review callout */}
        {pending > 0 && (
          <Link
            href="/files?tab=pending"
            style={{
              flex: 1,
              background: "#fffbeb",
              borderRadius: 14,
              border: "1px solid #fde68a",
              padding: "20px 24px",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              transition: "border-color 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#d97706")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#fde68a")}
          >
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#d97706" }}>{pending}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#92400e" }}>files pending review</div>
            </div>
            <ArrowRight size={20} color="#d97706" />
          </Link>
        )}

        {/* Discovery callout */}
        {pendingLinkCount > 0 && (
          <Link
            href="/discovery"
            style={{
              flex: 1,
              background: "#ecfeff",
              borderRadius: 14,
              border: "1px solid #a5f3fc",
              padding: "20px 24px",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              transition: "border-color 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#0891b2")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#a5f3fc")}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Link2 size={16} color="#0891b2" />
                <span style={{ fontSize: 28, fontWeight: 800, color: "#0891b2" }}>{pendingLinkCount}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#155e75" }}>links pending triage</div>
            </div>
            <ArrowRight size={20} color="#0891b2" />
          </Link>
        )}
      </div>

      {/* Recent Activity */}
      <div style={{ padding: "0 32px 24px" }}>
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #ede9fe", padding: 24 }}>
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
                <div
                  style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: isActive ? "#7c3aed" : "#16a34a",
                    flexShrink: 0,
                    animation: isActive ? "pulse 1.5s ease-in-out infinite" : undefined,
                  }}
                />
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

      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </>
  );
}
