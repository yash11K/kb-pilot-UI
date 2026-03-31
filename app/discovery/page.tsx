"use client";

import { useState, useCallback, useMemo, useRef, useEffect, Suspense } from "react";
import Link from "next/link";
import {
  Compass,
  RefreshCw,
  Send,
  XCircle,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Globe,
  Zap,
} from "lucide-react";
import { useDiscoveryLinks } from "@/hooks/useDiscoveryLinks";
import { confirmDeepLinks, dismissDeepLinks } from "@/lib/api";
import { useToast } from "@/components/Toast";
import Badge from "@/components/Badge";
import SpeedDiscovery from "@/components/SpeedDiscovery";
import type { DeepLink, DeepLinkStatus } from "@/lib/types";
import { DEEP_LINK_STATUS_CONFIG } from "@/lib/types";
import { useSearchParams } from "next/navigation";

/* ── Resizable column hook ─────────────────────────────────── */
function useResizableColumns(initial: number[]) {
  const [widths, setWidths] = useState(initial);
  const dragging = useRef<{ col: number; startX: number; startW: number } | null>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = e.clientX - dragging.current.startX;
      setWidths((prev) => {
        const next = [...prev];
        next[dragging.current!.col] = Math.max(60, dragging.current!.startW + delta);
        return next;
      });
    };
    const onUp = () => {
      dragging.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const startResize = (col: number, e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = { col, startX: e.clientX, startW: widths[col] };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  return { widths, startResize };
}

/* ── Resize handle ─────────────────────────────────────────── */
function ResizeHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        position: "absolute",
        right: 0,
        top: 0,
        bottom: 0,
        width: 6,
        cursor: "col-resize",
        zIndex: 2,
      }}
      role="separator"
      aria-orientation="vertical"
    >
      <div
        style={{
          position: "absolute",
          right: 2,
          top: "25%",
          bottom: "25%",
          width: 2,
          borderRadius: 1,
          background: "#e5e7eb",
          transition: "background 0.15s",
        }}
      />
    </div>
  );
}

/* ── Group type ────────────────────────────────────────────── */
interface LinkGroup {
  foundIn: string;
  sourceId?: string;
  links: DeepLink[];
}

function DiscoveryPageContent() {
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<DeepLinkStatus | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string> | null>(null);
  const [page, setPage] = useState(1);
  const [speedMode, setSpeedMode] = useState(searchParams.get("mode") === "speed");

  const { data: links, isLoading, error, mutate, total, pages } = useDiscoveryLinks(statusFilter, page, 50);

  // Column widths: [checkbox, title+url, status, discovered]
  const { widths, startResize } = useResizableColumns([40, 420, 100, 140]);

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

  /* ── Group by found_in_page ──────────────────────────────── */
  const groups: LinkGroup[] = useMemo(() => {
    const map = new Map<string, LinkGroup>();
    for (const link of filtered) {
      const key = link.found_in_page;
      if (!map.has(key)) {
        map.set(key, { foundIn: key, sourceId: link.source_id, links: [] });
      }
      map.get(key)!.links.push(link);
    }
    return Array.from(map.values());
  }, [filtered]);

  // Initialize all groups as collapsed by default
  const resolvedCollapsed = useMemo(() => {
    if (collapsedGroups !== null) return collapsedGroups;
    return new Set(groups.map((g) => g.foundIn));
  }, [collapsedGroups, groups]);

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

  const toggleGroup = useCallback((groupKey: string) => {
    setCollapsedGroups((prev) => {
      const base = prev !== null ? prev : new Set(groups.map((g) => g.foundIn));
      const next = new Set(base);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  }, [groups]);

  const toggleGroupSelection = useCallback(
    (groupLinks: DeepLink[]) => {
      const ids = groupLinks.map((l) => l.id);
      const allGroupSelected = ids.every((id) => selectedIds.has(id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (allGroupSelected) {
          ids.forEach((id) => next.delete(id));
        } else {
          ids.forEach((id) => next.add(id));
        }
        return next;
      });
    },
    [selectedIds],
  );

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

  if (speedMode) {
    return <SpeedDiscovery onExit={() => setSpeedMode(false)} />;
  }

  const pendingCount = statusFilter === "pending" ? total : links.filter((l) => l.status === "pending").length;

  const gridTemplate = `${widths[0]}px 1fr ${widths[2]}px ${widths[3]}px`;

  return (
    <div style={{ padding: "24px 32px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Compass size={22} color="#7c3aed" />
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: 0 }}>Discovery</h2>
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
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setSpeedMode(true)}
            style={{
              padding: "8px 14px",
              background: "linear-gradient(135deg, #0891b2, #67e8f9)",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              fontWeight: 700,
              color: "#fff",
              boxShadow: "0 2px 8px rgba(8,145,178,0.25)",
            }}
          >
            <Zap size={13} /> Speed Discovery
          </button>
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
              onChange={(e) => {
                setStatusFilter((e.target.value || undefined) as DeepLinkStatus | undefined);
                setPage(1);
              }}
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
              style={{
                position: "absolute",
                right: 10,
                top: "50%",
                transform: "translateY(-50%)",
                pointerEvents: "none",
                color: "#9ca3af",
              }}
            />
          </div>
        </div>

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
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 4,
                  background: "#e5e7eb",
                  animation: "pulse 1.5s ease-in-out infinite",
                }}
              />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    width: "60%",
                    height: 13,
                    background: "#e5e7eb",
                    borderRadius: 4,
                    marginBottom: 6,
                    animation: "pulse 1.5s ease-in-out infinite",
                  }}
                />
                <div
                  style={{
                    width: "40%",
                    height: 11,
                    background: "#e5e7eb",
                    borderRadius: 4,
                    animation: "pulse 1.5s ease-in-out infinite",
                  }}
                />
              </div>
              <div
                style={{
                  width: 70,
                  height: 22,
                  background: "#e5e7eb",
                  borderRadius: 12,
                  animation: "pulse 1.5s ease-in-out infinite",
                }}
              />
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
          <div style={{ fontSize: 14, color: "#dc2626", marginBottom: 12 }}>
            Failed to load deep links.
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
      )}

      {/* Grouped Table */}
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
              gridTemplateColumns: gridTemplate,
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
            <div style={{ position: "relative", paddingRight: 8 }}>
              Title / URL
              <ResizeHandle onMouseDown={(e) => startResize(1, e)} />
            </div>
            <div style={{ position: "relative", paddingRight: 8 }}>
              Status
              <ResizeHandle onMouseDown={(e) => startResize(2, e)} />
            </div>
            <div>Discovered</div>
          </div>

          {/* Grouped rows */}
          {groups.map((group) => {
            const isCollapsed = resolvedCollapsed.has(group.foundIn);
            const groupIds = group.links.map((l) => l.id);
            const allGroupSelected =
              groupIds.length > 0 && groupIds.every((id) => selectedIds.has(id));
            const someGroupSelected =
              !allGroupSelected && groupIds.some((id) => selectedIds.has(id));
            const shortPath = group.foundIn
              .replace(/^https?:\/\/[^/]+/, "")
              .replace(/\.model\.json$/, "");

            return (
              <div key={group.foundIn}>
                {/* Group header */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: gridTemplate,
                    padding: "10px 18px",
                    background: "#f3f0ff",
                    borderBottom: "1px solid #ede9fe",
                    alignItems: "center",
                    cursor: "pointer",
                  }}
                  onClick={() => toggleGroup(group.foundIn)}
                  role="button"
                  aria-expanded={!isCollapsed}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleGroup(group.foundIn);
                    }
                  }}
                >
                  <div onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={allGroupSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someGroupSelected;
                      }}
                      onChange={() => toggleGroupSelection(group.links)}
                      style={{ cursor: "pointer", accentColor: "#7c3aed" }}
                      aria-label={`Select all links from ${shortPath}`}
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      minWidth: 0,
                    }}
                  >
                    {isCollapsed ? (
                      <ChevronRight size={14} color="#9ca3af" style={{ flexShrink: 0 }} />
                    ) : (
                      <ChevronDown size={14} color="#9ca3af" style={{ flexShrink: 0 }} />
                    )}
                    {group.sourceId && (
                      <Link
                        href={`/sources/${group.sourceId}?tab=deep-links`}
                        onClick={(e) => e.stopPropagation()}
                        style={{ color: "#7c3aed", flexShrink: 0 }}
                        aria-label="View source"
                      >
                        <Globe size={13} />
                      </Link>
                    )}
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#374151",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                      title={group.foundIn}
                    >
                      {shortPath || group.foundIn}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: "#9ca3af",
                        fontWeight: 600,
                        background: "#f3f4f6",
                        borderRadius: 10,
                        padding: "1px 8px",
                        flexShrink: 0,
                      }}
                    >
                      {group.links.length}
                    </span>
                  </div>
                  <div />
                  <div />
                </div>

                {/* Links in group */}
                {!isCollapsed &&
                  group.links.map((link) => {
                    const cfg = DEEP_LINK_STATUS_CONFIG[link.status];
                    const checked = selectedIds.has(link.id);
                    const title = link.anchor_text || link.url;
                    return (
                      <div
                        key={link.id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: gridTemplate,
                          padding: "10px 18px 10px 18px",
                          borderBottom: "1px solid #f3f4f6",
                          alignItems: "center",
                          background: checked ? "#faf5ff" : "#f9fafb",
                          borderLeft: "3px solid #ede9fe",
                          marginLeft: 18,
                          transition: "background 0.1s",
                        }}
                      >
                        <div style={{ paddingLeft: 0 }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleOne(link.id)}
                            style={{ cursor: "pointer", accentColor: "#7c3aed" }}
                            aria-label={`Select ${title}`}
                          />
                        </div>
                        <div style={{ minWidth: 0, paddingLeft: 22 }}>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 500,
                              color: "#374151",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              lineHeight: 1.4,
                            }}
                            title={title}
                          >
                            {title}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: "#9ca3af",
                              marginTop: 2,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                              fontFamily: "'DM Mono', monospace",
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
                              <ExternalLink size={11} />
                            </a>
                          </div>
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
              </div>
            );
          })}

          {/* Empty */}
          {filtered.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: "40px 24px",
                color: "#9ca3af",
                fontSize: 13,
              }}
            >
              {links.length === 0
                ? "No deep links discovered yet. Run an ingestion to discover links."
                : "No links match the current filters."}
            </div>
          )}

          {/* Pagination */}
          {pages > 1 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 18px",
                borderTop: "1px solid #ede9fe",
                fontSize: 13,
                color: "#6b7280",
              }}
            >
              <span>
                Showing {(page - 1) * 50 + 1}–{Math.min(page * 50, total)} of {total}
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 8,
                    border: "1.5px solid #e5e7eb",
                    background: page <= 1 ? "#f9fafb" : "#fff",
                    color: page <= 1 ? "#d1d5db" : "#374151",
                    cursor: page <= 1 ? "default" : "pointer",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  Previous
                </button>
                <button
                  disabled={page >= pages}
                  onClick={() => setPage((p) => Math.min(pages, p + 1))}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 8,
                    border: "1.5px solid #e5e7eb",
                    background: page >= pages ? "#f9fafb" : "#fff",
                    color: page >= pages ? "#d1d5db" : "#374151",
                    cursor: page >= pages ? "default" : "pointer",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DiscoveryPage() {
  return (
    <Suspense fallback={<div style={{ padding: "24px 32px" }}>Loading…</div>}>
      <DiscoveryPageContent />
    </Suspense>
  );
}
