"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  X,
  Send,
  Loader2,
  Bot,
  Trash2,
  RotateCcw,
  MessageSquare,
} from "lucide-react";
import MdPreview from "@/components/MdPreview";
import { useAgentChat } from "@/hooks/useAgentChat";
import type { ChatMessage } from "@/hooks/useAgentChat";

const STARTER_CHIPS = [
  "What's the current system status?",
  "Are there any failed jobs?",
  "Show me files pending review",
  "Which sources have the most content?",
];

interface AgentChatPanelProps {
  open: boolean;
  onClose: () => void;
  initialPrompt?: string | null;
  onPromptConsumed?: () => void;
}

export default function AgentChatPanel({ open, onClose, initialPrompt, onPromptConsumed }: AgentChatPanelProps) {
  const { messages, status, error, send, clear, retry } = useAgentChat();
  const [input, setInput] = useState("");
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const consumedPromptRef = useRef<string | null>(null);

  const isBusy = status === "waiting" || status === "streaming";

  // Handle open/close transitions
  useEffect(() => {
    if (open) {
      setVisible(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimating(true));
      });
    } else {
      setAnimating(false);
      const timer = setTimeout(() => setVisible(false), 250);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Auto-send initialPrompt when panel opens with one
  useEffect(() => {
    if (open && initialPrompt && initialPrompt !== consumedPromptRef.current && status === "idle") {
      consumedPromptRef.current = initialPrompt;
      send(initialPrompt);
      onPromptConsumed?.();
    }
  }, [open, initialPrompt, status, send, onPromptConsumed]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (open) chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200);
  }, [open]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isBusy) return;
    setInput("");
    send(text);
  }, [input, isBusy, send]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChip = (text: string) => {
    if (isBusy) return;
    send(text);
  };

  const handleClear = () => {
    clear();
    setInput("");
  };

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backdropFilter: animating ? "blur(8px)" : "blur(0px)",
        WebkitBackdropFilter: animating ? "blur(8px)" : "blur(0px)",
        background: animating ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0)",
        transition: "backdrop-filter 0.25s ease, background 0.25s ease",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 640,
          maxWidth: "calc(100vw - 32px)",
          height: "min(720px, calc(100vh - 64px))",
          background: "#fff",
          borderRadius: 20,
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 24px 80px rgba(0,0,0,0.18), 0 0 0 1px rgba(124,58,237,0.08)",
          opacity: animating ? 1 : 0,
          transform: animating ? "scale(1) translateY(0)" : "scale(0.95) translateY(12px)",
          transition: "opacity 0.25s ease, transform 0.25s ease",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={styles.header}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Bot size={18} color="#7c3aed" />
            <span style={styles.headerTitle}>KB Agent</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {messages.length > 0 && !isBusy && (
              <button onClick={handleClear} title="Clear conversation" style={styles.headerBtn}>
                <Trash2 size={15} />
              </button>
            )}
            <button onClick={onClose} title="Close" style={styles.headerBtn}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div style={styles.messageArea}>
          {messages.length === 0 && !isBusy && (
            <EmptyState onChip={handleChip} />
          )}

          {messages.map((msg, i) => (
            <MessageBubble
              key={i}
              msg={msg}
              isStreaming={
                status === "streaming" &&
                msg.role === "assistant" &&
                i === messages.length - 1
              }
            />
          ))}

          {status === "waiting" && (
            <div style={styles.waitingRow}>
              <PulsingDots />
            </div>
          )}

          {error && (
            <div style={styles.errorBox}>
              <span>{error}</span>
              <button onClick={retry} style={styles.retryBtn}>
                <RotateCcw size={12} /> Retry
              </button>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div style={styles.inputBar}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask the KB Agent…"
            disabled={isBusy}
            rows={1}
            style={{
              ...styles.textarea,
              background: isBusy ? "#f9fafb" : "#fff",
            }}
          />
          <button
            onClick={handleSend}
            disabled={isBusy || !input.trim()}
            style={{
              ...styles.sendBtn,
              background: isBusy || !input.trim() ? "#f3f4f6" : "#7c3aed",
              color: isBusy || !input.trim() ? "#9ca3af" : "#fff",
              cursor: isBusy || !input.trim() ? "default" : "pointer",
            }}
          >
            {isBusy ? (
              <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
            ) : (
              <Send size={16} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────── */

function EmptyState({ onChip }: { onChip: (t: string) => void }) {
  return (
    <div style={styles.emptyState}>
      <Bot size={36} color="#d8b4fe" />
      <p style={{ fontSize: 14, color: "#6b7280", margin: "8px 0 4px" }}>
        Ask the KB Agent anything about your knowledge base.
      </p>
      <div style={styles.chipGrid}>
        {STARTER_CHIPS.map((chip) => (
          <button
            key={chip}
            onClick={() => onChip(chip)}
            style={styles.chip}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#ede9fe";
              e.currentTarget.style.borderColor = "#c4b5fd";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#faf5ff";
              e.currentTarget.style.borderColor = "#ede9fe";
            }}
          >
            <MessageSquare size={12} color="#7c3aed" style={{ flexShrink: 0 }} />
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({
  msg,
  isStreaming,
}: {
  msg: ChatMessage;
  isStreaming: boolean;
}) {
  const isUser = msg.role === "user";
  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        marginBottom: 10,
        animation: "fadeIn 0.15s ease",
      }}
    >
      <div
        style={{
          maxWidth: "80%",
          padding: "10px 14px",
          fontSize: 13,
          lineHeight: 1.6,
          borderRadius: isUser
            ? "14px 14px 4px 14px"
            : "14px 14px 14px 4px",
          ...(isUser
            ? { background: "#f3f0ff", color: "#5b21b6" }
            : { background: "#f9fafb", color: "#374151" }),
        }}
      >
        {isUser ? (
          msg.content
        ) : (
          <div style={{ fontSize: 13 }}>
            <MdPreview content={msg.content} />
            {isStreaming && <StreamingCursor />}
          </div>
        )}
      </div>
    </div>
  );
}

function StreamingCursor() {
  return (
    <span
      style={{
        display: "inline-block",
        width: 6,
        height: 14,
        background: "#7c3aed",
        borderRadius: 1,
        marginLeft: 2,
        verticalAlign: "text-bottom",
        animation: "pulse 0.8s ease-in-out infinite",
      }}
    />
  );
}

function PulsingDots() {
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "8px 14px", background: "#f9fafb", borderRadius: "14px 14px 14px 4px", width: "fit-content" }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "#7c3aed",
            animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

/* ── Styles ──────────────────────────────────────────────── */

const styles: Record<string, React.CSSProperties> = {
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 24px",
    borderBottom: "1px solid #ede9fe",
    flexShrink: 0,
    borderRadius: "20px 20px 0 0",
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: "#1f2937",
  },
  headerBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 6,
    borderRadius: 6,
    color: "#9ca3af",
    display: "flex",
    alignItems: "center",
  },
  messageArea: {
    flex: 1,
    overflow: "auto",
    padding: "16px 24px",
    minHeight: 0,
  },
  waitingRow: {
    display: "flex",
    justifyContent: "flex-start",
    marginBottom: 10,
  },
  errorBox: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    padding: "8px 12px",
    background: "#fef2f2",
    border: "1px solid #fca5a5",
    borderRadius: 8,
    fontSize: 12,
    color: "#991b1b",
    marginBottom: 10,
  },
  retryBtn: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    background: "none",
    border: "1px solid #fca5a5",
    borderRadius: 6,
    padding: "4px 8px",
    fontSize: 11,
    fontWeight: 600,
    color: "#991b1b",
    cursor: "pointer",
    flexShrink: 0,
  },
  inputBar: {
    display: "flex",
    alignItems: "flex-end",
    gap: 8,
    padding: "14px 24px",
    borderTop: "1px solid #ede9fe",
    flexShrink: 0,
    borderRadius: "0 0 20px 20px",
  },
  textarea: {
    flex: 1,
    padding: "10px 14px",
    border: "1.5px solid #ede9fe",
    borderRadius: 10,
    fontSize: 13,
    outline: "none",
    fontFamily: "inherit",
    resize: "none",
    lineHeight: 1.5,
    maxHeight: 120,
  },
  sendBtn: {
    padding: "10px 14px",
    border: "none",
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: "48px 20px",
  },
  chipGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    marginTop: 16,
    maxWidth: 400,
  },
  chip: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 12px",
    background: "#faf5ff",
    border: "1px solid #ede9fe",
    borderRadius: 20,
    fontSize: 12,
    color: "#5b21b6",
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "all 0.15s",
  },
};
