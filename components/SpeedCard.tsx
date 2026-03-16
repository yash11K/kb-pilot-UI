"use client";

import { useState, useRef } from "react";
import { Eye } from "lucide-react";
import Badge from "@/components/Badge";
import ScorePill from "@/components/ScorePill";
import ScoreBreakdown from "@/components/ScoreBreakdown";
import MdPreview from "@/components/MdPreview";
import { STATUS_CONFIG, KBFileListItem, KBFile } from "@/lib/types";

interface SpeedCardProps {
  file: KBFileListItem;
  fileDetail: KBFile | undefined;
  onAccept: (fileId: string) => void;
  onReject: (fileId: string) => void;
  onDetail: (file: KBFileListItem) => void;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function fmtDate(d: string | null) {
  return d
    ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";
}

export default function SpeedCard({ file, fileDetail, onAccept, onReject, onDetail }: SpeedCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const sx = useRef(0);
  const sy = useRef(0);
  const dragging = useRef(false);
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [gone, setGone] = useState<"r" | "l" | null>(null);

  const rot = drag.x * 0.05;
  const prog = clamp(Math.abs(drag.x) / 150, 0, 1);
  const right = drag.x > 0;

  const down = (e: React.PointerEvent) => {
    dragging.current = true;
    sx.current = e.clientX;
    sy.current = e.clientY;
    ref.current?.setPointerCapture?.(e.pointerId);
  };

  const move = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    setDrag({ x: e.clientX - sx.current, y: (e.clientY - sy.current) * 0.25 });
  };

  const up = () => {
    if (!dragging.current) return;
    dragging.current = false;
    if (drag.x > 150) {
      setGone("r");
      setDrag({ x: 700, y: drag.y });
      setTimeout(() => onAccept(file.id), 280);
    } else if (drag.x < -150) {
      setGone("l");
      setDrag({ x: -700, y: drag.y });
      setTimeout(() => onReject(file.id), 280);
    } else {
      setDrag({ x: 0, y: 0 });
    }
  };

  const sc = STATUS_CONFIG[file.status] || STATUS_CONFIG.pending_validation;
  const issues = fileDetail?.validation_issues || [];

  return (
    <div
      ref={ref}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      style={{
        width: 440,
        maxWidth: "92vw",
        background: "#fff",
        borderRadius: 24,
        boxShadow: "0 20px 60px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.04)",
        overflow: "hidden",
        cursor: "grab",
        userSelect: "none",
        touchAction: "none",
        transform: `translate(${drag.x}px, ${drag.y}px) rotate(${rot}deg)`,
        transition: gone || dragging.current
          ? gone
            ? "all 0.3s ease"
            : "none"
          : "all 0.4s cubic-bezier(0.2,0.8,0.2,1)",
        opacity: gone ? 0 : 1,
        position: "relative",
      }}
    >
      {/* Floating ACCEPT stamp */}
      <div
        style={{
          position: "absolute",
          top: 28,
          left: 28,
          zIndex: 10,
          padding: "10px 24px",
          borderRadius: 14,
          border: "3.5px solid #16a34a",
          fontSize: 24,
          fontWeight: 800,
          color: "#16a34a",
          opacity: right ? prog : 0,
          transform: `rotate(-12deg) scale(${0.8 + prog * 0.2})`,
          pointerEvents: "none",
          letterSpacing: "0.04em",
        }}
      >
        ACCEPT
      </div>

      {/* Floating REJECT stamp */}
      <div
        style={{
          position: "absolute",
          top: 28,
          right: 28,
          zIndex: 10,
          padding: "10px 24px",
          borderRadius: 14,
          border: "3.5px solid #dc2626",
          fontSize: 24,
          fontWeight: 800,
          color: "#dc2626",
          opacity: !right && drag.x < 0 ? prog : 0,
          transform: `rotate(12deg) scale(${0.8 + prog * 0.2})`,
          pointerEvents: "none",
          letterSpacing: "0.04em",
        }}
      >
        REJECT
      </div>

      {/* Header */}
      <div style={{ padding: "24px 24px 16px", borderBottom: "1px solid #f3f4f6" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          <Badge label={sc.label} color={sc.color} bg={sc.bg} />
          <ScorePill score={file.validation_score} />
          <Badge label={file.content_type} color="#7c3aed" bg="#f3f0ff" />
        </div>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: 0, lineHeight: 1.3 }}>
          {file.title || file.filename}
        </h3>
        <div
          style={{
            fontSize: 11,
            color: "#9ca3af",
            marginTop: 6,
            fontFamily: "'DM Mono', monospace",
          }}
        >
          {file.region}/{file.brand} · {file.component_type?.split("/").pop()} · {fmtDate(file.created_at)}
        </div>
      </div>

      {/* Content preview */}
      <div style={{ padding: "16px 24px", maxHeight: 240, overflow: "auto" }}>
        {fileDetail?.md_content ? (
          <MdPreview content={fileDetail.md_content} />
        ) : (
          <p style={{ color: "#9ca3af", fontSize: 13, margin: 0 }}>{file.title}</p>
        )}
      </div>

      {/* Score breakdown */}
      {fileDetail?.validation_breakdown && (
        <div style={{ padding: "12px 24px 16px", borderTop: "1px solid #f3f4f6" }}>
          <ScoreBreakdown breakdown={fileDetail.validation_breakdown} />
        </div>
      )}

      {/* Validation issues */}
      {issues.length > 0 && (
        <div style={{ padding: "0 24px 14px", display: "flex", gap: 6, flexWrap: "wrap" }}>
          {issues.map((iss, i) => (
            <span
              key={i}
              style={{
                padding: "4px 10px",
                background: "#fffbeb",
                border: "1px solid #fde68a",
                borderRadius: 8,
                fontSize: 11,
                color: "#92400e",
              }}
            >
              ⚠ {iss}
            </span>
          ))}
        </div>
      )}

      {/* View Full Detail button */}
      <div style={{ padding: "0 24px 20px" }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDetail(file);
          }}
          style={{
            width: "100%",
            padding: "10px 0",
            background: "#f3f0ff",
            border: "none",
            borderRadius: 10,
            fontSize: 12,
            fontWeight: 600,
            color: "#7c3aed",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <Eye size={14} /> View Full Detail
        </button>
      </div>
    </div>
  );
}
