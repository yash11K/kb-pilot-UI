"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Search, Sparkles, Send, Loader2, X, RotateCw } from "lucide-react";
import ScorePill from "@/components/ScorePill";
import MdPreview from "@/components/MdPreview";
import { kbSearch, kbChat } from "@/lib/api";
import type { KBSearchResult, KBChatMessage } from "@/lib/types";

type Mode = "retrieve" | "generate";

interface ParsedResult {
  title: string;
  excerpt: string;
  score: number;
  source_url?: string;
}

function parseSearchResult(raw: Record<string, unknown>): ParsedResult {
  let title = "";
  let excerpt = (raw.content as string) || "";
  const fmMatch = excerpt.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (fmMatch) {
    const frontmatter = fmMatch[1];
    const body = fmMatch[2];
    const titleMatch = frontmatter.match(/^title:\s*(.+)$/m);
    if (titleMatch) title = titleMatch[1].trim();
    const srcMatch = frontmatter.match(/^source_url:\s*(.+)$/m);
    excerpt = body.replace(/^#+\s+.*\n?/gm, "").trim();
    return {
      title: title || "Untitled",
      excerpt: excerpt.length > 280 ? excerpt.slice(0, 280).trimEnd() + "…" : excerpt,
      score: (raw.score as number) ?? 0,
      source_url: srcMatch?.[1]?.trim() || (raw.s3_uri as string) || undefined,
    };
  }
  return {
    title: "Untitled",
    excerpt: excerpt.length > 280 ? excerpt.slice(0, 280).trimEnd() + "…" : excerpt,
    score: (raw.score as number) ?? 0,
    source_url: (raw.s3_uri as string) || undefined,
  };
}

const SUGGESTIONS = [
  "Can I smoke in my rental car?",
  "What is the pet policy?",
  "How do I extend my rental?",
  "What happens if I return the car late?",
];

interface ChatEntry {
  role: "user" | "assistant";
  content: string;
  results?: ParsedResult[];
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

        ctrlRef.current = kbSearch(q, 10,
          (event, data) => {
            if (event !== "result") return;
            try {
              const raw = JSON.parse(data);
              collected.push(parseSearchResult(raw));
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
            } catch { /* ignore */ }
          },
          () => setIsStreaming(false),
          (err) => { setError(err.message); setIsStreaming(false); },
        );
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
        ctrlRef.current = kbChat(q, 5,
          (data) => {
            let token = data;
            try {
              const parsed = JSON.parse(data);
              if (typeof parsed === "string") token = parsed;
              else if (parsed.token) token = parsed.token;
              else if (parsed.text) token = parsed.text;
            } catch { /* use raw */ }
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last?.role === "assistant") {
                updated[updated.length - 1] = { ...last, content: last.content + token };
              }
              return updated;
            });
            scrollToBottom();
          },
          () => setIsStreaming(false),
          (err) => { setError(err.message); setIsStreaming(false); },
        );
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
              <div style={{ maxWidth: "85%", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600, marginBottom: 2 }}>{msg.content}</div>
                {msg.results.map((r, ri) => (
                  <div
                    key={ri}
                    style={{ background: "#fff", borderRadius: 12, border: "1px solid #ede9fe", padding: "14px 16px", transition: "box-shadow 0.15s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 2px 12px rgba(124,58,237,0.08)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{r.title}</div>
                      <ScorePill score={r.score} />
                    </div>
                    <div style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.6 }}>{r.excerpt}</div>
                    {r.source_url && (
                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 8, fontFamily: "'DM Mono', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.source_url}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ maxWidth: "80%", padding: "14px 18px", borderRadius: "16px 16px 16px 4px", background: "#fff", border: "1px solid #f3f4f6", fontSize: 14, lineHeight: 1.7, color: "#111827", wordBreak: "break-word" }}>
                {msg.content ? (
                  <MdPreview content={msg.content} />
                ) : (
                  isStreaming && i === messages.length - 1 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#9ca3af", fontSize: 13 }}>
                      <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite", color: "#7c3aed" }} />
                      {mode === "retrieve" ? "Searching…" : "Generating…"}
                    </div>
                  )
                )}
                {msg.content && isStreaming && i === messages.length - 1 && (
                  <span style={{ display: "inline-block", width: 6, height: 14, background: "#7c3aed", marginLeft: 2, animation: "blink 1s step-end infinite", verticalAlign: "text-bottom" }} />
                )}
              </div>
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
