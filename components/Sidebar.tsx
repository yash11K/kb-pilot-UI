"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, File, Menu, Upload, Globe, Compass, Search } from "lucide-react";
import { useStats } from "@/hooks/useStats";

interface SidebarProps {
  onNewIngestion: () => void;
}

const NAV_ITEMS = [
  { label: "Dashboard", icon: House, path: "/dashboard" },
  { label: "Sources", icon: Globe, path: "/sources" },
  { label: "Discovery", icon: Compass, path: "/discovery" },
  { label: "KB", icon: Search, path: "/kb" },
  { label: "Files", icon: File, path: "/files" },
] as const;

const STORAGE_KEY = "sidebar-collapsed";
const WIDTH_KEY = "sidebar-width";
const MIN_WIDTH = 180;
const MAX_WIDTH = 400;
const DEFAULT_WIDTH = 240;
const COLLAPSED_WIDTH = 64;

export default function Sidebar({ onNewIngestion }: SidebarProps) {
  const pathname = usePathname();
  const { data: stats } = useStats();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH);

  /* ── Drag-to-resize state ─────────────────────────────────── */
  const dragging = useRef(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const widthRef = useRef(sidebarWidth);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "true") {
      setCollapsed(true);
    }
    const storedWidth = localStorage.getItem(WIDTH_KEY);
    if (storedWidth) {
      const parsed = parseInt(storedWidth, 10);
      if (!isNaN(parsed) && parsed >= MIN_WIDTH && parsed <= MAX_WIDTH) {
        setSidebarWidth(parsed);
      }
    }
    setMounted(true);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (collapsed) return;
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [collapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX));
      widthRef.current = newWidth;
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      localStorage.setItem(WIDTH_KEY, String(widthRef.current));
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const isActive = (path: string) => {
    return pathname.startsWith(path);
  };

  const expanded = !collapsed;
  const width = expanded ? sidebarWidth : COLLAPSED_WIDTH;

  return (
    <nav
      ref={sidebarRef}
      className="sidebar-desktop"
      style={{
        width,
        height: "100vh",
        background: "#fff",
        borderRight: "1px solid #ede9fe",
        display: "flex",
        flexDirection: "column",
        transition: dragging.current ? "none" : "width 0.25s ease",
        flexShrink: 0,
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Header */}
      <div
        className="sidebar-header"
        style={{
          padding: expanded ? "20px 20px 16px" : "20px 14px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          borderBottom: "1px solid #f3f0ff",
        }}
      >
        <button
          onClick={toggleCollapsed}
          aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 6,
            borderRadius: 8,
            display: "flex",
          }}
        >
          <Menu size={20} color="#7c3aed" />
        </button>
        {expanded && (
          <span
            className="sidebar-title"
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: "#7c3aed",
              letterSpacing: "-0.02em",
              whiteSpace: "nowrap",
            }}
          >
            KB Manager
          </span>
        )}
      </div>

      {/* Nav Items */}
      <div
        style={{
          flex: 1,
          padding: "12px 8px",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.path);
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              href={item.path}
              className="sidebar-nav-link"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: expanded ? "10px 14px" : "10px 0",
                justifyContent: expanded ? "flex-start" : "center",
                background: active ? "#f3f0ff" : "transparent",
                color: active ? "#7c3aed" : "#6b7280",
                fontWeight: active ? 700 : 500,
                fontSize: 13.5,
                borderRadius: 10,
                width: "100%",
                transition: "all 0.15s",
                textDecoration: "none",
              }}
            >
              <Icon size={18} />
              {expanded && (
                <span className="sidebar-label" style={{ whiteSpace: "nowrap" }}>{item.label}</span>
              )}
              {expanded &&
                item.path === "/files" &&
                mounted &&
                stats &&
                stats.pending_review > 0 && (
                  <span
                    className="sidebar-label"
                    style={{
                      marginLeft: "auto",
                      background: "#7c3aed",
                      color: "#fff",
                      borderRadius: 12,
                      padding: "1px 8px",
                      fontSize: 11,
                      fontWeight: 700,
                      animation: "pulse 2s infinite",
                    }}
                  >
                    {stats.pending_review}
                  </span>
                )}
            </Link>
          );
        })}
      </div>

      {/* Bottom Action */}
      {expanded && (
        <div className="sidebar-bottom-action" style={{ padding: "16px 20px", borderTop: "1px solid #f3f0ff" }}>
          <button
            onClick={onNewIngestion}
            style={{
              width: "100%",
              padding: "11px 0",
              background: "#7c3aed",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              boxShadow: "0 2px 8px rgba(124,58,237,0.25)",
            }}
          >
            <Upload size={15} />
            New Ingestion
          </button>
        </div>
      )}
      {/* Drag handle */}
      {expanded && (
        <div
          onMouseDown={handleMouseDown}
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: 6,
            height: "100%",
            cursor: "col-resize",
            zIndex: 10,
            background: "transparent",
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#ede9fe";
          }}
          onMouseLeave={(e) => {
            if (!dragging.current) {
              e.currentTarget.style.background = "transparent";
            }
          }}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
        />
      )}
    </nav>
  );
}
