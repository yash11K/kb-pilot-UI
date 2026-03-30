"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { streamContextChat } from "@/lib/api";
import type { ContextMessage } from "@/lib/types";

type Status = "idle" | "analyzing" | "ready" | "asking" | "error";

export function useContextAgent(fileId: string | null) {
  const [status, setStatus] = useState<Status>("idle");
  const [analysis, setAnalysis] = useState("");
  const [conversation, setConversation] = useState<ContextMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Auto-trigger initial analysis when fileId is set
  useEffect(() => {
    if (!fileId) return;

    setStatus("analyzing");
    setAnalysis("");
    setConversation([]);
    setError(null);

    let accumulated = "";

    const ctrl = streamContextChat(
      fileId,
      [],
      (text) => {
        accumulated += text;
        setAnalysis(accumulated);
      },
      () => {
        setConversation([{ role: "assistant", content: accumulated }]);
        setStatus("ready");
      },
      (err) => {
        setError(err.message);
        setStatus("error");
      },
    );

    abortRef.current = ctrl;

    return () => {
      ctrl.abort();
    };
  }, [fileId]);

  const askFollowUp = useCallback(
    (question: string) => {
      if (!fileId || status === "asking" || status === "analyzing") return;

      // Abort any previous stream
      abortRef.current?.abort();

      const userMsg: ContextMessage = { role: "user", content: question };
      const updatedConversation = [...conversation, userMsg];
      setConversation(updatedConversation);
      setStatus("asking");

      let assistantText = "";

      const ctrl = streamContextChat(
        fileId,
        updatedConversation,
        (text) => {
          assistantText += text;
          // Update the last assistant message in conversation
          setConversation([
            ...updatedConversation,
            { role: "assistant", content: assistantText },
          ]);
        },
        () => {
          setConversation([
            ...updatedConversation,
            { role: "assistant", content: assistantText },
          ]);
          setStatus("ready");
        },
        (err) => {
          setError(err.message);
          setStatus("error");
        },
      );

      abortRef.current = ctrl;
    },
    [fileId, status, conversation],
  );

  return { status, analysis, conversation, error, askFollowUp };
}
