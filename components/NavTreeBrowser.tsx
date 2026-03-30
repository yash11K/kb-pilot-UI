"use client";

import { useState, useMemo, useCallback } from "react";
import {
  ChevronRight,
  ChevronDown,
  ExternalLink,
  CheckSquare,
  Square,
  MinusSquare,
} from "lucide-react";
import type { NavTree, NavTreeNode, NavTreeSection, SourceUrlStats } from "@/lib/types";

interface NavTreeBrowserProps {
  navTree: NavTree;
  selectedUrls: Set<string>;
  onSelectionChange: (urls: Set<string>) => void;
  processedUrls?: Record<string, SourceUrlStats>;
}

/** Collect all selectable (non-external, has model_json_url) leaf URLs from a node. */
function collectSelectableUrls(node: NavTreeNode): string[] {
  const urls: string[] = [];
  if (node.model_json_url && !node.is_external) {
    urls.push(node.model_json_url);
  }
  for (const child of node.children) {
    urls.push(...collectSelectableUrls(child));
  }
  return urls;
}

function collectSectionUrls(section: NavTreeSection): string[] {
  return section.nodes.flatMap(collectSelectableUrls);
}

// ── Node Component ──────────────────────────────────────────

function ProcessedBadge({ stats }: { stats: SourceUrlStats }) {
  return (
    <span
      title={`${stats.total_files} files: ${stats.approved} approved, ${stats.pending_review} pending, ${stats.rejected} rejected`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 10,
        fontWeight: 600,
        padding: "1px 7px",
        borderRadius: 10,
        background: "#ecfdf5",
        color: "#059669",
        border: "1px solid #a7f3d0",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#059669" }} />
      {stats.total_files} file{stats.total_files !== 1 ? "s" : ""}
      {stats.approved > 0 && (
        <span style={{ color: "#16a34a" }}>{stats.approved} in KB</span>
      )}
    </span>
  );
}

function TreeNode({
  node,
  depth,
  selectedUrls,
  onToggle,
  processedUrls,
}: {
  node: NavTreeNode;
  depth: number;
  selectedUrls: Set<string>;
  onToggle: (url: string) => void;
  processedUrls?: Record<string, SourceUrlStats>;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const hasChildren = node.children.length > 0;
  const isSelectable = !!node.model_json_url && !node.is_external;

  const childUrls = useMemo(() => collectSelectableUrls(node), [node]);
  const selectedCount = childUrls.filter((u) => selectedUrls.has(u)).length;

  const handleGroupToggle = useCallback(() => {
    if (selectedCount === childUrls.length) {
      // Deselect all
      for (const u of childUrls) onToggle(u);
    } else {
      // Select all unselected
      for (const u of childUrls) {
        if (!selectedUrls.has(u)) onToggle(u);
      }
    }
  }, [childUrls, selectedCount, selectedUrls, onToggle]);

  const checkState =
    selectedCount === 0
      ? "none"
      : selectedCount === childUrls.length
        ? "all"
        : "some";

  const CheckIcon =
    checkState === "all"
      ? CheckSquare
      : checkState === "some"
        ? MinusSquare
        : Square;

  return (
    <div style={{ marginLeft: depth > 0 ? 16 : 0 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 6px",
          borderRadius: 6,
          cursor: hasChildren ? "pointer" : "default",
          fontSize: 13,
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.background = "var(--surface, #f8f8fa)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.background = "transparent";
        }}
      >
        {/* Expand toggle */}
        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              color: "var(--foreground-muted, #6b7280)",
              display: "flex",
            }}
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span style={{ width: 14 }} />
        )}

        {/* Checkbox */}
        {childUrls.length > 0 && (
          <button
            onClick={hasChildren ? handleGroupToggle : () => isSelectable && onToggle(node.model_json_url!)}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              color: checkState !== "none" ? "#7c3aed" : "var(--foreground-muted, #9ca3af)",
              display: "flex",
            }}
          >
            <CheckIcon size={16} />
          </button>
        )}

        {/* Label */}
        <span
          style={{
            flex: 1,
            fontWeight: hasChildren && depth === 0 ? 600 : 400,
            color: node.is_external
              ? "var(--foreground-muted, #9ca3af)"
              : "var(--foreground, #111)",
          }}
          onClick={() => {
            if (hasChildren) setExpanded(!expanded);
            else if (isSelectable) onToggle(node.model_json_url!);
          }}
        >
          {node.label}
        </span>

        {/* Processed badge */}
        {node.model_json_url && processedUrls?.[node.model_json_url] && (
          <ProcessedBadge stats={processedUrls[node.model_json_url]} />
        )}

        {/* URL path hint */}
        {node.url && !hasChildren && (
          <span
            style={{
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              color: "var(--foreground-muted, #9ca3af)",
              maxWidth: 200,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {node.url}
          </span>
        )}

        {/* External icon */}
        {node.is_external && (
          <ExternalLink
            size={12}
            style={{ color: "var(--foreground-muted, #9ca3af)" }}
          />
        )}

        {/* Child count badge */}
        {hasChildren && (
          <span
            style={{
              fontSize: 10,
              background: "var(--surface, #f3f4f6)",
              color: "var(--foreground-muted, #6b7280)",
              padding: "1px 6px",
              borderRadius: 10,
              fontWeight: 500,
            }}
          >
            {childUrls.length}
          </span>
        )}
      </div>

      {/* Children */}
      {expanded &&
        hasChildren &&
        node.children.map((child, i) => (
          <TreeNode
            key={`${child.label}-${i}`}
            node={child}
            depth={depth + 1}
            selectedUrls={selectedUrls}
            onToggle={onToggle}
            processedUrls={processedUrls}
          />
        ))}
    </div>
  );
}

// ── Section Component ───────────────────────────────────────

function TreeSection({
  section,
  selectedUrls,
  onToggle,
  processedUrls,
}: {
  section: NavTreeSection;
  selectedUrls: Set<string>;
  onToggle: (url: string) => void;
  processedUrls?: Record<string, SourceUrlStats>;
}) {
  const [expanded, setExpanded] = useState(true);
  const allUrls = useMemo(() => collectSectionUrls(section), [section]);
  const selectedCount = allUrls.filter((u) => selectedUrls.has(u)).length;

  const handleSelectAll = useCallback(() => {
    if (selectedCount === allUrls.length) {
      for (const u of allUrls) onToggle(u);
    } else {
      for (const u of allUrls) {
        if (!selectedUrls.has(u)) onToggle(u);
      }
    }
  }, [allUrls, selectedCount, selectedUrls, onToggle]);

  const checkState =
    selectedCount === 0 ? "none" : selectedCount === allUrls.length ? "all" : "some";
  const CheckIcon =
    checkState === "all" ? CheckSquare : checkState === "some" ? MinusSquare : Square;

  const processedCount = processedUrls
    ? allUrls.filter((u) => processedUrls[u]).length
    : 0;

  return (
    <div
      style={{
        border: "1px solid var(--border, #e5e7eb)",
        borderRadius: 10,
        overflow: "hidden",
        marginBottom: 12,
      }}
    >
      {/* Section header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 14px",
          background: "var(--surface, #f8f8fa)",
          borderBottom: expanded ? "1px solid var(--border, #e5e7eb)" : "none",
          cursor: "pointer",
        }}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}

        <button
          onClick={(e) => {
            e.stopPropagation();
            handleSelectAll();
          }}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            color: checkState !== "none" ? "#7c3aed" : "var(--foreground-muted, #9ca3af)",
            display: "flex",
          }}
        >
          <CheckIcon size={16} />
        </button>

        <span style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>
          {section.section_name}
        </span>

        {processedCount > 0 && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: "1px 8px",
              borderRadius: 10,
              background: "#ecfdf5",
              color: "#059669",
              border: "1px solid #a7f3d0",
            }}
          >
            {processedCount}/{allUrls.length} processed
          </span>
        )}

        <span
          style={{
            fontSize: 12,
            color: selectedCount > 0 ? "#7c3aed" : "var(--foreground-muted, #6b7280)",
            fontWeight: 500,
          }}
        >
          {selectedCount}/{allUrls.length} selected
        </span>
      </div>

      {/* Section body */}
      {expanded && (
        <div style={{ padding: "8px 8px 8px 4px" }}>
          {section.nodes.map((node, i) => (
            <TreeNode
              key={`${node.label}-${i}`}
              node={node}
              depth={0}
              selectedUrls={selectedUrls}
              onToggle={onToggle}
              processedUrls={processedUrls}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────

export default function NavTreeBrowser({
  navTree,
  selectedUrls,
  onSelectionChange,
  processedUrls,
}: NavTreeBrowserProps) {
  const handleToggle = useCallback(
    (url: string) => {
      const next = new Set(selectedUrls);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      onSelectionChange(next);
    },
    [selectedUrls, onSelectionChange],
  );

  const totalSelectable = navTree.sections.reduce(
    (sum, s) => sum + collectSectionUrls(s).length,
    0,
  );

  const totalProcessed = processedUrls ? Object.keys(processedUrls).length : 0;
  const totalFilesInKb = processedUrls
    ? Object.values(processedUrls).reduce((sum, s) => sum + s.total_files, 0)
    : 0;

  return (
    <div>
      {/* Summary bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: totalProcessed > 0 ? 8 : 12,
          padding: "8px 12px",
          background: selectedUrls.size > 0 ? "#f3f0ff" : "var(--surface, #f8f8fa)",
          borderRadius: 8,
          fontSize: 13,
        }}
      >
        <span>
          <strong>{totalSelectable}</strong> pages found across{" "}
          {navTree.sections.length} sections
        </span>
        <span
          style={{
            color: "#7c3aed",
            fontWeight: 600,
          }}
        >
          {selectedUrls.size} selected
        </span>
      </div>

      {/* Processed URLs summary */}
      {totalProcessed > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 12,
            padding: "8px 12px",
            background: "#ecfdf5",
            border: "1px solid #a7f3d0",
            borderRadius: 8,
            fontSize: 12,
            color: "#065f46",
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#059669", flexShrink: 0 }} />
          <span>
            <strong>{totalProcessed}</strong> of {totalSelectable} pages already processed
            ({totalFilesInKb} files in KB)
          </span>
        </div>
      )}

      {/* Sections */}
      {navTree.sections.map((section, i) => (
        <TreeSection
          key={`${section.section_name}-${i}`}
          section={section}
          selectedUrls={selectedUrls}
          onToggle={handleToggle}
          processedUrls={processedUrls}
        />
      ))}
    </div>
  );
}
