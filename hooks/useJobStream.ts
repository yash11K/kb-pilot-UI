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
  URLTask,
  AgentStep,
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

// ── Stage labels ────────────────────────────────────────────

const STAGE_LABELS: Record<string, string> = {
  started: "Starting pipeline",
  fetch: "Fetching AEM content",
  discovery: "Discovering content & links",
  extraction: "Extracting markdown",
  extraction_complete: "Extraction complete",
  processing: "Processing files",
  validation: "Validating content",
  validated: "Validation complete",
  s3_upload: "Uploading to S3",
};

const TOOL_LABELS: Record<string, string> = {
  html_to_markdown: "Converting HTML to Markdown",
  generate_md_file: "Generating markdown file",
  parse_frontmatter: "Parsing frontmatter",
  check_duplicate: "Checking for duplicates",
};

// ── State ────────────────────────────────────────────────────

interface StreamState {
  status: JobStreamStatus;
  currentStage: string | null;
  progress: { current: number; total: number } | null;
  logs: LogEntry[];
  urlTasks: URLTask[];
  activeUrl: string | null;
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
  urlTasks: [],
  activeUrl: null,
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
  | { type: "RESET" }
  | { type: "SET_SOURCE_URL"; payload: string };

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

let stepCounter = 0;
let toolCounter = 0;

function makeStep(stage: string, agent?: "extractor" | "validator"): AgentStep {
  return {
    id: `step-${++stepCounter}`,
    stage,
    agent,
    label: STAGE_LABELS[stage] || stage,
    status: "active",
    startedAt: new Date(),
    toolCalls: [],
    thinkingText: "",
    fileResults: [],
  };
}

// ── URL task helpers ────────────────────────────────────────

/** Get or synthesize the active URLTask for attributing events */
function ensureActiveTask(state: StreamState, sourceUrl?: string): { urlTasks: URLTask[]; activeUrl: string | null } {
  if (state.activeUrl && state.urlTasks.some((t) => t.url === state.activeUrl)) {
    return { urlTasks: state.urlTasks, activeUrl: state.activeUrl };
  }
  // No active URL — synthesize one for single-page ingestion
  const url = sourceUrl || "unknown";
  const task: URLTask = {
    url,
    depth: 0,
    status: "crawling",
    startedAt: new Date(),
    steps: [],
  };
  return {
    urlTasks: [...state.urlTasks, task],
    activeUrl: url,
  };
}

/** Update the active URLTask's current step or create a new one */
function withActiveStep(
  urlTasks: URLTask[],
  activeUrl: string | null,
  stage: string,
  agent?: "extractor" | "validator",
): URLTask[] {
  if (!activeUrl) return urlTasks;
  return urlTasks.map((t) => {
    if (t.url !== activeUrl) return t;
    const lastStep = t.steps[t.steps.length - 1];
    // If last step has same stage and is active, don't create a new one
    if (lastStep && lastStep.stage === stage && lastStep.status === "active") return t;
    // Complete the previous active step
    const steps = t.steps.map((s) =>
      s.status === "active" ? { ...s, status: "completed" as const, completedAt: new Date() } : s,
    );
    steps.push(makeStep(stage, agent));
    return { ...t, steps };
  });
}

/** Add a tool call to the current active step of the active URL */
function withToolCall(
  urlTasks: URLTask[],
  activeUrl: string | null,
  agent: "extractor" | "validator",
  tool: string,
): URLTask[] {
  if (!activeUrl) return urlTasks;
  return urlTasks.map((t) => {
    if (t.url !== activeUrl) return t;
    const steps = [...t.steps];
    const lastIdx = steps.length - 1;
    if (lastIdx < 0) return t;
    const step = steps[lastIdx];
    steps[lastIdx] = {
      ...step,
      toolCalls: [
        ...step.toolCalls,
        { id: `tc-${++toolCounter}`, agent, tool, label: TOOL_LABELS[tool] || tool, timestamp: new Date() },
      ],
    };
    return { ...t, steps };
  });
}

/** Append thinking text to the current active step */
function withThinkingText(
  urlTasks: URLTask[],
  activeUrl: string | null,
  text: string,
): URLTask[] {
  if (!activeUrl) return urlTasks;
  return urlTasks.map((t) => {
    if (t.url !== activeUrl) return t;
    const steps = [...t.steps];
    const lastIdx = steps.length - 1;
    if (lastIdx < 0) return t;
    steps[lastIdx] = { ...steps[lastIdx], thinkingText: steps[lastIdx].thinkingText + text };
    return { ...t, steps };
  });
}

/** Add a file result to the current active step */
function withFileResult(
  urlTasks: URLTask[],
  activeUrl: string | null,
  filename: string,
  status: string,
  score?: number,
): URLTask[] {
  if (!activeUrl) return urlTasks;
  return urlTasks.map((t) => {
    if (t.url !== activeUrl) return t;
    const steps = [...t.steps];
    const lastIdx = steps.length - 1;
    if (lastIdx < 0) return t;
    steps[lastIdx] = {
      ...steps[lastIdx],
      fileResults: [...steps[lastIdx].fileResults, { filename, status, score }],
    };
    return { ...t, steps };
  });
}

// ── Reducer ─────────────────────────────────────────────────

function reducer(state: StreamState, action: Action): StreamState {
  const ensureStarted = (s: StreamState): StreamState => ({
    ...s,
    status: "streaming",
    startedAt: s.startedAt ?? Date.now(),
  });

  switch (action.type) {
    case "SET_SOURCE_URL":
      return state;

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

      let base = ensureStarted(state);

      // Ensure we have an active task (for single-page ingestion without crawl events)
      const { urlTasks: tasksWithActive, activeUrl } = ensureActiveTask(base);
      base = { ...base, urlTasks: tasksWithActive, activeUrl };

      // Determine agent from stage
      const agent = p.stage === "validation" || p.stage === "validated" ? "validator" as const
        : p.stage === "extraction" || p.stage === "extraction_complete" ? "extractor" as const
        : undefined;

      let urlTasks = withActiveStep(base.urlTasks, base.activeUrl, p.stage, agent);

      // If this is a validated event with file info, add the file result
      if (p.stage === "validated" && p.filename && p.status) {
        urlTasks = withFileResult(urlTasks, base.activeUrl, p.filename, p.status, p.score);
      }

      return {
        ...base,
        currentStage: p.stage,
        progress,
        logs: [...base.logs, entry],
        urlTasks,
      };
    }

    case "TOOL_CALL": {
      const t = action.payload;
      const entry = makeEntry("tool_call", t.message, t, t.agent);
      const base = ensureStarted(state);
      const { urlTasks: tasksWithActive, activeUrl } = ensureActiveTask(base);
      const urlTasks = withToolCall(tasksWithActive, activeUrl, t.agent, t.tool);
      return {
        ...base,
        logs: [...base.logs, entry],
        urlTasks,
        activeUrl,
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

    case "AGENT_LOG_CHUNK":
      return ensureStarted(state);

    case "FLUSH_CHUNKS": {
      const { agent, text, timestamp } = action.payload;
      if (!text.trim()) return state;
      const raw: SSEAgentLogEvent = { agent, chunk: text, timestamp };
      const entry = makeEntry("agent_log", text, raw, agent);
      const urlTasks = withThinkingText(state.urlTasks, state.activeUrl, text);
      return {
        ...state,
        logs: [...state.logs, entry],
        urlTasks,
      };
    }

    case "COMPLETE": {
      const c = action.payload;
      const entry = makeEntry("complete", c.message, c);
      // Complete all active steps in all tasks
      const urlTasks = state.urlTasks.map((t) => ({
        ...t,
        status: "completed" as const,
        completedAt: new Date(),
        steps: t.steps.map((s) =>
          s.status === "active" ? { ...s, status: "completed" as const, completedAt: new Date() } : s,
        ),
      }));
      return { ...state, status: "completed", summary: c, logs: [...state.logs, entry], urlTasks };
    }

    case "ERROR": {
      const e = action.payload;
      const entry = makeEntry("error", e.message, e);
      return { ...state, status: "error", error: e, logs: [...state.logs, entry] };
    }

    case "CRAWL_PAGE_START": {
      const d = action.payload;
      const entry = makeEntry("crawl_page_start", `Crawling (depth ${d.depth}): ${d.url}`, d);
      const base = ensureStarted(state);

      // Complete active steps in previous URL task
      let urlTasks = base.urlTasks.map((t) => {
        if (t.url !== base.activeUrl) return t;
        return {
          ...t,
          steps: t.steps.map((s) =>
            s.status === "active" ? { ...s, status: "completed" as const, completedAt: new Date() } : s,
          ),
        };
      });

      // Add new URL task
      const newTask: URLTask = {
        url: d.url,
        depth: d.depth,
        status: "crawling",
        startedAt: new Date(),
        steps: [],
      };
      urlTasks = [...urlTasks, newTask];

      return { ...base, logs: [...base.logs, entry], urlTasks, activeUrl: d.url };
    }

    case "CRAWL_PAGE_COMPLETE": {
      const d = action.payload;
      const entry = makeEntry("crawl_page_complete", `Done: ${d.url} — ${d.files_extracted} files, ${d.new_child_urls} child URLs`, d);
      const urlTasks = state.urlTasks.map((t) => {
        if (t.url !== d.url) return t;
        return {
          ...t,
          status: "completed" as const,
          completedAt: new Date(),
          filesExtracted: d.files_extracted,
          newChildUrls: d.new_child_urls,
          steps: t.steps.map((s) =>
            s.status === "active" ? { ...s, status: "completed" as const, completedAt: new Date() } : s,
          ),
        };
      });
      return { ...ensureStarted(state), logs: [...state.logs, entry], urlTasks };
    }

    case "CRAWL_PAGE_SKIPPED": {
      const d = action.payload;
      const entry = makeEntry("crawl_page_skipped", `Skipped: ${d.url} — ${d.reason}`, d);
      const newTask: URLTask = {
        url: d.url,
        depth: 0,
        status: "skipped",
        startedAt: new Date(),
        completedAt: new Date(),
        skipReason: d.reason,
        steps: [],
      };
      return { ...ensureStarted(state), logs: [...state.logs, entry], urlTasks: [...state.urlTasks, newTask] };
    }

    case "CRAWL_PAGE_ERROR": {
      const d = action.payload;
      const entry = makeEntry("crawl_page_error", `Error: ${d.url} — ${d.error}`, d);
      const urlTasks = state.urlTasks.map((t) => {
        if (t.url !== d.url) return t;
        return { ...t, status: "error" as const, errorMessage: d.error };
      });
      return { ...ensureStarted(state), logs: [...state.logs, entry], urlTasks };
    }

    case "CRAWL_SUMMARY": {
      const d = action.payload;
      const entry = makeEntry("crawl_summary", `Crawl complete: ${d.total_pages} pages, ${d.total_files} files, max depth ${d.max_depth_reached}`, d);
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
      setActiveToolCall(null);
    });

    es.addEventListener("tool_call", (e: MessageEvent) => {
      const data: SSEToolCallEvent = JSON.parse(e.data);
      dispatch({ type: "TOOL_CALL", payload: data });
      setActiveToolCall({ agent: data.agent, tool: data.tool, timestamp: Date.now() });
      if (toolTimeoutRef.current) clearTimeout(toolTimeoutRef.current);
      toolTimeoutRef.current = setTimeout(() => setActiveToolCall(null), 3000);
    });

    es.addEventListener("agent_log", (e: MessageEvent) => {
      const data: SSEAgentLogEvent = JSON.parse(e.data);
      if (data.chunk) {
        if (!chunkBufferRef.current[data.agent]) {
          chunkBufferRef.current[data.agent] = { text: "", timestamp: data.timestamp };
        }
        chunkBufferRef.current[data.agent].text += data.chunk;
        chunkBufferRef.current[data.agent].timestamp = data.timestamp;
        dispatch({ type: "AGENT_LOG_CHUNK", payload: data });
      } else {
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
