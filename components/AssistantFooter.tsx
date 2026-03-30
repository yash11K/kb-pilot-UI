"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown, ChevronUp, Loader2, Send, Sparkles, Trash2 } from "lucide-react";
import MdPreview from "@/components/MdPreview";
import { streamContextChat } from "@/lib/api";
import type { ContextMessage } from "@/lib/types";

export default function AssistantFooter() {
  const [input, setInput] = useState("");
  const [conversation, setConversation] = useState<ContextMessage[]>([]);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (panelOpen) chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation, panelOpen]);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const handleSend = useCallback(() => {
    const q = input.trim();
    if (!q || asking) return;
    abortRef.current?.abort();
    const userMsg: ContextMessage = { role: "user", content: q };
    const updated = [...conversation, userMsg];
    setConversation(updated);
    setInput("");
    setAsking(true);
    setError(null);
    setPanelOpen(true);
    let assistantText = "";
    const ctrl = streamContextChat(null, updated, (text) => {
      assistantText += text;
      setConversation([...updated, { role: "assistant", content: assistantText }]);
    }, () => {
      setConversation([...updated, { role: "assistant", content: assistantText }]);
      setAsking(false);
    }, (err) => {
      setError(err.message);
      setAsking(false);
    });
    abortRef.current = ctrl;
  }, [input, asking, conversation]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleClear = () => {
    abortRef.current?.abort();
    setConversation([]);
    setError(null);
    setAsking(false);
    setPanelOpen(false);
  };

  const hasMessages = conversation.length > 0;

  return (
    <div style={{ position: "sticky", bottom: 0, zIndex: 50, padding: "0 24px 16px" }}>
      <div className="ai-footer-wrapper">
        <div style={{ background: "#fff", borderRadius: 18, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>

          {/* Chat panel */}
          {panelOpen && hasMessages && (
            <div style={{ maxHeight: 360, overflow: "auto", padding: "16px 24px 0", borderBottom: "1px solid #f3f4f6" }}>
              {conversation.map((msg, i) => (
                <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", marginBottom: 10 }}>
                  <div style={{
                    maxWidth: "75%", padding: "10px 14px", fontSize: 13, lineHeight: 1.6,
                    borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                    ...(msg.role === "user" ? { background: "#f3f0ff", color: "#5b21b6" } : { background: "#f9fafb", color: "#374151" }),
                  }}>
                    {msg.role === "assistant" ? <div style={{ fontSize: 13 }}><MdPreview content={msg.content} /></div> : msg.content}
                  </div>
                </div>
              ))}
              {asking && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0 10px", color: "#7c3aed", fontSize: 12 }}>
                  <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Thinking…
                </div>
              )}
              {error && (
                <div style={{ padding: "8px 12px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, fontSize: 12, color: "#991b1b", marginBottom: 10 }}>{error}</div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}

          {/* Input bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 20px" }}>
            <Sparkles size={16} color="#7c3aed" style={{ flexShrink: 0 }} />
            {hasMessages && (
              <button onClick={() => setPanelOpen(!panelOpen)} title={panelOpen ? "Collapse" : "Expand"} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, color: "#9ca3af", display: "flex", alignItems: "center", flexShrink: 0 }}>
                {panelOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
              </button>
            )}
            <input ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} onFocus={() => { if (hasMessages) setPanelOpen(true); }} placeholder="Ask the assistant anything…" disabled={asking}
              style={{ flex: 1, padding: "9px 14px", border: "1.5px solid #ede9fe", borderRadius: 10, fontSize: 13, outline: "none", fontFamily: "inherit", background: asking ? "#f9fafb" : "#fff", transition: "border-color 0.15s" }}
            />
            <button onClick={handleSend} disabled={asking || !input.trim()}
              style={{ padding: "9px 14px", background: asking || !input.trim() ? "#f3f4f6" : "#7c3aed", color: asking || !input.trim() ? "#9ca3af" : "#fff", border: "none", borderRadius: 10, cursor: asking || !input.trim() ? "default" : "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
              {asking ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={15} />}
            </button>
            {hasMessages && !asking && (
              <button onClick={handleClear} title="Clear conversation"
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, color: "#9ca3af", display: "flex", alignItems: "center", flexShrink: 0, transition: "color 0.15s" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#dc2626")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#9ca3af")}>
                <Trash2 size={15} />
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
