"use client";

import { useReducer, useEffect, useRef, useCallback, useState } from "react";
import type {
  LogEntry,
  SSEProgressEvent,
  SSEToolCallEvent,
  SSEAgentLogEvent,
  SSECompleteEvent,
  SSEErrorEvent,
  SSEEventType,
  JobStreamStatus,
  CrawlPageStartEvent,
  CrawlPageCompleteEvent,
  CrawlPageSkippedEvent,
  CrawlPageErrorEvent,
  CrawlSummaryEvent,
} from "@/lib/types";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// ── Active tool call (for animation) ─────────────────────────

export interface ActiveToolCall {
  agent: "extractor" | "validator";
  tool: string;
  timestamp: number;
}

// ── State ────────────────────────────────────────────────────

interface StreamState {
  status: JobStreamStatus;
  currentStage: string | null;
  progress: { current: number; total: number } | null;
  logs: LogEntry[];
  summary: SSECompleteEvent | null;
  crawlSummary: CrawlSummaryEvent | null;
  error: SSEErrorEvent | null;
  startedAt: number | null;
}

const INITIAL: StreamState = {
  status: "connecting",
  currentStage: null,
  progress: null,
  logs: [],
  summary: null,
  crawlSummary: null,
  error: null,
  startedAt: null,
};

// ── Actions ──────────────────────────────────────────────────

type Action =
  | { type: "PROGRESS"; payload: SSEProgressEvent }
  | { type: "TOOL_CALL"; payload: SSEToolCallEvent }
  | { type: "AGENT_LOG_CHUNK"; payload: SSEAgentLogEvent }
  | { type: "AGENT_LOG_MSG"; payload: SSEAgentLogEvent }
  | { type: "FLUSH_CHUNKS"; payload: { agent: "extractor" | "validator"; text: string; timestamp: string } }
  | { type: "COMPLETE"; payload: SSECompleteEvent }
  | { type: "ERROR"; payload: SSEErrorEvent }
  | { type: "CRAWL_PAGE_START"; payload: CrawlPageStartEvent }
  | { type: "CRAWL_PAGE_COMPLETE"; payload: CrawlPageCompleteEvent }
  | { type: "CRAWL_PAGE_SKIPPED"; payload: CrawlPageSkippedEvent }
  | { type: "CRAWL_PAGE_ERROR"; payload: CrawlPageErrorEvent }
  | { type: "CRAWL_SUMMARY"; payload: CrawlSummaryEvent }
  | { type: "QUEUED"; payload: SSEProgressEvent }
  | { type: "CONNECTED" }
  | { type: "DISCONNECTED" }
  | { type: "CLEAR_LOGS" }
  | { type: "RESET" };

let entryCounter = 0;

function makeEntry(
  eventType: SSEEventType,
  message: string,
  raw: LogEntry["raw"],
  agent?: "extractor" | "validator",
): LogEntry {
  return {
    id: `${Date.now()}-${++entryCounter}`,
    timestamp: new Date((raw as { timestamp: string }).timestamp),
    eventType,
    agent,
    message,
    raw,
  };
}

function reducer(state: StreamState, action: Action): StreamState {
  const ensureStarted = (s: StreamState): StreamState => ({
    ...s,
    status: "streaming",
    startedAt: s.startedAt ?? Date.now(),
  });

  switch (action.type) {
    case "QUEUED": {
      const q = action.payload;
      const entry = makeEntry("queued", q.message, q);
      return {
        ...state,
        status: "queued",
        currentStage: "queued",
        logs: [...state.logs, entry],
      };
    }

    case "CONNECTED":
      return { ...state, status: "streaming", startedAt: state.startedAt ?? Date.now() };

    case "PROGRESS": {
      const p = action.payload;
      const entry = makeEntry("progress", p.message, p);
      const progress =
        p.current != null && p.total != null
          ? { current: p.current, total: p.total }
          : state.progress;
      return {
        ...ensureStarted(state),
        currentStage: p.stage,
        progress,
        logs: [...state.logs, entry],
      };
    }

    case "TOOL_CALL": {
      const t = action.payload;
      const entry = makeEntry("tool_call", t.message, t, t.agent);
      return {
        ...ensureStarted(state),
        logs: [...state.logs, entry],
      };
    }

    case "AGENT_LOG_MSG": {
      const a = action.payload;
      const entry = makeEntry("agent_log", a.message || "", a, a.agent);
      return {
        ...ensureStarted(state),
        logs: [...state.logs, entry],
      };
    }

    // Chunks are NOT added individually — they get flushed as a batch
    case "AGENT_LOG_CHUNK":
      return ensureStarted(state);

    case "FLUSH_CHUNKS": {
      const { agent, text, timestamp } = action.payload;
      if (!text.trim()) return state;
      const raw: SSEAgentLogEvent = { agent, chunk: text, timestamp };
      const entry = makeEntry("agent_log", text, raw, agent);
      return {
        ...state,
        logs: [...state.logs, entry],
      };
    }

    case "COMPLETE": {
      const c = action.payload;
      const entry = makeEntry("complete", c.message, c);
      return { ...state, status: "completed", summary: c, logs: [...state.logs, entry] };
    }

    case "ERROR": {
      const e = action.payload;
      const entry = makeEntry("error", e.message, e);
      return { ...state, status: "error", error: e, logs: [...state.logs, entry] };
    }

    case "CRAWL_PAGE_START": {
      const d = action.payload;
      const entry = makeEntry("crawl_page_start", `🔍 Crawling (depth ${d.depth}): ${d.url}`, d);
      return { ...ensureStarted(state), logs: [...state.logs, entry] };
    }

    case "CRAWL_PAGE_COMPLETE": {
      const d = action.payload;
      const entry = makeEntry("crawl_page_complete", `✅ Done: ${d.url} — ${d.files_extracted} files, ${d.new_child_urls} child URLs`, d);
      return { ...ensureStarted(state), logs: [...state.logs, entry] };
    }

    case "CRAWL_PAGE_SKIPPED": {
      const d = action.payload;
      const entry = makeEntry("crawl_page_skipped", `⏭ Skipped: ${d.url} — ${d.reason}`, d);
      return { ...ensureStarted(state), logs: [...state.logs, entry] };
    }

    case "CRAWL_PAGE_ERROR": {
      const d = action.payload;
      const entry = makeEntry("crawl_page_error", `⚠️ Error: ${d.url} — ${d.error}`, d);
      return { ...ensureStarted(state), logs: [...state.logs, entry] };
    }

    case "CRAWL_SUMMARY": {
      const d = action.payload;
      const entry = makeEntry("crawl_summary", `📊 Crawl complete: ${d.total_pages} pages, ${d.total_files} files, max depth ${d.max_depth_reached}`, d);
      return { ...ensureStarted(state), crawlSummary: d, logs: [...state.logs, entry] };
    }

    case "DISCONNECTED":
      return { ...state, status: "disconnected" };

    case "CLEAR_LOGS":
      return { ...state, logs: [] };

    case "RESET":
      return INITIAL;

    default:
      return state;
  }
}

// ── Hook ─────────────────────────────────────────────────────

const CHUNK_FLUSH_MS = 200;

export function useJobStream(jobId: string | null) {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const [activeToolCall, setActiveToolCall] = useState<ActiveToolCall | null>(null);
  const esRef = useRef<EventSource | null>(null);

  // Chunk buffer: accumulate LLM token chunks per agent, flush every 200ms
  const chunkBufferRef = useRef<Record<string, { text: string; timestamp: string }>>({});
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const flushChunks = useCallback(() => {
    const buf = chunkBufferRef.current;
    for (const agent of Object.keys(buf)) {
      if (buf[agent].text) {
        dispatch({
          type: "FLUSH_CHUNKS",
          payload: {
            agent: agent as "extractor" | "validator",
            text: buf[agent].text,
            timestamp: buf[agent].timestamp,
          },
        });
        buf[agent] = { text: "", timestamp: "" };
      }
    }
  }, []);

  // Tool call timeout — clear active tool after 3s of no new tool_call
  const toolTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!jobId) return;

    dispatch({ type: "RESET" });
    setActiveToolCall(null);
    chunkBufferRef.current = {};

    const es = new EventSource(`${BASE}/ingest/${jobId}/stream`);
    esRef.current = es;

    // Start chunk flush interval
    flushTimerRef.current = setInterval(flushChunks, CHUNK_FLUSH_MS);

    es.addEventListener("queued", (e: MessageEvent) => {
      dispatch({ type: "QUEUED", payload: JSON.parse(e.data) });
    });

    es.addEventListener("progress", (e: MessageEvent) => {
      dispatch({ type: "PROGRESS", payload: JSON.parse(e.data) });
      // A progress event means the tool call phase is over
      setActiveToolCall(null);
    });

    es.addEventListener("tool_call", (e: MessageEvent) => {
      const data: SSEToolCallEvent = JSON.parse(e.data);
      dispatch({ type: "TOOL_CALL", payload: data });

      // Update active tool call for animation
      setActiveToolCall({ agent: data.agent, tool: data.tool, timestamp: Date.now() });

      // Reset timeout
      if (toolTimeoutRef.current) clearTimeout(toolTimeoutRef.current);
      toolTimeoutRef.current = setTimeout(() => setActiveToolCall(null), 3000);
    });

    es.addEventListener("agent_log", (e: MessageEvent) => {
      const data: SSEAgentLogEvent = JSON.parse(e.data);

      if (data.chunk) {
        // Buffer the chunk
        if (!chunkBufferRef.current[data.agent]) {
          chunkBufferRef.current[data.agent] = { text: "", timestamp: data.timestamp };
        }
        chunkBufferRef.current[data.agent].text += data.chunk;
        chunkBufferRef.current[data.agent].timestamp = data.timestamp;
        // Still dispatch so status stays "streaming"
        dispatch({ type: "AGENT_LOG_CHUNK", payload: data });
      } else {
        // Status message — flush any pending chunks first, then add the message
        flushChunks();
        dispatch({ type: "AGENT_LOG_MSG", payload: data });
      }
    });

    es.addEventListener("complete", (e: MessageEvent) => {
      flushChunks();
      setActiveToolCall(null);
      dispatch({ type: "COMPLETE", payload: JSON.parse(e.data) });
      es.close();
    });

    es.addEventListener("crawl_page_start", (e: MessageEvent) => {
      dispatch({ type: "CRAWL_PAGE_START", payload: JSON.parse(e.data) });
    });

    es.addEventListener("crawl_page_complete", (e: MessageEvent) => {
      dispatch({ type: "CRAWL_PAGE_COMPLETE", payload: JSON.parse(e.data) });
    });

    es.addEventListener("crawl_page_skipped", (e: MessageEvent) => {
      dispatch({ type: "CRAWL_PAGE_SKIPPED", payload: JSON.parse(e.data) });
    });

    es.addEventListener("crawl_page_error", (e: MessageEvent) => {
      dispatch({ type: "CRAWL_PAGE_ERROR", payload: JSON.parse(e.data) });
    });

    es.addEventListener("crawl_summary", (e: MessageEvent) => {
      dispatch({ type: "CRAWL_SUMMARY", payload: JSON.parse(e.data) });
    });

    es.addEventListener("error", ((e: MessageEvent) => {
      flushChunks();
      setActiveToolCall(null);
      if (e.data) {
        dispatch({ type: "ERROR", payload: JSON.parse(e.data) });
      } else {
        dispatch({ type: "DISCONNECTED" });
      }
      es.close();
    }) as EventListener);

    es.onopen = () => dispatch({ type: "CONNECTED" });

    return () => {
      es.close();
      esRef.current = null;
      if (flushTimerRef.current) clearInterval(flushTimerRef.current);
      if (toolTimeoutRef.current) clearTimeout(toolTimeoutRef.current);
    };
  }, [jobId, flushChunks]);

  const clearLogs = useCallback(() => dispatch({ type: "CLEAR_LOGS" }), []);

  return { ...state, activeToolCall, clearLogs };
}
