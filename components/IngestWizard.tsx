"use client";

import { useState, useCallback, useRef } from "react";
import { X, Globe, ArrowRight, Loader2, Zap, FileText, MapPin, Tag, Upload, Trash2, Link2, CheckCircle2, AlertCircle } from "lucide-react";
import { fetchNavTree, startIngestion, lookupProcessedUrls } from "@/lib/api";
import type { NavTree, NavTreeNode, SourceUrlStats } from "@/lib/types";
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
  const [processedUrls, setProcessedUrls] = useState<Record<string, SourceUrlStats>>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ── Custom model.json link (2-step reveal) ──────────────── */
  const [showCustomLink, setShowCustomLink] = useState(false);
  const [customModelUrl, setCustomModelUrl] = useState("");
  const [customUrlError, setCustomUrlError] = useState<string | null>(null);
  const [customUrlValid, setCustomUrlValid] = useState(false);

  const validateModelJsonUrl = useCallback((url: string) => {
    if (!url.trim()) {
      setCustomUrlError(null);
      setCustomUrlValid(false);
      return;
    }
    try {
      const parsed = new URL(url.trim());
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        setCustomUrlError("URL must start with http:// or https://");
        setCustomUrlValid(false);
        return;
      }
      if (!url.trim().endsWith(".model.json")) {
        setCustomUrlError("URL must end with .model.json");
        setCustomUrlValid(false);
        return;
      }
      setCustomUrlError(null);
      setCustomUrlValid(true);
    } catch {
      setCustomUrlError("Please enter a valid URL");
      setCustomUrlValid(false);
    }
  }, []);

  const handleCustomModelUrlChange = useCallback(
    (value: string) => {
      setCustomModelUrl(value);
      validateModelJsonUrl(value);
    },
    [validateModelJsonUrl],
  );

  /* ── Document upload (local-only, no backend wiring yet) ──── */
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const ACCEPTED_TYPES = [
    "application/pdf",
    "text/plain",
    "text/markdown",
    "text/csv",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  const ACCEPTED_EXTENSIONS = [".pdf", ".txt", ".md", ".csv", ".doc", ".docx"];

  const isAcceptedFile = (file: File) => {
    if (ACCEPTED_TYPES.includes(file.type)) return true;
    return ACCEPTED_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext));
  };

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const valid = Array.from(incoming).filter(isAcceptedFile);
    if (valid.length === 0) return;
    setUploadedFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      return [...prev, ...valid.filter((f) => !names.has(f.name))];
    });
  }, []);

  const removeFile = useCallback((name: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.name !== name));
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleLoadNavFromUrl = useCallback(async (url: string) => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    try {
      // Ensure URL ends with .model.json
      let finalUrl = url.trim();
      if (!finalUrl.endsWith(".model.json")) {
        finalUrl = finalUrl.replace(/\/$/, "") + ".model.json";
      }
      setRootUrl(finalUrl);
      const tree = await fetchNavTree(finalUrl);
      setNavTree(tree);
      setSelectedUrls(new Set());

      // Collect all model_json_urls from the tree and look up which are already processed
      const allUrls: string[] = [];
      for (const section of tree.sections) {
        for (const node of section.nodes) {
          (function collect(n: NavTreeNode) {
            if (n.model_json_url && !n.is_external) allUrls.push(n.model_json_url);
            n.children.forEach(collect);
          })(node);
        }
      }
      if (allUrls.length > 0) {
        try {
          const lookup = await lookupProcessedUrls(allUrls);
          setProcessedUrls(lookup.sources);
        } catch {
          // Non-critical — silently ignore lookup failures
          setProcessedUrls({});
        }
      }

      setStep("browse");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load navigation tree");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLoadNav = useCallback(async () => {
    handleLoadNavFromUrl(rootUrl);
  }, [rootUrl, handleLoadNavFromUrl]);

  const handleUseCustomLink = useCallback(() => {
    if (!customUrlValid) return;
    setRootUrl(customModelUrl.trim());
    setShowCustomLink(false);
    handleLoadNavFromUrl(customModelUrl.trim());
  }, [customUrlValid, customModelUrl, handleLoadNavFromUrl]);

  /** Directly ingest the custom model.json URL as a single source — skips nav tree entirely. */
  const handleDirectIngest = useCallback(async () => {
    if (!customUrlValid) return;
    const url = customModelUrl.trim();
    setSubmitting(true);
    setError(null);
    try {
      const result = await startIngestion({ urls: [url] });
      onComplete?.();
      onClose();
      const firstSourceId = result?.jobs?.[0]?.source_id;
      if (firstSourceId) {
        router.push(`/sources/${firstSourceId}?tab=jobs`);
      } else {
        router.push("/sources");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Direct ingestion failed");
    } finally {
      setSubmitting(false);
    }
  }, [customUrlValid, customModelUrl, onClose, onComplete, router]);

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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ingestion failed");
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

              {/* ── Custom model.json Link (2-step reveal) ──── */}
              <div style={{ marginTop: 16 }}>
                {!showCustomLink ? (
                  <button
                    onClick={() => setShowCustomLink(true)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: "1px dashed var(--border, #e5e7eb)",
                      background: "var(--background, #fff)",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 500,
                      color: "#7c3aed",
                      textAlign: "left",
                      transition: "border-color 0.15s, background 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#7c3aed";
                      e.currentTarget.style.background = "#faf5ff";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--border, #e5e7eb)";
                      e.currentTarget.style.background = "var(--background, #fff)";
                    }}
                  >
                    <Link2 size={14} style={{ flexShrink: 0 }} />
                    <span>Paste your own model.json link</span>
                  </button>
                ) : (
                  <div
                    style={{
                      padding: "14px 16px",
                      borderRadius: 12,
                      border: "1px solid #ede9fe",
                      background: "#faf5ff",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 10,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Link2 size={14} style={{ color: "#7c3aed" }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
                          Custom model.json URL
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          setShowCustomLink(false);
                          setCustomModelUrl("");
                          setCustomUrlError(null);
                          setCustomUrlValid(false);
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: 2,
                          color: "#9ca3af",
                          display: "flex",
                        }}
                        aria-label="Close custom link input"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    <div style={{ display: "flex", gap: 8 }}>
                      <div
                        style={{
                          flex: 1,
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          border: `1px solid ${customUrlError ? "#fca5a5" : customUrlValid ? "#86efac" : "#e5e7eb"}`,
                          borderRadius: 8,
                          padding: "8px 12px",
                          background: "#fff",
                          transition: "border-color 0.15s",
                        }}
                      >
                        <Globe size={14} style={{ color: "#9ca3af", flexShrink: 0 }} />
                        <input
                          type="text"
                          value={customModelUrl}
                          onChange={(e) => handleCustomModelUrlChange(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleDirectIngest()}
                          placeholder="https://example.com/page.model.json"
                          autoFocus
                          style={{
                            flex: 1,
                            border: "none",
                            outline: "none",
                            fontSize: 13,
                            fontFamily: "var(--font-mono)",
                            background: "transparent",
                          }}
                        />
                        {customUrlValid && (
                          <CheckCircle2 size={14} style={{ color: "#22c55e", flexShrink: 0 }} />
                        )}
                        {customUrlError && (
                          <AlertCircle size={14} style={{ color: "#ef4444", flexShrink: 0 }} />
                        )}
                      </div>
                    </div>

                    {customUrlError && (
                      <div style={{ fontSize: 11, color: "#ef4444", marginTop: 6 }}>
                        {customUrlError}
                      </div>
                    )}
                    {!customUrlError && (
                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>
                        Paste a direct .model.json URL to ingest it as a source or browse its navigation
                      </div>
                    )}

                    {/* Two explicit CTAs */}
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                      <button
                        onClick={handleDirectIngest}
                        disabled={!customUrlValid || submitting || loading}
                        style={{
                          flex: 1,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          padding: "9px 14px",
                          borderRadius: 8,
                          border: "none",
                          background: customUrlValid ? "#7c3aed" : "#d1d5db",
                          color: "#fff",
                          fontWeight: 600,
                          fontSize: 13,
                          cursor: !customUrlValid || submitting || loading ? "not-allowed" : "pointer",
                          transition: "background 0.15s, opacity 0.15s",
                          opacity: !customUrlValid || submitting || loading ? 0.6 : 1,
                        }}
                      >
                        {submitting ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Zap size={14} />
                        )}
                        {submitting ? "Ingesting..." : "Ingest Directly"}
                      </button>
                      <button
                        onClick={handleUseCustomLink}
                        disabled={!customUrlValid || loading || submitting}
                        style={{
                          flex: 1,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          padding: "9px 14px",
                          borderRadius: 8,
                          border: "1px solid var(--border, #e5e7eb)",
                          background: "var(--background, #fff)",
                          color: customUrlValid ? "#111827" : "#9ca3af",
                          fontWeight: 600,
                          fontSize: 13,
                          cursor: !customUrlValid || loading || submitting ? "not-allowed" : "pointer",
                          transition: "border-color 0.15s, opacity 0.15s",
                          opacity: !customUrlValid || loading || submitting ? 0.6 : 1,
                        }}
                      >
                        {loading ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <ArrowRight size={14} />
                        )}
                        {loading ? "Loading..." : "Load Navigation"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Document Upload Section ──────────────── */}
              <div
                style={{
                  marginTop: 24,
                  paddingTop: 20,
                  borderTop: "1px solid var(--border, #e5e7eb)",
                }}
              >
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--foreground, #111)",
                    marginBottom: 4,
                  }}
                >
                  Or upload documents
                </p>
                <p
                  style={{
                    fontSize: 12,
                    color: "var(--foreground-muted, #9ca3af)",
                    marginBottom: 12,
                  }}
                >
                  Supported formats: PDF, TXT, Markdown, CSV, DOC, DOCX
                </p>

                {/* Drop zone */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: `2px dashed ${dragOver ? "#7c3aed" : "#e5e7eb"}`,
                    borderRadius: 12,
                    padding: "24px 16px",
                    textAlign: "center",
                    cursor: "pointer",
                    background: dragOver ? "#faf5ff" : "var(--background, #fff)",
                    transition: "border-color 0.15s, background 0.15s",
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label="Upload documents"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                >
                  <Upload
                    size={24}
                    style={{
                      color: dragOver ? "#7c3aed" : "#9ca3af",
                      marginBottom: 8,
                    }}
                  />
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: dragOver ? "#7c3aed" : "#6b7280",
                    }}
                  >
                    Drop files here or click to browse
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={ACCEPTED_EXTENSIONS.join(",")}
                    style={{ display: "none" }}
                    onChange={(e) => {
                      if (e.target.files) addFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </div>

                {/* File list */}
                {uploadedFiles.length > 0 && (
                  <div
                    style={{
                      marginTop: 12,
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    {uploadedFiles.map((file) => (
                      <div
                        key={file.name}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "8px 12px",
                          background: "#f9fafb",
                          borderRadius: 8,
                          border: "1px solid #e5e7eb",
                        }}
                      >
                        <FileText
                          size={15}
                          style={{ color: "#7c3aed", flexShrink: 0 }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: "#111827",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {file.name}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: "#9ca3af",
                            }}
                          >
                            {formatSize(file.size)}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile(file.name);
                          }}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: 4,
                            color: "#9ca3af",
                            borderRadius: 4,
                            display: "flex",
                          }}
                          aria-label={`Remove ${file.name}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Browse & Select */}
          {step === "browse" && navTree && (
            <NavTreeBrowser
              navTree={navTree}
              selectedUrls={selectedUrls}
              onSelectionChange={setSelectedUrls}
              processedUrls={processedUrls}
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
