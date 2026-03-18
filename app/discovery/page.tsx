"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { Compass, RefreshCw, Send, XCircle, ExternalLink, ChevronDown, Globe } from "lucide-react";
import { useDiscoveryLinks } from "@/hooks/useDiscoveryLinks";
import { confirmDeepLinks, dismissDeepLinks } from "@/lib/api";
import { useToast } from "@/components/Toast";
import Badge from "@/components/Badge";
import type { DeepLinkStatus } from "@/lib/types";
import { DEEP_LINK_STATUS_CONFIG } from "@/lib/types";

export default function DiscoveryPage() {
  const { showToast } = useToast();
  const [statusFilter, setStatusFilter] = useState<DeepLinkStatus | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  const { data: links, isLoading, error, mutate } = useDiscoveryLinks(statusFilter);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return links;
    const q = searchQuery.toLowerCase();
    return links.filter(
      (l) =>
        l.url.toLowerCase().includes(q) ||
        (l.anchor_text && l.anchor_text.toLowerCase().includes(q)) ||
        l.found_in_page.toLowerCase().includes(q),
    );
  }, [links, searchQuery]);

  const allSelected = filtered.length > 0 && filtered.every((l) => selectedIds.has(l.id));

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((l) => l.id)));
    }
  }, [allSelected, filtered]);

  const toggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Group selected links by source_id for API calls
  const groupBySource = useCallback(
    (ids: Set<string>) => {
      const map = new Map<string, string[]>();
      for (const link of links) {
        if (!ids.has(link.id)) continue;
        const sid = link.source_id ?? link.found_in_page;
        const arr = map.get(sid) ?? [];
        arr.push(link.id);
        map.set(sid, arr);
      }
      return map;
    },
    [links],
  );

  const handleConfirm = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setConfirming(true);
    try {
      const grouped = groupBySource(selectedIds);
      const entries = Array.from(grouped.entries());
      for (let i = 0; i < entries.length; i++) {
        await confirmDeepLinks(entries[i][0], entries[i][1]);
      }
      showToast(`Sent ${selectedIds.size} link(s) for ingestion`, "success");
      setSelectedIds(new Set());
      mutate();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to confirm links";
      showToast(msg, "error");
    } finally {
      setConfirming(false);
    }
  }, [selectedIds, groupBySource, showToast, mutate]);

  const handleDismiss = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setDismissing(true);
    try {
      const grouped = groupBySource(selectedIds);
      const entries = Array.from(grouped.entries());
      for (let i = 0; i < entries.length; i++) {
        await dismissDeepLinks(entries[i][0], entries[i][1]);
      }
      showToast(`Dismissed ${selectedIds.size} link(s)`, "success");
      setSelectedIds(new Set());
      mutate();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to dismiss links";
      showToast(msg, "error");
    } finally {
      setDismissing(false);
    }
  }, [selectedIds, groupBySource, showToast, mutate]);

  const pendingCount = links.filter((l) => l.status === "pending").length;

  return (
    <div style={{ padding: "24px 32px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Compass size={22} color="#7c3aed" />
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: 0 }}>
            Discovery
          </h2>
          {pendingCount > 0 && (
            <span
              style={{
                background: "#fffbeb",
                color: "#d97706",
                borderRadius: 12,
                padding: "2px 10px",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {pendingCount} pending
            </span>
          )}
        </div>
        <button
          onClick={() => mutate()}
          style={{
            padding: "8px 14px",
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

      {/* Filters + Actions Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search URLs, anchor text…"
            style={{
              padding: "8px 12px",
              border: "1.5px solid #e5e7eb",
              borderRadius: 8,
              fontSize: 13,
              fontFamily: "inherit",
              width: 260,
            }}
          />
          <div style={{ position: "relative" }}>
            <select
              value={statusFilter ?? ""}
              onChange={(e) =>
                setStatusFilter((e.target.value || undefined) as DeepLinkStatus | undefined)
              }
              style={{
                appearance: "none",
                padding: "8px 32px 8px 12px",
                border: "1.5px solid #e5e7eb",
                borderRadius: 8,
                fontSize: 13,
                fontFamily: "inherit",
                background: "#fff",
                cursor: "pointer",
              }}
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="ingested">Ingested</option>
              <option value="dismissed">Dismissed</option>
            </select>
            <ChevronDown
              size={14}
              style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#9ca3af" }}
            />
          </div>
        </div>

        {/* Batch actions */}
        {selectedIds.size > 0 && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 500 }}>
              {selectedIds.size} selected
            </span>
            <button
              onClick={handleConfirm}
              disabled={confirming}
              style={{
                padding: "8px 16px",
                background: "#7c3aed",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                cursor: confirming ? "default" : "pointer",
                opacity: confirming ? 0.6 : 1,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Send size={13} /> Ingest Selected
            </button>
            <button
              onClick={handleDismiss}
              disabled={dismissing}
              style={{
                padding: "8px 16px",
                background: "#fff",
                color: "#6b7280",
                border: "1.5px solid #e5e7eb",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                cursor: dismissing ? "default" : "pointer",
                opacity: dismissing ? 0.6 : 1,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <XCircle size={13} /> Dismiss
            </button>
          </div>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <>
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              style={{
                background: "#fff",
                borderRadius: 10,
                border: "1px solid #ede9fe",
                padding: "14px 18px",
                marginBottom: 8,
                display: "flex",
                gap: 14,
                alignItems: "center",
              }}
            >
              <div style={{ width: 18, height: 18, borderRadius: 4, background: "#e5e7eb", animation: "pulse 1.5s ease-in-out infinite" }} />
              <div style={{ flex: 1 }}>
                <div style={{ width: "60%", height: 13, background: "#e5e7eb", borderRadius: 4, marginBottom: 6, animation: "pulse 1.5s ease-in-out infinite" }} />
                <div style={{ width: "40%", height: 11, background: "#e5e7eb", borderRadius: 4, animation: "pulse 1.5s ease-in-out infinite" }} />
              </div>
              <div style={{ width: 70, height: 22, background: "#e5e7eb", borderRadius: 12, animation: "pulse 1.5s ease-in-out infinite" }} />
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
          <div style={{ fontSize: 14, color: "#dc2626", marginBottom: 12 }}>Failed to load deep links.</div>
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

      {/* Table */}
      {!isLoading && !error && (
        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            border: "1px solid #ede9fe",
            overflow: "hidden",
          }}
        >
          {/* Table header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "40px 1fr 180px 100px 140px",
              padding: "10px 18px",
              borderBottom: "1px solid #f3f0ff",
              fontSize: 11,
              fontWeight: 700,
              color: "#9ca3af",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            <div>
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                style={{ cursor: "pointer", accentColor: "#7c3aed" }}
                aria-label="Select all links"
              />
            </div>
            <div>URL</div>
            <div>Found In</div>
            <div>Status</div>
            <div>Discovered</div>
          </div>

          {/* Rows */}
          {filtered.map((link) => {
            const cfg = DEEP_LINK_STATUS_CONFIG[link.status];
            const checked = selectedIds.has(link.id);
            return (
              <div
                key={link.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "40px 1fr 180px 100px 140px",
                  padding: "12px 18px",
                  borderBottom: "1px solid #f9fafb",
                  alignItems: "center",
                  background: checked ? "#faf5ff" : "transparent",
                  transition: "background 0.1s",
                }}
              >
                <div>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleOne(link.id)}
                    style={{ cursor: "pointer", accentColor: "#7c3aed" }}
                    aria-label={`Select ${link.url}`}
                  />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#111827",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                    title={link.model_json_url}
                  >
                    {link.url}
                    <a
                      href={link.model_json_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{ color: "#9ca3af", flexShrink: 0 }}
                      aria-label={`Open ${link.url} in new tab`}
                    >
                      <ExternalLink size={12} />
                    </a>
                  </div>
                  {link.anchor_text && (
                    <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                      &ldquo;{link.anchor_text}&rdquo;
                    </div>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "#6b7280",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                  title={link.found_in_page}
                >
                  {link.source_id && (
                    <Link
                      href={`/sources/${link.source_id}?tab=deep-links`}
                      onClick={(e) => e.stopPropagation()}
                      style={{ color: "#7c3aed", flexShrink: 0 }}
                      aria-label="View source"
                    >
                      <Globe size={12} />
                    </Link>
                  )}
                  {link.found_in_page.replace(/^https?:\/\/[^/]+/, "").replace(/\.model\.json$/, "")}
                </div>
                <div>
                  <Badge label={cfg.label} color={cfg.color} bg={cfg.bg} />
                </div>
                <div style={{ fontSize: 12, color: "#9ca3af" }}>
                  {new Date(link.created_at).toLocaleDateString()}
                </div>
              </div>
            );
          })}

          {/* Empty */}
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 24px", color: "#9ca3af", fontSize: 13 }}>
              {links.length === 0
                ? "No deep links discovered yet. Run an ingestion to discover links."
                : "No links match the current filters."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
