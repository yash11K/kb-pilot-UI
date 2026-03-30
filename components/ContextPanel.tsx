"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Sparkles } from "lucide-react";
import MdPreview from "@/components/MdPreview";
import { useContextAgent } from "@/hooks/useContextAgent";

interface ContextPanelProps {
  fileId: string;
}

function ShimmerLine({ width }: { width: string }) {
  return (
    <div
      style={{
        height: 10,
        width,
        borderRadius: 4,
        background: "linear-gradient(90deg, #f3f0ff 25%, #ede9fe 50%, #f3f0ff 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.5s infinite",
        marginBottom: 6,
      }}
    />
  );
}

export default function ContextPanel({ fileId }: ContextPanelProps) {
  const { status, analysis, conversation, error, askFollowUp } =
    useContextAgent(fileId);
  const [input, setInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation]);

  const handleSend = () => {
    const q = input.trim();
    if (!q) return;
    setInput("");
    askFollowUp(q);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isLoading = status === "analyzing" || status === "asking";

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          paddingBottom: 8,
          borderBottom: "1px solid #ede9fe",
          marginBottom: 8,
        }}
      >
        <Sparkles size={14} color="#7c3aed" />
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "#4b5563",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          Context Agent
        </span>
        {isLoading && (
          <span
            style={{
              marginLeft: "auto",
              fontSize: 10,
              color: "#7c3aed",
              fontWeight: 600,
            }}
          >
            {status === "analyzing" ? "Analyzing\u2026" : "Thinking\u2026"}
          </span>
        )}
      </div>

      {/* Content area */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          minHeight: 0,
          paddingRight: 4,
        }}
      >
        {/* Initial analysis */}
        {status === "analyzing" && !analysis && (
          <div style={{ padding: "8px 0" }}>
            <ShimmerLine width="90%" />
            <ShimmerLine width="75%" />
            <ShimmerLine width="85%" />
            <ShimmerLine width="60%" />
            <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
          </div>
        )}

        {analysis && (
          <div style={{ fontSize: 12, lineHeight: 1.5 }}>
            <MdPreview content={analysis} />
          </div>
        )}

        {/* Follow-up conversation */}
        {conversation.length > 1 && (
          <div style={{ marginTop: 8 }}>
            {conversation.slice(1).map((msg, i) => (
              <div
                key={i}
                style={{
                  marginBottom: 8,
                  padding: "6px 10px",
                  borderRadius: 8,
                  fontSize: 12,
                  lineHeight: 1.5,
                  ...(msg.role === "user"
                    ? {
                        background: "#f3f0ff",
                        color: "#5b21b6",
                        marginLeft: 20,
                        textAlign: "right" as const,
                      }
                    : {
                        background: "#f9fafb",
                        color: "#374151",
                      }),
                }}
              >
                {msg.role === "assistant" ? (
                  <MdPreview content={msg.content} />
                ) : (
                  msg.content
                )}
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {error && (
          <div
            style={{
              padding: "8px 10px",
              background: "#fef2f2",
              border: "1px solid #fca5a5",
              borderRadius: 6,
              fontSize: 11,
              color: "#991b1b",
              marginTop: 8,
            }}
          >
            {error}
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input area */}
      <div
        style={{
          display: "flex",
          gap: 6,
          paddingTop: 8,
          borderTop: "1px solid #ede9fe",
          marginTop: 8,
          flexShrink: 0,
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a follow-up\u2026"
          disabled={isLoading}
          style={{
            flex: 1,
            padding: "7px 10px",
            border: "1.5px solid #ede9fe",
            borderRadius: 8,
            fontSize: 12,
            outline: "none",
            fontFamily: "inherit",
            background: isLoading ? "#f9fafb" : "#fff",
          }}
        />
        <button
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
          style={{
            padding: "7px 10px",
            background: isLoading || !input.trim() ? "#f3f4f6" : "#7c3aed",
            color: isLoading || !input.trim() ? "#9ca3af" : "#fff",
            border: "none",
            borderRadius: 8,
            cursor: isLoading || !input.trim() ? "default" : "pointer",
            display: "flex",
            alignItems: "center",
          }}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
