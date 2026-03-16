"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Inbox, File, Menu, Upload, Globe } from "lucide-react";
import { useStats } from "@/hooks/useStats";

interface SidebarProps {
  onNewIngestion: () => void;
}

const NAV_ITEMS = [
  { label: "Dashboard", icon: House, path: "/dashboard" },
  { label: "Sources", icon: Globe, path: "/sources" },
  { label: "Review Queue", icon: Inbox, path: "/queue" },
  { label: "All Files", icon: File, path: "/files" },
] as const;

const STORAGE_KEY = "sidebar-collapsed";

export default function Sidebar({ onNewIngestion }: SidebarProps) {
  const pathname = usePathname();
  const { data: stats } = useStats();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "true") {
      setCollapsed(true);
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

  const isActive = (path: string) => {
    return pathname.startsWith(path);
  };

  const expanded = !collapsed;
  const width = expanded ? 240 : 64;

  return (
    <nav
      className="sidebar-desktop"
      style={{
        width,
        height: "100vh",
        background: "#fff",
        borderRight: "1px solid #ede9fe",
        display: "flex",
        flexDirection: "column",
        transition: "width 0.25s ease",
        flexShrink: 0,
        overflow: "hidden",
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
                item.path === "/queue" &&
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
    </nav>
  );
}
