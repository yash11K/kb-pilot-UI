"use client";

import { useState, useCallback } from "react";
import { X, Globe, ArrowRight, Loader2, Zap, FileText, MapPin, Tag } from "lucide-react";
import { fetchNavTree, startIngestion } from "@/lib/api";
import type { NavTree, NavTreeNode, NavTreeSection } from "@/lib/types";
import NavTreeBrowser from "@/components/NavTreeBrowser";
import { useRouter } from "next/navigation";

interface IngestWizardProps {
  onClose: () => void;
  onComplete?: () => void;
}

/** Recursively collect {url -> {label, section}} from the nav tree for source enrichment. */
function buildNavMetadata(
  navTree: NavTree,
): Record<string, { label: string; section: string; page_path?: string }> {
  const meta: Record<string, { label: string; section: string; page_path?: string }> = {};

  function walk(node: NavTreeNode, sectionName: string) {
    if (node.model_json_url && !node.is_external) {
      meta[node.model_json_url] = {
        label: node.label,
        section: sectionName,
        page_path: node.url || undefined,
      };
    }
    for (const child of node.children) {
      walk(child, sectionName);
    }
  }

  for (const section of navTree.sections) {
    for (const node of section.nodes) {
      walk(node, section.section_name);
    }
  }

  return meta;
}

/** Collect every model_json_url already present anywhere in the tree. */
function collectAllTreeUrls(tree: NavTree): Set<string> {
  const seen = new Set<string>();
  function walk(node: NavTreeNode) {
    if (node.model_json_url) seen.add(node.model_json_url);
    for (const child of node.children) walk(child);
  }
  for (const section of tree.sections) {
    for (const node of section.nodes) walk(node);
  }
  return seen;
}

/** Deep-clone a NavTree, injecting discovered children into the node matching targetUrl.
 *  Filters out any URLs already present anywhere in the tree to prevent circular references. */
function injectChildrenIntoTree(
  tree: NavTree,
  targetUrl: string,
  discoveredSections: NavTreeSection[],
): NavTree {
  // Flatten all discovered nodes from all sections into children
  const discoveredNodes: NavTreeNode[] = discoveredSections.flatMap((s) => s.nodes);

  // Collect all URLs already in the entire tree — prevents circular back-links
  const allExistingUrls = collectAllTreeUrls(tree);

  function mergeNode(node: NavTreeNode): NavTreeNode {
    if (node.model_json_url === targetUrl) {
      const newChildren = discoveredNodes
        .flatMap((dn) => (dn.children.length > 0 ? dn.children : [dn]))
        .filter((c) => c.model_json_url && !allExistingUrls.has(c.model_json_url));
      return { ...node, children: [...node.children, ...newChildren] };
    }
    if (node.children.length > 0) {
      return { ...node, children: node.children.map(mergeNode) };
    }
    return node;
  }

  return {
    ...tree,
    sections: tree.sections.map((s) => ({
      ...s,
      nodes: s.nodes.map(mergeNode),
    })),
  };
}

type Step = "url" | "browse" | "confirm";

export default function IngestWizard({ onClose, onComplete }: IngestWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("url");
  const [rootUrl, setRootUrl] = useState("");
  const [navTree, setNavTree] = useState<NavTree | null>(null);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLoadNav = useCallback(async () => {
    if (!rootUrl.trim()) return;
    setLoading(true);
    setError(null);
    try {
      // Ensure URL ends with .model.json
      let url = rootUrl.trim();
      if (!url.endsWith(".model.json")) {
        url = url.replace(/\/$/, "") + ".model.json";
      }
      setRootUrl(url);
      const tree = await fetchNavTree(url);
      setNavTree(tree);
      setSelectedUrls(new Set());
      setStep("browse");
    } catch (err: any) {
      setError(err.message || "Failed to load navigation tree");
    } finally {
      setLoading(false);
    }
  }, [rootUrl]);

  const handleExplore = useCallback(
    async (modelJsonUrl: string) => {
      const subTree = await fetchNavTree(modelJsonUrl);
      if (subTree.sections.length > 0 && navTree) {
        setNavTree(injectChildrenIntoTree(navTree, modelJsonUrl, subTree.sections));
      }
    },
    [navTree],
  );

  const handleIngest = useCallback(async () => {
    if (!navTree || selectedUrls.size === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const urls = Array.from(selectedUrls);
      const navMetadata = buildNavMetadata(navTree);
      // Filter metadata to only include selected URLs
      const filteredMeta: Record<string, { label?: string; section?: string; page_path?: string }> = {};
      for (const u of urls) {
        if (navMetadata[u]) filteredMeta[u] = navMetadata[u];
      }

      const result = await startIngestion({
        urls,
        nav_root_url: rootUrl,
        nav_metadata: filteredMeta,
      });

      onComplete?.();
      onClose();
      const firstSourceId = result?.jobs?.[0]?.source_id;
      if (firstSourceId) {
        router.push(`/sources/${firstSourceId}?tab=jobs`);
      } else {
        router.push("/sources");
      }
    } catch (err: any) {
      setError(err.message || "Ingestion failed");
    } finally {
      setSubmitting(false);
    }
  }, [navTree, selectedUrls, rootUrl, onClose, onComplete, router]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.5)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "var(--background, #fff)",
          borderRadius: 16,
          width: step === "browse" ? 720 : 520,
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px rgba(0,0,0,0.15)",
          transition: "width 0.2s ease",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 24px 14px",
            borderBottom: "1px solid var(--border, #e5e7eb)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Zap size={18} style={{ color: "#7c3aed" }} />
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
              {step === "url" && "New Ingestion"}
              {step === "browse" && "Select Pages to Ingest"}
              {step === "confirm" && "Confirm Ingestion"}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 4,
              color: "var(--foreground-muted, #6b7280)",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Step indicator */}
        <div
          style={{
            display: "flex",
            gap: 4,
            padding: "12px 24px",
            borderBottom: "1px solid var(--border, #e5e7eb)",
          }}
        >
          {(["url", "browse", "confirm"] as Step[]).map((s, i) => (
            <div
              key={s}
              style={{
                flex: 1,
                height: 3,
                borderRadius: 2,
                background:
                  s === step
                    ? "#7c3aed"
                    : (["url", "browse", "confirm"] as Step[]).indexOf(step) > i
                      ? "#c4b5fd"
                      : "var(--border, #e5e7eb)",
                transition: "background 0.2s",
              }}
            />
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>
          {/* Step 1: Enter URL */}
          {step === "url" && (
            <div>
              <p
                style={{
                  fontSize: 13,
                  color: "var(--foreground-muted, #6b7280)",
                  marginBottom: 16,
                }}
              >
                Enter the home page URL to load the site navigation. The
                navigation tree will mirror the site&apos;s menu structure so
                you can select which pages to ingest.
              </p>

              <div style={{ display: "flex", gap: 8 }}>
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    border: "1px solid var(--border, #e5e7eb)",
                    borderRadius: 10,
                    padding: "10px 14px",
                  }}
                >
                  <Globe size={16} style={{ color: "var(--foreground-muted, #9ca3af)", flexShrink: 0 }} />
                  <input
                    type="text"
                    value={rootUrl}
                    onChange={(e) => setRootUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleLoadNav()}
                    placeholder="https://www.avis.com/en/home"
                    style={{
                      flex: 1,
                      border: "none",
                      outline: "none",
                      fontSize: 14,
                      fontFamily: "var(--font-mono)",
                      background: "transparent",
                    }}
                  />
                </div>
                <button
                  onClick={handleLoadNav}
                  disabled={loading || !rootUrl.trim()}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "10px 18px",
                    borderRadius: 10,
                    border: "none",
                    background: "#7c3aed",
                    color: "#fff",
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: loading || !rootUrl.trim() ? "not-allowed" : "pointer",
                    opacity: loading || !rootUrl.trim() ? 0.6 : 1,
                  }}
                >
                  {loading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <ArrowRight size={16} />
                  )}
                  {loading ? "Loading..." : "Load Navigation"}
                </button>
              </div>

              {/* Default suggestion */}
              <div style={{ marginTop: 16 }}>
                <p
                  style={{
                    fontSize: 12,
                    color: "var(--foreground-muted, #9ca3af)",
                    marginBottom: 8,
                  }}
                >
                  Or choose from below
                </p>
                <button
                  onClick={() =>
                    setRootUrl("https://www.avis.com/en/home.model.json")
                  }
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1px solid var(--border, #e5e7eb)",
                    background: "var(--background, #fff)",
                    cursor: "pointer",
                    fontSize: 13,
                    fontFamily: "var(--font-mono)",
                    color: "var(--foreground, #111)",
                    textAlign: "left",
                    transition: "border-color 0.15s, background 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#7c3aed";
                    e.currentTarget.style.background = "#f5f3ff";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border, #e5e7eb)";
                    e.currentTarget.style.background = "var(--background, #fff)";
                  }}
                >
                  <Globe size={14} style={{ color: "#7c3aed", flexShrink: 0 }} />
                  <span>avis.com/en/home.model.json</span>
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Browse & Select */}
          {step === "browse" && navTree && (
            <NavTreeBrowser
              navTree={navTree}
              selectedUrls={selectedUrls}
              onSelectionChange={setSelectedUrls}
              onExplore={handleExplore}
            />
          )}

          {/* Step 3: Confirm */}
          {step === "confirm" && navTree && (
            <div>
              <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>
                Review the details below before starting ingestion.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "#faf5ff", borderRadius: 12, border: "1px solid #ede9fe" }}>
                  <FileText size={18} color="#7c3aed" style={{ flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 500 }}>Pages to ingest</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>
                      {selectedUrls.size} page{selectedUrls.size !== 1 ? "s" : ""}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "#f9fafb", borderRadius: 12, border: "1px solid #e5e7eb" }}>
                  <Globe size={18} color="#6b7280" style={{ flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 500 }}>Root URL</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", fontFamily: "'DM Mono', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {rootUrl}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "#f9fafb", borderRadius: 12, border: "1px solid #e5e7eb" }}>
                    <Tag size={18} color="#6b7280" style={{ flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 500 }}>Brand</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{navTree.brand || "—"}</div>
                    </div>
                  </div>
                  <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "#f9fafb", borderRadius: 12, border: "1px solid #e5e7eb" }}>
                    <MapPin size={18} color="#6b7280" style={{ flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 500 }}>Region</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{navTree.region || "—"}</div>
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
                  Sections: {navTree.sections.map((s) => s.section_name).join(", ") || "—"}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              margin: "0 24px 12px",
              padding: "10px 14px",
              background: "#fef2f2",
              color: "#dc2626",
              borderRadius: 8,
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "14px 24px",
            borderTop: "1px solid var(--border, #e5e7eb)",
          }}
        >
          <div>
            {(step === "browse" || step === "confirm") && (
              <button
                onClick={() => setStep(step === "confirm" ? "browse" : "url")}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "1px solid var(--border, #e5e7eb)",
                  background: "var(--background, #fff)",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                Back
              </button>
            )}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={onClose}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid var(--border, #e5e7eb)",
                background: "var(--background, #fff)",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Cancel
            </button>
            {step === "browse" && (
              <button
                onClick={() => setStep("confirm")}
                disabled={selectedUrls.size === 0}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 20px",
                  borderRadius: 8,
                  border: "none",
                  background: "#7c3aed",
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: selectedUrls.size === 0 ? "not-allowed" : "pointer",
                  opacity: selectedUrls.size === 0 ? 0.6 : 1,
                }}
              >
                <ArrowRight size={14} />
                Review {selectedUrls.size} Page{selectedUrls.size !== 1 ? "s" : ""}
              </button>
            )}
            {step === "confirm" && (
              <button
                onClick={handleIngest}
                disabled={submitting}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 20px",
                  borderRadius: 8,
                  border: "none",
                  background: "#7c3aed",
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: submitting ? "not-allowed" : "pointer",
                  opacity: submitting ? 0.6 : 1,
                }}
              >
                {submitting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Zap size={14} />
                )}
                {submitting ? "Starting..." : "Confirm & Ingest"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
