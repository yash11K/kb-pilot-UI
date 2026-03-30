"use client";

import { ExternalLink, Check, X, Globe } from "lucide-react";
import Link from "next/link";
import type { DeepLink } from "@/lib/types";

interface SpeedDiscoveryCardProps {
  foundIn: string;
  sourceId?: string;
  links: DeepLink[];
  decisions: Map<string, "confirm" | "dismiss">;
  onDecide: (id: string, action: "confirm" | "dismiss" | null) => void;
}

export default function SpeedDiscoveryCard({
  foundIn,
  sourceId,
  links,
  decisions,
  onDecide,
}: SpeedDiscoveryCardProps) {
  const shortPath = foundIn
    .replace(/^https?:\/\/[^/]+/, "")
    .replace(/\.model\.json$/, "");

  const confirmed = links.filter((l) => decisions.get(l.id) === "confirm").length;
  const dismissed = links.filter((l) => decisions.get(l.id) === "dismiss").length;
  const unmarked = links.length - confirmed - dismissed;

  return (
    <div
      style={{
        width: "min(860px, 92vw)",
        background: "#fff",
        borderRadius: 24,
        boxShadow:
          "0 20px 60px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.04)",
        overflow: "hidden",
        userSelect: "none",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "28px 32px 18px",
          borderBottom: "1px solid #f3f4f6",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 8,
          }}
        >
          {sourceId && (
            <Link
              href={`/sources/${sourceId}?tab=deep-links`}
              style={{ color: "#7c3aed", flexShrink: 0 }}
              aria-label="View source"
            >
              <Globe size={16} />
            </Link>
          )}
          <h3
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "#111827",
              margin: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={foundIn}
          >
            {shortPath || foundIn}
          </h3>
        </div>
        <div
          style={{
            display: "flex",
            gap: 14,
            fontSize: 12,
            color: "#9ca3af",
          }}
        >
          <span>
            <span style={{ fontWeight: 700, color: "#374151" }}>
              {links.length}
            </span>{" "}
            link{links.length !== 1 ? "s" : ""}
          </span>
          {confirmed > 0 && (
            <span>
              <span style={{ fontWeight: 700, color: "#16a34a" }}>
                {confirmed}
              </span>{" "}
              to ingest
            </span>
          )}
          {dismissed > 0 && (
            <span>
              <span style={{ fontWeight: 700, color: "#dc2626" }}>
                {dismissed}
              </span>{" "}
              to dismiss
            </span>
          )}
          {unmarked > 0 && (
            <span>
              <span style={{ fontWeight: 700, color: "#d97706" }}>
                {unmarked}
              </span>{" "}
              unmarked
            </span>
          )}
        </div>
      </div>

      {/* Link list */}
      <div style={{ maxHeight: 420, overflow: "auto", padding: "8px 0" }}>
        {links.map((link) => {
          const decision = decisions.get(link.id);
          const title = link.anchor_text || link.url;
          const shortUrl = link.url.replace(/^https?:\/\/[^/]+/, "");

          return (
            <div
              key={link.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 32px",
                borderBottom: "1px solid #f9fafb",
                background:
                  decision === "confirm"
                    ? "#f0fdf4"
                    : decision === "dismiss"
                      ? "#fef2f2"
                      : "transparent",
                transition: "background 0.15s",
              }}
            >
              {/* Link info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color:
                      decision === "dismiss" ? "#9ca3af" : "#374151",
                    textDecoration:
                      decision === "dismiss" ? "line-through" : "none",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                  title={title}
                >
                  {title}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "#9ca3af",
                    fontFamily: "'DM Mono', monospace",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    marginTop: 2,
                  }}
                  title={link.url}
                >
                  {shortUrl}
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#9ca3af", flexShrink: 0 }}
                    aria-label={`Open ${link.url} in new tab`}
                  >
                    <ExternalLink size={10} />
                  </a>
                </div>
              </div>

              {/* Accept button */}
              <button
                onClick={() =>
                  onDecide(link.id, decision === "confirm" ? null : "confirm")
                }
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  border:
                    decision === "confirm"
                      ? "2px solid #16a34a"
                      : "2px solid #d1d5db",
                  background:
                    decision === "confirm" ? "#16a34a" : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  flexShrink: 0,
                }}
                aria-label={`Confirm ${title}`}
              >
                <Check
                  size={15}
                  color={decision === "confirm" ? "#fff" : "#9ca3af"}
                />
              </button>

              {/* Dismiss button */}
              <button
                onClick={() =>
                  onDecide(link.id, decision === "dismiss" ? null : "dismiss")
                }
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  border:
                    decision === "dismiss"
                      ? "2px solid #dc2626"
                      : "2px solid #d1d5db",
                  background:
                    decision === "dismiss" ? "#dc2626" : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  flexShrink: 0,
                }}
                aria-label={`Dismiss ${title}`}
              >
                <X
                  size={15}
                  color={decision === "dismiss" ? "#fff" : "#9ca3af"}
                />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
