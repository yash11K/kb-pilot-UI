"use client";

import { useState, useCallback } from "react";
import { X, Globe, ArrowRight, Loader2, Zap } from "lucide-react";
import { fetchNavTree, startIngestion } from "@/lib/api";
import type { NavTree, NavTreeNode } from "@/lib/types";
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

      await startIngestion({
        urls,
        nav_root_url: rootUrl,
        nav_metadata: filteredMeta,
      });

      onComplete?.();
      onClose();
      router.push("/sources");
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
          width: step === "url" ? 520 : 720,
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
            </div>
          )}

          {/* Step 2: Browse & Select */}
          {step === "browse" && navTree && (
            <NavTreeBrowser
              navTree={navTree}
              selectedUrls={selectedUrls}
              onSelectionChange={setSelectedUrls}
            />
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
            {step === "browse" && (
              <button
                onClick={() => setStep("url")}
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
                onClick={handleIngest}
                disabled={selectedUrls.size === 0 || submitting}
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
                  cursor:
                    selectedUrls.size === 0 || submitting
                      ? "not-allowed"
                      : "pointer",
                  opacity: selectedUrls.size === 0 || submitting ? 0.6 : 1,
                }}
              >
                {submitting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Zap size={14} />
                )}
                Ingest {selectedUrls.size} Page{selectedUrls.size !== 1 ? "s" : ""}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
