"use client";

import { useState, useRef, useCallback } from "react";
import Badge from "@/components/Badge";
import ScorePill from "@/components/ScorePill";
import { STATUS_CONFIG } from "@/lib/types";
import type { KBFileListItem } from "@/lib/types";
import { Check, X } from "lucide-react";

interface SwipeRowProps {
  file: KBFileListItem;
  onAccept: () => void;
  onReject: () => void;
  onClick: () => void;
  hideStatus?: boolean;
}

const SWIPE_TH = 120;

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function fmtDate(d: string | null) {
  return d
    ? new Date(d).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
}

export default function SwipeRow({ file, onAccept, onReject, onClick, hideStatus }: SwipeRowProps) {
  const ref = useRef<HTMLTableRowElement>(null);
  const sx = useRef(0);
  const dx = useRef(0);
  const drag = useRef(false);
  const [off, setOff] = useState(0);
  const [exit, setExit] = useState<"r" | "l" | null>(null);

  const canSwipe = file.status === "pending_review";
  const sc = STATUS_CONFIG[file.status] || STATUS_CONFIG.pending_validation;

  const down = useCallback(
    (e: React.PointerEvent<HTMLTableRowElement>) => {
      if (!canSwipe) return;
      drag.current = true;
      sx.current = e.clientX;
      dx.current = 0;
      ref.current?.setPointerCapture?.(e.pointerId);
    },
    [canSwipe],
  );

  const move = useCallback((e: React.PointerEvent<HTMLTableRowElement>) => {
    if (!drag.current) return;
    dx.current = e.clientX - sx.current;
    setOff(dx.current);
  }, []);

  const up = useCallback(() => {
    if (!drag.current) return;
    drag.current = false;
    const d = dx.current;
    if (d > SWIPE_TH) {
      setExit("r");
      setOff(800);
      setTimeout(() => onAccept(), 300);
    } else if (d < -SWIPE_TH) {
      setExit("l");
      setOff(-800);
      setTimeout(() => onReject(), 300);
    } else {
      setOff(0);
      if (Math.abs(d) < 6) onClick();
    }
  }, [onAccept, onReject, onClick]);

  const prog = clamp(Math.abs(off) / SWIPE_TH, 0, 1);
  const right = off > 0;
  const bg = right
    ? `rgba(22,163,74,${prog * 0.2})`
    : off < 0
      ? `rgba(220,38,38,${prog * 0.2})`
      : "transparent";
  const tx = `translateX(${off}px)`;
  const tr = exit ? "all 0.3s ease" : drag.current ? "none" : "all 0.25s ease";

  return (
    <tr
      ref={ref}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onClick={() => {
        if (!canSwipe) onClick();
      }}
      onMouseEnter={(e) => {
        if (!drag.current && !exit) e.currentTarget.style.background = "#faf5ff";
      }}
      onMouseLeave={(e) => {
        if (!drag.current && !exit) e.currentTarget.style.background = "";
      }}
      style={{
        position: "relative",
        borderBottom: "1px solid #f3f4f6",
        cursor: canSwipe ? "grab" : "pointer",
        transition: tr,
        opacity: exit ? 0 : 1,
        background: bg,
        touchAction: "pan-y",
        overflow: "hidden",
      }}
    >
      {/* Swipe action indicators behind the row */}
      {canSwipe && Math.abs(off) > 10 && (
        <td
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: right ? "flex-start" : "flex-end",
            padding: "0 28px",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              opacity: prog,
              transform: `scale(${0.7 + prog * 0.3})`,
            }}
          >
            {right ? (
              <>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    background: "#16a34a",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Check size={17} color="#fff" />
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#16a34a" }}>Accept</span>
              </>
            ) : (
              <>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#dc2626" }}>Reject</span>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    background: "#dc2626",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <X size={17} color="#fff" />
                </div>
              </>
            )}
          </div>
        </td>
      )}

      {/* Title cell */}
      <td
        style={{
          padding: "13px 16px",
          transform: tx,
          transition: tr,
          position: "relative",
          zIndex: 2,
          background: "inherit",
        }}
      >
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "#111827", marginBottom: 2 }}>
          {file.title || file.filename}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "#9ca3af",
            fontFamily: "var(--font-dm-mono), 'DM Mono', monospace",
          }}
        >
          {file.filename}
        </div>
      </td>

      {/* Type cell */}
      <td style={{ padding: "13px 16px", transform: tx, transition: tr, zIndex: 2, background: "inherit" }}>
        <Badge label={file.content_type} color="#7c3aed" bg="#f3f0ff" />
      </td>

      {/* Brand cell */}
      <td
        style={{
          padding: "13px 16px",
          fontSize: 13,
          color: "#374151",
          fontWeight: 500,
          transform: tx,
          transition: tr,
          zIndex: 2,
          background: "inherit",
        }}
      >
        {file.brand}
      </td>

      {/* Region cell */}
      <td
        style={{
          padding: "13px 16px",
          fontSize: 13,
          color: "#374151",
          fontWeight: 500,
          transform: tx,
          transition: tr,
          zIndex: 2,
          background: "inherit",
        }}
      >
        {file.region}
      </td>

      {/* Score cell */}
      <td style={{ padding: "13px 16px", transform: tx, transition: tr, zIndex: 2, background: "inherit" }}>
        <ScorePill score={file.validation_score} />
      </td>

      {/* Status cell */}
      {!hideStatus && (
        <td style={{ padding: "13px 16px", transform: tx, transition: tr, zIndex: 2, background: "inherit" }}>
          <Badge label={sc.label} color={sc.color} bg={sc.bg} />
        </td>
      )}

      {/* Created cell */}
      <td
        style={{
          padding: "13px 16px",
          fontSize: 12,
          color: "#9ca3af",
          fontFamily: "var(--font-dm-mono), 'DM Mono', monospace",
          transform: tx,
          transition: tr,
          zIndex: 2,
          background: "inherit",
        }}
      >
        {fmtDate(file.created_at)}
      </td>
    </tr>
  );
}
