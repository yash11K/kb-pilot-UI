"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Search, MessageSquare, Send, Loader2, X } from "lucide-react";
import TabSwitcher from "@/components/TabSwitcher";
import ScorePill from "@/components/ScorePill";
import { kbSearch, kbChat } from "@/lib/api";
import type { KBSearchResult, KBChatMessage } from "@/lib/types";

export default function KBPage() {
  const [activeTab, setActiveTab] = useState<"search" | "chat">("search");

  return (
    <div style={{ padding: "24px 32px", display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <Search size={22} color="#7c3aed" />
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: 0 }}>
          Knowledge Base
        </h2>
      </div>

      <TabSwitcher
        tabs={[
          { key: "search", label: "Search" },
          { key: "chat", label: "Chat" },
        ]}
        activeTab={activeTab}
        onTabChange={(key) => setActiveTab(key as "search" | "chat")}
      />

      {activeTab === "search" ? <KBSearchTab /> : <KBChatTab />}
    </div>
  );
}

/* ─── Search Tab ─── */

function KBSearchTab() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<KBSearchResult[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);

  const handleSearch = useCallback(() => {
    if (!query.trim() || isStreaming) return;

    setResults([]);
    setError(null);
    setIsStreaming(true);

    ctrlRef.current = kbSearch(
      query,
      10,
      (event, data) => {
        if (event !== "result") return;
        try {
          const raw = JSON.parse(data);
          // Extract title from YAML frontmatter in content
          let title = "";
          let excerpt = raw.content || "";
          const fmMatch = excerpt.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
          if (fmMatch) {
            const frontmatter = fmMatch[1];
            const body = fmMatch[2];
            const titleMatch = frontmatter.match(/^title:\s*(.+)$/m);
            if (titleMatch) title = titleMatch[1].trim();
            excerpt = body.trim();
          }
          // Truncate excerpt for display
          excerpt = excerpt.replace(/^#+\s+.*\n?/gm, "").trim();
          if (excerpt.length > 300) {
            excerpt = excerpt.slice(0, 300).trimEnd() + "…";
          }
          // Extract source_url from frontmatter or s3_uri
          let sourceUrl = "";
          if (fmMatch) {
            const srcMatch = fmMatch[1].match(/^source_url:\s*(.+)$/m);
            if (srcMatch) sourceUrl = srcMatch[1].trim();
          }
          if (!sourceUrl && raw.s3_uri) sourceUrl = raw.s3_uri;

          const result: KBSearchResult = {
            title: title || "Untitled",
            excerpt,
            score: raw.score ?? 0,
            source_url: sourceUrl || undefined,
          };
          setResults((prev) => [...prev, result]);
        } catch {
          // Non-JSON or malformed — ignore
        }
      },
      () => setIsStreaming(false),
      (err) => {
        setError(err.message);
        setIsStreaming(false);
      },
    );
  }, [query, isStreaming]);

  useEffect(() => {
    return () => ctrlRef.current?.abort();
  }, []);

  return (
    <>
      {/* Search input */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 8,
            border: "1.5px solid #e5e7eb",
            borderRadius: 10,
            padding: "10px 14px",
            background: "#fff",
          }}
        >
          <Search size={16} color="#9ca3af" style={{ flexShrink: 0 }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search the knowledge base..."
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              fontSize: 14,
              fontFamily: "inherit",
              background: "transparent",
            }}
          />
          {query && (
            <button
              onClick={() => { setQuery(""); setResults([]); setError(null); }}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}
            >
              <X size={14} color="#9ca3af" />
            </button>
          )}
        </div>
        <button
          onClick={handleSearch}
          disabled={!query.trim() || isStreaming}
          style={{
            padding: "10px 20px",
            borderRadius: 10,
            border: "none",
            background: "#7c3aed",
            color: "#fff",
            fontWeight: 600,
            fontSize: 14,
            cursor: !query.trim() || isStreaming ? "not-allowed" : "pointer",
            opacity: !query.trim() || isStreaming ? 0.6 : 1,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {isStreaming ? <Loader2 size={16} style={{ animation: "spin 0.8s linear infinite" }} /> : <Search size={16} />}
          {isStreaming ? "Searching..." : "Search"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: "12px 16px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, color: "#dc2626", fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Results */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {results.map((r, i) => (
          <div
            key={i}
            style={{
              background: "#fff",
              borderRadius: 14,
              border: "1px solid #ede9fe",
              padding: "16px 20px",
              marginBottom: 10,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>
                {r.title || "Untitled"}
              </div>
              {r.score !== undefined && <ScorePill score={r.score} />}
            </div>
            <div style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.6 }}>
              {r.excerpt}
            </div>
            {r.source_url && (
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 8, fontFamily: "'DM Mono', monospace" }}>
                {r.source_url}
              </div>
            )}
          </div>
        ))}

        {!isStreaming && results.length === 0 && !error && (
          <div style={{ textAlign: "center", padding: "48px 24px", color: "#9ca3af", fontSize: 14 }}>
            Enter a query to search the knowledge base.
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

/* ─── Chat Tab ─── */

function KBChatTab() {
  const [messages, setMessages] = useState<KBChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const ctrlRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = useCallback(() => {
    if (!input.trim() || isStreaming) return;

    const userMsg: KBChatMessage = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMsg, { role: "assistant", content: "" }]);
    setInput("");
    setError(null);
    setIsStreaming(true);

    ctrlRef.current = kbChat(
      userMsg.content,
      5,
      (data) => {
        // Each SSE event is a token chunk
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === "assistant") {
            // Try parsing as JSON token, fall back to raw string
            let token = data;
            try {
              const parsed = JSON.parse(data);
              if (typeof parsed === "string") token = parsed;
              else if (parsed.token) token = parsed.token;
              else if (parsed.text) token = parsed.text;
            } catch {
              // Use data as-is
            }
            updated[updated.length - 1] = { ...last, content: last.content + token };
          }
          return updated;
        });
      },
      () => setIsStreaming(false),
      (err) => {
        setError(err.message);
        setIsStreaming(false);
      },
    );
  }, [input, isStreaming]);

  useEffect(() => {
    return () => ctrlRef.current?.abort();
  }, []);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* Messages */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflow: "auto",
          padding: "8px 0",
        }}
      >
        {messages.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 24px", color: "#9ca3af", fontSize: 14 }}>
            <MessageSquare size={32} color="#ddd6fe" style={{ marginBottom: 12 }} />
            <div>Ask a question about the knowledge base.</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>
              Answers are generated using RAG with your ingested content.
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              marginBottom: 12,
            }}
          >
            <div
              style={{
                maxWidth: "75%",
                padding: "12px 16px",
                borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                background: msg.role === "user" ? "#7c3aed" : "#f3f4f6",
                color: msg.role === "user" ? "#fff" : "#111827",
                fontSize: 14,
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {msg.content}
              {msg.role === "assistant" && isStreaming && i === messages.length - 1 && (
                <span
                  style={{
                    display: "inline-block",
                    width: 6,
                    height: 14,
                    background: "#7c3aed",
                    marginLeft: 2,
                    animation: "blink 1s step-end infinite",
                    verticalAlign: "text-bottom",
                  }}
                />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: "8px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#dc2626", fontSize: 12, marginBottom: 8 }}>
          {error}
        </div>
      )}

      {/* Input */}
      <div
        style={{
          display: "flex",
          gap: 8,
          padding: "12px 0 0",
          borderTop: "1px solid #ede9fe",
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder="Ask a question..."
          disabled={isStreaming}
          style={{
            flex: 1,
            padding: "12px 16px",
            border: "1.5px solid #e5e7eb",
            borderRadius: 10,
            fontSize: 14,
            fontFamily: "inherit",
            outline: "none",
            background: "#fff",
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isStreaming}
          style={{
            padding: "12px 20px",
            borderRadius: 10,
            border: "none",
            background: "#7c3aed",
            color: "#fff",
            fontWeight: 600,
            fontSize: 14,
            cursor: !input.trim() || isStreaming ? "not-allowed" : "pointer",
            opacity: !input.trim() || isStreaming ? 0.6 : 1,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {isStreaming ? <Loader2 size={16} style={{ animation: "spin 0.8s linear infinite" }} /> : <Send size={16} />}
        </button>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes blink { 50% { opacity: 0; } }
      `}</style>
    </div>
  );
}
