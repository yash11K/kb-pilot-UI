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
import type { NavTree, NavTreeNode, NavTreeSection } from "@/lib/types";

interface NavTreeBrowserProps {
  navTree: NavTree;
  selectedUrls: Set<string>;
  onSelectionChange: (urls: Set<string>) => void;
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

function TreeNode({
  node,
  depth,
  selectedUrls,
  onToggle,
}: {
  node: NavTreeNode;
  depth: number;
  selectedUrls: Set<string>;
  onToggle: (url: string) => void;
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

        {/* URL path hint */}
        {node.url && !hasChildren && (
          <span
            style={{
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              color: "var(--foreground-muted, #9ca3af)",
              maxWidth: 260,
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
}: {
  section: NavTreeSection;
  selectedUrls: Set<string>;
  onToggle: (url: string) => void;
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

  return (
    <div>
      {/* Summary bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
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

      {/* Sections */}
      {navTree.sections.map((section, i) => (
        <TreeSection
          key={`${section.section_name}-${i}`}
          section={section}
          selectedUrls={selectedUrls}
          onToggle={handleToggle}
        />
      ))}
    </div>
  );
}
