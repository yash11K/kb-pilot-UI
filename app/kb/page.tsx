"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Search, Sparkles, Send, Loader2, X, RotateCw, ChevronDown, ChevronRight, FileText, Copy, Check, Download } from "lucide-react";
import ScorePill from "@/components/ScorePill";
import MdPreview from "@/components/MdPreview";
import { kbSearch, kbChat, getSourceDownloadUrl } from "@/lib/api";

type Mode = "retrieve" | "generate";

interface ParsedResult {
  content: string;
  score: number;
  source_url?: string;
}

function parseSearchResult(raw: Record<string, unknown>): ParsedResult {
  const content = (raw.content as string) || "";
  let sourceUrl = "";
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (fmMatch) {
    const srcMatch = fmMatch[1].match(/^source_url:\s*(.+)$/m);
    if (srcMatch) sourceUrl = srcMatch[1].trim();
  }
  if (!sourceUrl && raw.s3_uri) sourceUrl = raw.s3_uri as string;

  return {
    content,
    score: (raw.score as number) ?? 0,
    source_url: sourceUrl || undefined,
  };
}

const SUGGESTIONS = [
  "Can I smoke in my rental car?",
  "What is the pet policy?",
  "How do I extend my rental?",
  "What happens if I return the car late?",
];

/** Source citation from /kb/chat `sources` event */
interface ChatSource {
  s3_uri: string;
  content: string;
}

interface ChatEntry {
  role: "user" | "assistant";
  content: string;
  results?: ParsedResult[];
  /** Sources returned by RAG before the answer streams */
  sources?: ChatSource[];
}

export default function KBPage() {
  const [mode, setMode] = useState<Mode>("retrieve");
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const ctrlRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  const handleSend = useCallback(
    (overrideQuery?: string) => {
      const q = (overrideQuery ?? input).trim();
      if (!q || isStreaming) return;

      const userMsg: ChatEntry = { role: "user", content: q };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setError(null);
      setIsStreaming(true);

      if (mode === "retrieve") {
        const collected: ParsedResult[] = [];
        setMessages((prev) => [...prev, { role: "assistant", content: "", results: [] }]);

        ctrlRef.current = kbSearch(q, 10, {
          onSearchStart: (_query, _total) => {
            // Could show "Searching N documents…" here
          },
          onResult: (raw) => {
            collected.push(parseSearchResult(raw as unknown as Record<string, unknown>));
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last?.role === "assistant") {
                updated[updated.length - 1] = {
                  ...last,
                  content: `Found ${collected.length} result${collected.length !== 1 ? "s" : ""}`,
                  results: [...collected],
                };
              }
              return updated;
            });
            scrollToBottom();
          },
          onSearchEnd: () => {
            setIsStreaming(false);
          },
          onError: (err) => {
            setError(err.message);
            setIsStreaming(false);
          },
        });
      } else {
        // RAG mode: show empty assistant bubble, then populate sources → stream tokens → done
        setMessages((prev) => [...prev, { role: "assistant", content: "", sources: [] }]);

        ctrlRef.current = kbChat(q, 5, {
          onSources: (sources) => {
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last?.role === "assistant") {
                updated[updated.length - 1] = { ...last, sources };
              }
              return updated;
            });
            scrollToBottom();
          },
          onToken: (text) => {
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last?.role === "assistant") {
                updated[updated.length - 1] = { ...last, content: last.content + text };
              }
              return updated;
            });
            scrollToBottom();
          },
          onDone: () => {
            setIsStreaming(false);
          },
          onError: (err) => {
            setError(err.message);
            setIsStreaming(false);
          },
        });
      }
    },
    [input, isStreaming, mode, scrollToBottom],
  );

  const handleClear = () => {
    ctrlRef.current?.abort();
    setMessages([]);
    setError(null);
    setIsStreaming(false);
  };

  useEffect(() => { return () => ctrlRef.current?.abort(); }, []);

  const headline = mode === "retrieve" ? "Retrieve Only" : "Retrieve & Generate";
  const subtitle = mode === "retrieve"
    ? "Search the knowledge base and view matching chunks"
    : "Get AI-generated answers grounded in your knowledge base";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#fafafa" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes blink { 50% { opacity: 0; } }
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Header */}
      <div style={{ padding: "20px 32px 16px", background: "#fff", borderBottom: "1px solid #f3f4f6", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <div key={headline} style={{ display: "flex", alignItems: "center", gap: 10, animation: "fadeSlideIn 0.3s ease" }}>
              {mode === "retrieve" ? <Search size={22} color="#7c3aed" /> : <Sparkles size={22} color="#7c3aed" />}
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: 0 }}>{headline}</h2>
            </div>
            <p key={subtitle} style={{ fontSize: 13, color: "#9ca3af", margin: "4px 0 0 32px", animation: "fadeSlideIn 0.3s ease 0.05s both" }}>
              {subtitle}
            </p>
          </div>
          {messages.length > 0 && (
            <button onClick={handleClear} style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", fontSize: 12, fontWeight: 600, color: "#6b7280", cursor: "pointer" }}>
              <RotateCw size={12} /> Clear
            </button>
          )}
        </div>

        {/* Mode Toggle */}
        <div style={{ display: "inline-flex", background: "#f3f4f6", borderRadius: 10, padding: 3 }}>
          {(["retrieve", "generate"] as Mode[]).map((m) => {
            const active = mode === m;
            return (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  padding: "7px 18px", borderRadius: 8, border: "none",
                  background: active ? "#fff" : "transparent",
                  color: active ? "#7c3aed" : "#6b7280",
                  fontWeight: active ? 700 : 500, fontSize: 13,
                  cursor: "pointer", fontFamily: "inherit",
                  boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  transition: "all 0.2s ease",
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                {m === "retrieve" ? <Search size={13} /> : <Sparkles size={13} />}
                {m === "retrieve" ? "Retrieve" : "Retrieve & Generate"}
              </button>
            );
          })}
        </div>
      </div>

      {/* Messages Area */}
      <div ref={scrollRef} style={{ flex: 1, overflow: "auto", padding: "20px 32px" }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 24px", color: "#9ca3af" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>{mode === "retrieve" ? "🔍" : "✨"}</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>
              {mode === "retrieve" ? "Search your knowledge base" : "Ask anything about your content"}
            </div>
            <div style={{ fontSize: 13 }}>Type a question below or try one of the suggestions</div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", marginBottom: 16 }}>
            {msg.role === "user" ? (
              <div style={{ maxWidth: "70%", padding: "12px 18px", borderRadius: "16px 16px 4px 16px", background: "#7c3aed", color: "#fff", fontSize: 14, lineHeight: 1.6, wordBreak: "break-word" }}>
                {msg.content}
              </div>
            ) : msg.results && msg.results.length > 0 ? (
              /* Retrieve-only: numbered results in a single bubble */
              <div style={{ maxWidth: "90%", padding: "16px 20px", borderRadius: "16px 16px 16px 4px", background: "#fff", border: "1px solid #ede9fe", fontSize: 14, lineHeight: 1.7, color: "#111827", wordBreak: "break-word" }}>
                <div style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600, marginBottom: 12 }}>{msg.content}</div>
                {msg.results.map((r, ri) => (
                  <div key={ri} style={{ marginBottom: ri < msg.results!.length - 1 ? 16 : 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#7c3aed", flexShrink: 0 }}>{ri + 1}.</span>
                      <ScorePill score={r.score} />
                      {r.source_url && (
                        <span style={{ fontSize: 10, color: "#9ca3af", fontFamily: "'DM Mono', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                          {r.source_url}
                        </span>
                      )}
                    </div>
                    <div style={{ paddingLeft: 18 }}>
                      <MdPreview content={r.content} />
                    </div>
                    {ri < msg.results!.length - 1 && (
                      <div style={{ borderBottom: "1px solid #f3f4f6", margin: "12px 0 0" }} />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <RAGBubble
                msg={msg}
                isLast={i === messages.length - 1}
                isStreaming={isStreaming}
                mode={mode}
              />
            )}
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={{ margin: "0 32px 8px", padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, color: "#dc2626", fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Suggestions */}
      {messages.length === 0 && (
        <div style={{ padding: "0 32px 12px", display: "flex", gap: 8, flexWrap: "wrap" }}>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => { setInput(s); handleSend(s); }}
              style={{
                padding: "8px 14px", borderRadius: 20,
                border: "1px solid #ede9fe", background: "#fff",
                fontSize: 12, fontWeight: 500, color: "#7c3aed",
                cursor: "pointer", fontFamily: "inherit",
                transition: "all 0.15s", whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#f5f3ff"; e.currentTarget.style.borderColor = "#c4b5fd"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = "#ede9fe"; }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input Bar */}
      <div style={{ padding: "12px 32px 20px", background: "#fff", borderTop: "1px solid #f3f4f6", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, border: "1.5px solid #e5e7eb", borderRadius: 12, padding: "11px 16px", background: "#fff", transition: "border-color 0.15s" }}>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder={mode === "retrieve" ? "Search the knowledge base…" : "Ask a question…"}
              disabled={isStreaming}
              style={{ flex: 1, border: "none", outline: "none", fontSize: 14, fontFamily: "inherit", background: "transparent", color: "#111827" }}
            />
            {input && (
              <button onClick={() => setInput("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}>
                <X size={14} color="#9ca3af" />
              </button>
            )}
          </div>
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isStreaming}
            style={{
              padding: "11px 20px", borderRadius: 12, border: "none",
              background: "#7c3aed", color: "#fff", fontWeight: 600, fontSize: 14,
              cursor: !input.trim() || isStreaming ? "not-allowed" : "pointer",
              opacity: !input.trim() || isStreaming ? 0.6 : 1,
              display: "flex", alignItems: "center", gap: 6,
              transition: "opacity 0.15s",
            }}
          >
            {isStreaming ? <Loader2 size={16} style={{ animation: "spin 0.8s linear infinite" }} /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Source pill with expandable dropdown ── */

/** Extract the readable filename from an S3 URI, e.g. "pet-policy-for-rental-cars.md" */
function s3Filename(uri: string): string {
  const last = uri.split("/").pop() || uri;
  return decodeURIComponent(last);
}

function SourcePill({ index, source }: { index: number; source: ChatSource }) {
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const filename = s3Filename(source.s3_uri);

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    try {
      const url = await getSourceDownloadUrl(source.s3_uri);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.click();
    } catch {
      // silently fail — endpoint may not exist yet
    } finally {
      setDownloading(false);
    }
  }, [source.s3_uri, filename]);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "5px 12px", borderRadius: 16,
          border: "1px solid #ede9fe", background: open ? "#f5f3ff" : "#fff",
          fontSize: 11, fontWeight: 600, color: "#7c3aed",
          cursor: "pointer", fontFamily: "inherit",
          transition: "all 0.15s", maxWidth: 320,
        }}
      >
        <FileText size={11} style={{ flexShrink: 0 }} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          [{index + 1}] {filename}
        </span>
        {open ? <ChevronDown size={11} style={{ flexShrink: 0 }} /> : <ChevronRight size={11} style={{ flexShrink: 0 }} />}
      </button>
      {open && (
        <div style={{
          marginTop: 4, padding: "8px 12px",
          background: "#f5f3ff", border: "1px solid #ede9fe",
          borderRadius: 10, fontSize: 11, lineHeight: 1.5,
          color: "#6b7280", animation: "fadeSlideIn 0.15s ease",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{
              fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#9ca3af",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              flex: 1,
            }}>
              {source.s3_uri}
            </div>
            <button
              onClick={handleDownload}
              disabled={downloading}
              title="Download source file"
              style={{
                display: "flex", alignItems: "center", gap: 4,
                padding: "3px 8px", borderRadius: 6,
                border: "1px solid #ede9fe", background: "#fff",
                fontSize: 10, fontWeight: 600, color: "#7c3aed",
                cursor: downloading ? "default" : "pointer",
                opacity: downloading ? 0.5 : 1,
                flexShrink: 0, fontFamily: "inherit",
                transition: "all 0.15s",
              }}
            >
              {downloading
                ? <Loader2 size={10} style={{ animation: "spin 0.8s linear infinite" }} />
                : <Download size={10} />}
              Download
            </button>
          </div>
          {source.content && <div style={{ marginTop: 6 }}>{source.content}</div>}
        </div>
      )}
    </div>
  );
}

/* ── RAG answer bubble with source pills ── */

function RAGBubble({
  msg,
  isLast,
  isStreaming,
  mode,
}: {
  msg: ChatEntry;
  isLast: boolean;
  isStreaming: boolean;
  mode: Mode;
}) {
  const hasSources = msg.sources && msg.sources.length > 0;
  const isActiveStream = isStreaming && isLast;
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(msg.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [msg.content]);

  return (
    <div style={{ maxWidth: "85%", fontSize: 14, lineHeight: 1.7, color: "#111827", wordBreak: "break-word" }}>
      {/* Source pills row */}
      {hasSources && (
        <div style={{ marginBottom: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
          {msg.sources!.map((src, si) => (
            <SourcePill key={si} index={si} source={src} />
          ))}
        </div>
      )}

      {/* Answer bubble */}
      <div style={{
        padding: "14px 18px", background: "#fff",
        border: hasSources ? "1.5px solid #ede9fe" : "1px solid #f3f4f6",
        borderRadius: "16px 16px 16px 4px",
      }}>
        {msg.content ? (
          <>
            <MdPreview content={msg.content} />
            {isActiveStream && (
              <span style={{
                display: "inline-block", width: 6, height: 14,
                background: "#7c3aed", borderRadius: 1, marginLeft: 2,
                animation: "blink 1s step-end infinite", verticalAlign: "text-bottom",
              }} />
            )}
          </>
        ) : (
          isActiveStream && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#9ca3af", fontSize: 13 }}>
              <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite", color: "#7c3aed" }} />
              {mode === "retrieve" ? "Searching…" : hasSources ? "Generating answer…" : "Retrieving sources…"}
            </div>
          )
        )}

        {msg.content && !isActiveStream && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginTop: 10, paddingTop: 8, borderTop: "1px solid #f3f4f6",
          }}>
            <button
              onClick={handleCopy}
              style={{
                display: "flex", alignItems: "center", gap: 4,
                background: "none", border: "none", cursor: "pointer",
                fontSize: 11, color: "#9ca3af", padding: 0,
              }}
            >
              {copied ? <Check size={13} color="#16a34a" /> : <Copy size={13} />}
              {copied ? "Copied" : ""}
            </button>
            {hasSources && (
              <span style={{ fontSize: 11, color: "#9ca3af" }}>
                {msg.sources!.length} source{msg.sources!.length !== 1 ? "s" : ""} referenced
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
