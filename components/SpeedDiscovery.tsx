"use client";

import { useState, useCallback, useMemo } from "react";
import { ArrowLeft, Send, XCircle, SkipForward } from "lucide-react";
import SpeedDiscoveryCard from "@/components/SpeedDiscoveryCard";
import CardStackLoader from "@/components/CardStackLoader";
import { useDiscoveryLinks } from "@/hooks/useDiscoveryLinks";
import { confirmDeepLinks, dismissDeepLinks } from "@/lib/api";
import { useToast } from "@/components/Toast";
import type { DeepLink } from "@/lib/types";

interface LinkGroup {
  foundIn: string;
  sourceId?: string;
  links: DeepLink[];
}

interface SpeedDiscoveryProps {
  onExit: () => void;
}

export default function SpeedDiscovery({ onExit }: SpeedDiscoveryProps) {
  const { showToast } = useToast();
  const { data: links, isLoading, error, mutate } = useDiscoveryLinks("pending", 1, 100);

  const [skippedGroups, setSkippedGroups] = useState<Set<string>>(new Set());
  const [done, setDone] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  // Per-link decisions: "confirm" | "dismiss"
  const [decisions, setDecisions] = useState<Map<string, "confirm" | "dismiss">>(new Map());

  const groups: LinkGroup[] = useMemo(() => {
    const map = new Map<string, LinkGroup>();
    for (const link of links) {
      const key = link.found_in_page;
      if (!map.has(key)) {
        map.set(key, { foundIn: key, sourceId: link.source_id, links: [] });
      }
      map.get(key)!.links.push(link);
    }
    return Array.from(map.values());
  }, [links]);

  const remaining = groups.filter((g) => !skippedGroups.has(g.foundIn));
  const current = remaining[0];
  const totalGroups = groups.length;

  const handleDecide = useCallback(
    (id: string, action: "confirm" | "dismiss" | null) => {
      setDecisions((prev) => {
        const next = new Map(prev);
        if (action === null) {
          next.delete(id);
        } else {
          next.set(id, action);
        }
        return next;
      });
    },
    [],
  );

  const handleSubmit = useCallback(async () => {
    if (!current) return;
    const currentIds = new Set(current.links.map((l) => l.id));
    const toConfirm: string[] = [];
    const toDismiss: string[] = [];

    for (const [id, action] of decisions) {
      if (!currentIds.has(id)) continue;
      if (action === "confirm") toConfirm.push(id);
      else if (action === "dismiss") toDismiss.push(id);
    }

    if (toConfirm.length === 0 && toDismiss.length === 0) {
      showToast("Mark at least one link before submitting", "error");
      return;
    }

    setSubmitting(true);
    try {
      const sourceId = current.sourceId ?? current.foundIn;
      if (toConfirm.length > 0) {
        await confirmDeepLinks(sourceId, toConfirm);
      }
      if (toDismiss.length > 0) {
        await dismissDeepLinks(sourceId, toDismiss);
      }
      showToast(
        `${toConfirm.length} ingested, ${toDismiss.length} dismissed`,
        "success",
      );
      // Clear decisions for this group and advance
      setDecisions((prev) => {
        const next = new Map(prev);
        for (const id of currentIds) next.delete(id);
        return next;
      });
      setDone((d) => d + 1);
      mutate();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to submit";
      showToast(msg, "error");
    } finally {
      setSubmitting(false);
    }
  }, [current, decisions, showToast, mutate]);

  const handleSkip = useCallback(() => {
    if (!current) return;
    // Clear decisions for skipped group
    const currentIds = new Set(current.links.map((l) => l.id));
    setDecisions((prev) => {
      const next = new Map(prev);
      for (const id of currentIds) next.delete(id);
      return next;
    });
    setSkippedGroups((prev) => new Set(prev).add(current.foundIn));
    setDone((d) => d + 1);
  }, [current]);

  // Current group decision counts
  const currentDecisions = useMemo(() => {
    if (!current) return { confirmed: 0, dismissed: 0, total: 0 };
    let confirmed = 0;
    let dismissed = 0;
    for (const link of current.links) {
      const d = decisions.get(link.id);
      if (d === "confirm") confirmed++;
      else if (d === "dismiss") dismissed++;
    }
    return { confirmed, dismissed, total: confirmed + dismissed };
  }, [current, decisions]);

  // Loading
  if (isLoading) {
    return <CardStackLoader />;
  }

  // Error
  if (error) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #fecaca", padding: "32px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 14, color: "#dc2626", marginBottom: 12 }}>Failed to load deep links.</div>
          <button
            onClick={() => mutate()}
            style={{ padding: "8px 20px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 32px" }}>
      {/* Top bar */}
      <div style={{ width: "100%", maxWidth: 900, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <button
          onClick={onExit}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "8px 16px",
            background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 10,
            fontSize: 13, fontWeight: 600, color: "#6b7280", cursor: "pointer", fontFamily: "inherit",
          }}
        >
          <ArrowLeft size={14} /> Back to Discovery
        </button>
        <div style={{ display: "flex", gap: 16, fontSize: 13, color: "#9ca3af" }}>
          <span><span style={{ fontWeight: 700, color: "#7c3aed" }}>{done}</span> triaged</span>
          <span><span style={{ fontWeight: 700, color: "#d97706" }}>{remaining.length}</span> remaining</span>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ width: "100%", maxWidth: 900, height: 4, background: "#f3f4f6", borderRadius: 2, marginBottom: 28, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            background: "linear-gradient(90deg, #0891b2, #67e8f9)",
            borderRadius: 2,
            width: `${totalGroups > 0 ? (done / totalGroups) * 100 : 0}%`,
            transition: "width 0.3s ease",
          }}
        />
      </div>

      {/* Card area */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", width: "100%" }}>
        {current ? (
          <div style={{ position: "relative" }}>
            {/* Shadow preview of next card */}
            {remaining[1] && (
              <div
                style={{
                  position: "absolute", top: 10, left: "50%",
                  transform: "translateX(-50%) scale(0.94)",
                  width: "min(860px, 92vw)", height: 80,
                  background: "#fff", borderRadius: 24,
                  boxShadow: "0 10px 30px rgba(0,0,0,0.04)", opacity: 0.5,
                }}
              />
            )}
            <SpeedDiscoveryCard
              foundIn={current.foundIn}
              sourceId={current.sourceId}
              links={current.links}
              decisions={decisions}
              onDecide={handleDecide}
            />
          </div>
        ) : (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>🧭</div>
            <h3 style={{ fontSize: 24, fontWeight: 700, color: "#111827", marginBottom: 8 }}>
              All groups triaged!
            </h3>
            <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 24 }}>
              You triaged {done} group{done !== 1 ? "s" : ""} in this session.
            </p>
            <button
              onClick={onExit}
              style={{
                padding: "12px 28px", background: "#0891b2", color: "#fff",
                border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer",
              }}
            >
              Back to Discovery
            </button>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      {current && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, padding: "24px 0" }}>
          <button
            onClick={handleSkip}
            style={{
              padding: "10px 20px", borderRadius: 10,
              border: "1.5px solid #e5e7eb", background: "#fff",
              fontSize: 13, fontWeight: 600, color: "#6b7280",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <SkipForward size={14} /> Skip
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || currentDecisions.total === 0}
            style={{
              padding: "10px 24px", borderRadius: 10,
              border: "none",
              background: currentDecisions.total === 0 ? "#e5e7eb" : "#0891b2",
              fontSize: 13, fontWeight: 700,
              color: currentDecisions.total === 0 ? "#9ca3af" : "#fff",
              cursor: currentDecisions.total === 0 || submitting ? "default" : "pointer",
              opacity: submitting ? 0.6 : 1,
              display: "flex", alignItems: "center", gap: 6,
              boxShadow: currentDecisions.total > 0 ? "0 2px 10px rgba(8,145,178,0.3)" : "none",
            }}
          >
            <Send size={14} />
            Submit
            {currentDecisions.total > 0 && (
              <span style={{ background: "rgba(255,255,255,0.25)", borderRadius: 10, padding: "1px 8px", fontSize: 11 }}>
                {currentDecisions.confirmed > 0 && `${currentDecisions.confirmed} ✓`}
                {currentDecisions.confirmed > 0 && currentDecisions.dismissed > 0 && " · "}
                {currentDecisions.dismissed > 0 && `${currentDecisions.dismissed} ✕`}
              </span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
