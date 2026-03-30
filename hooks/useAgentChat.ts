"use client";

import { useState, useRef, useCallback } from "react";
import { streamAgentChat } from "@/lib/api";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export type AgentChatStatus = "idle" | "waiting" | "streaming" | "error";

export function useAgentChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<AgentChatStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Ref to track the committed conversation (excludes the in-progress assistant message)
  const committedRef = useRef<ChatMessage[]>([]);

  const send = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed || status === "waiting" || status === "streaming") return;

    abortRef.current?.abort();
    setError(null);

    const userMsg: ChatMessage = { role: "user", content: trimmed };
    const history = [...committedRef.current];
    const withUser = [...history, userMsg];

    // Show user message immediately
    setMessages(withUser);
    setStatus("waiting");

    let assistantText = "";

    const ctrl = streamAgentChat(
      trimmed,
      history, // prior conversation (not including this user message per API contract)
      (token) => {
        if (!assistantText) setStatus("streaming");
        assistantText += token;
        setMessages([...withUser, { role: "assistant", content: assistantText }]);
      },
      () => {
        const final: ChatMessage[] = [
          ...withUser,
          { role: "assistant", content: assistantText || "(No response)" },
        ];
        committedRef.current = final;
        setMessages(final);
        setStatus("idle");
      },
      (err) => {
        // Still keep the user message visible
        if (assistantText) {
          const partial: ChatMessage[] = [
            ...withUser,
            { role: "assistant", content: assistantText },
          ];
          committedRef.current = partial;
          setMessages(partial);
        }
        setError(err.message || "Connection failed. Please try again.");
        setStatus("error");
      },
    );

    abortRef.current = ctrl;
  }, [status]);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    committedRef.current = [];
    setMessages([]);
    setStatus("idle");
    setError(null);
  }, []);

  const retry = useCallback(() => {
    // Retry the last user message
    const lastUser = [...committedRef.current, ...messages]
      .filter((m) => m.role === "user")
      .pop();
    if (lastUser) {
      // Remove the failed assistant response if any
      const trimmed = messages.filter(
        (m, i) => !(m.role === "assistant" && i === messages.length - 1 && status === "error"),
      );
      committedRef.current = trimmed.filter((_, i) => i < trimmed.length);
      setMessages(trimmed);
      setError(null);
      setStatus("idle");
      // Re-send after a tick
      setTimeout(() => send(lastUser.content), 0);
    }
  }, [messages, status, send]);

  return { messages, status, error, send, clear, retry };
}
