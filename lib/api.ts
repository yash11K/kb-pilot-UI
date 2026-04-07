import type {
  ActiveJobsMap,
  BatchIngestResponse,
  IngestRequest,
  IngestionJob,
  PaginatedResponse,
  KBFileListItem,
  KBFile,
  ActionResponse,
  StatsResponse,
  QueueFilters,
  FileFilters,
  RevalidationJob,
  BatchRevalidateResponse,
  SourceListItem,
  SourceDetail,
  StartIngestionResponse,
  NavTree,
  DeepLink,
  DeepLinkStatus,
  UrlLookupResponse,
} from "./types";
import { getToken, triggerLogout } from "@/components/AuthGate";

const BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// ── Helpers ──────────────────────────────────────────────────

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

function handleAuthError(res: Response): void {
  if (res.status === 401) {
    triggerLogout();
    throw new Error("Session expired. Please re-enter your access code.");
  }
}

/** Authenticated fetch — injects Bearer token and handles 401 globally. */
async function authFetch(input: string, init?: RequestInit): Promise<Response> {
  const merged: RequestInit = { ...init };
  const extra = (init?.headers as Record<string, string>) || {};
  merged.headers = authHeaders(extra);
  const res = await fetch(input, merged);
  handleAuthError(res);
  return res;
}

export function buildQueryString(
  params: Record<string, string | number | undefined>,
): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== "",
  );
  if (entries.length === 0) return "";
  return "?" + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join("&");
}

// ── Ingestion ────────────────────────────────────────────────

export async function startIngestion(req: IngestRequest): Promise<BatchIngestResponse> {
  const res = await authFetch(`${BASE}/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  return res.json();
}

export async function getIngestionJob(jobId: string): Promise<IngestionJob> {
  const res = await authFetch(`${BASE}/ingest/${jobId}`);
  return res.json();
}

// ── Queue ────────────────────────────────────────────────────

export async function getQueueFiles(
  filters: QueueFilters,
): Promise<PaginatedResponse<KBFileListItem>> {
  const qs = buildQueryString(filters as Record<string, string | number | undefined>);
  const res = await authFetch(`${BASE}/queue${qs}`);
  return res.json();
}

export async function getQueueFileDetail(fileId: string): Promise<KBFile> {
  const res = await authFetch(`${BASE}/queue/${fileId}`);
  return res.json();
}

export async function acceptFile(
  fileId: string,
  reviewedBy: string,
  reviewNotes?: string,
): Promise<ActionResponse> {
  const body: Record<string, string> = { reviewed_by: reviewedBy };
  if (reviewNotes) body.review_notes = reviewNotes;
  const res = await authFetch(`${BASE}/queue/${fileId}/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function rejectFile(
  fileId: string,
  reviewedBy: string,
  reviewNotes: string,
): Promise<ActionResponse> {
  const res = await authFetch(`${BASE}/queue/${fileId}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reviewed_by: reviewedBy, review_notes: reviewNotes }),
  });
  return res.json();
}

export async function updateFileContent(
  fileId: string,
  mdContent: string,
  reviewedBy: string,
): Promise<ActionResponse> {
  const res = await authFetch(`${BASE}/queue/${fileId}/update`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ md_content: mdContent, reviewed_by: reviewedBy }),
  });
  return res.json();
}

// ── Files ────────────────────────────────────────────────────

export async function getAllFiles(
  filters: FileFilters,
): Promise<PaginatedResponse<KBFileListItem>> {
  const qs = buildQueryString(filters as Record<string, string | number | undefined>);
  const res = await authFetch(`${BASE}/files${qs}`);
  return res.json();
}

export async function getFileDetail(fileId: string): Promise<KBFile> {
  const res = await authFetch(`${BASE}/files/${fileId}`);
  return res.json();
}

// ── Stats ────────────────────────────────────────────────────

export async function getStats(): Promise<StatsResponse> {
  const res = await authFetch(`${BASE}/stats`);
  return res.json();
}

// ── Revalidation ─────────────────────────────────────────────

export async function revalidateFile(fileId: string): Promise<KBFile> {
  const res = await authFetch(`${BASE}/files/${fileId}/revalidate`, {
    method: "POST",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Revalidation failed (${res.status})`);
  }
  return res.json();
}

export async function revalidateUniqueness(fileId: string): Promise<KBFile> {
  const res = await authFetch(`${BASE}/files/${fileId}/revalidate-uniqueness`, {
    method: "POST",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Uniqueness check failed (${res.status})`);
  }
  return res.json();
}

export async function batchRevalidate(
  fileIds: string[],
): Promise<BatchRevalidateResponse> {
  const res = await authFetch(`${BASE}/revalidate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_ids: fileIds }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Batch revalidation failed (${res.status})`);
  }
  return res.json();
}

export async function batchRevalidateUniqueness(
  fileIds: string[],
): Promise<BatchRevalidateResponse> {
  const res = await authFetch(`${BASE}/revalidate-uniqueness`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_ids: fileIds }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Batch uniqueness check failed (${res.status})`);
  }
  return res.json();
}

export async function getRevalidationJob(
  jobId: string,
): Promise<RevalidationJob> {
  const res = await authFetch(`${BASE}/revalidate/${jobId}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Failed to fetch job (${res.status})`);
  }
  return res.json();
}

// ── Sources ──────────────────────────────────────────────────

export async function getActiveSourceJobs(): Promise<ActiveJobsMap> {
  const res = await authFetch(`${BASE}/sources/active-jobs`);
  return res.json();
}

export async function getSources(
  params: { region?: string; brand?: string; page?: number; size?: number },
): Promise<PaginatedResponse<SourceListItem>> {
  const qs = buildQueryString(params as Record<string, string | number | undefined>);
  const res = await authFetch(`${BASE}/sources${qs}`);
  return res.json();
}

export async function getSourceDetail(sourceId: string): Promise<SourceDetail> {
  const res = await authFetch(`${BASE}/sources/${sourceId}`);
  return res.json();
}

export async function getSourceJobs(
  sourceId: string,
  page: number,
  size: number,
): Promise<PaginatedResponse<IngestionJob>> {
  const qs = buildQueryString({ page, size });
  const res = await authFetch(`${BASE}/sources/${sourceId}/jobs${qs}`);
  return res.json();
}

export async function reIngestSource(sourceId: string): Promise<StartIngestionResponse> {
  const res = await authFetch(`${BASE}/sources/${sourceId}/ingest`, {
    method: "POST",
  });
  return res.json();
}

// ── Source URL Lookup ────────────────────────────────────────

export async function lookupProcessedUrls(urls: string[]): Promise<UrlLookupResponse> {
  const res = await authFetch(`${BASE}/sources/lookup-urls`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ urls }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Failed to lookup URLs (${res.status})`);
  }
  return res.json();
}

// ── Navigation Tree ─────────────────────────────────────────

export async function fetchNavTree(url: string, forceRefresh = false): Promise<NavTree> {
  const qs = buildQueryString({ url, force_refresh: forceRefresh ? "true" : undefined });
  const res = await authFetch(`${BASE}/nav/tree${qs}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Failed to load navigation tree (${res.status})`);
  }
  return res.json();
}

// ── Deep Links ──────────────────────────────────────────────

export async function getAllDeepLinks(status?: DeepLinkStatus, page = 1, size = 50): Promise<PaginatedResponse<DeepLink>> {
  const qs = buildQueryString({ status, page, size });
  const res = await authFetch(`${BASE}/deep-links${qs}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Failed to load deep links (${res.status})`);
  }
  return res.json();
}

export async function getDeepLinks(sourceId: string, status = "pending", foundInPage?: string): Promise<DeepLink[]> {
  const qs = buildQueryString({ status, found_in_page: foundInPage });
  const res = await authFetch(`${BASE}/deep-links/${sourceId}${qs}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Failed to load deep links (${res.status})`);
  }
  return res.json();
}

export async function confirmDeepLinks(
  sourceId: string,
  linkIds: string[],
): Promise<StartIngestionResponse> {
  const res = await authFetch(`${BASE}/deep-links/${sourceId}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ link_ids: linkIds }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Failed to confirm deep links (${res.status})`);
  }
  return res.json();
}

export async function dismissDeepLinks(
  sourceId: string,
  linkIds: string[],
): Promise<void> {
  const res = await authFetch(`${BASE}/deep-links/${sourceId}/dismiss`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ link_ids: linkIds }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Failed to dismiss deep links (${res.status})`);
  }
}

// ── Knowledge Base ──────────────────────────────────────────

/**
 * Stream SSE from a POST endpoint.
 * Returns an AbortController so the caller can cancel.
 */
export function streamSSE(
  url: string,
  body: object,
  onEvent: (event: string, data: string) => void,
  onDone?: () => void,
  onError?: (err: Error) => void,
): AbortController {
  const ctrl = new AbortController();

  (async () => {
    try {
      const res = await authFetch(`${BASE}${url}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        if (res.status === 401) {
          // already handled by authFetch, but just in case
          triggerLogout();
          throw new Error("Session expired");
        }
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.detail || `Request failed (${res.status})`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let currentEvent = "message";
        for (const line of lines) {
          if (line.startsWith("event:")) {
            currentEvent = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            onEvent(currentEvent, line.slice(5).trim());
            currentEvent = "message";
          }
        }
      }

      onDone?.();
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      onError?.(err as Error);
    }
  })();

  return ctrl;
}

export interface KBSearchCallbacks {
  onSearchStart?: (query: string, total: number) => void;
  onResult?: (result: { content: string; s3_uri: string; score: number; metadata: Record<string, unknown> }) => void;
  onSearchEnd?: (query: string, total: number) => void;
  onError?: (err: Error) => void;
}

export function kbSearch(
  query: string,
  limit = 10,
  callbacks: KBSearchCallbacks,
): AbortController {
  return streamSSE(
    "/kb/search",
    { query, limit },
    (event, data) => {
      try {
        const parsed = JSON.parse(data);
        switch (event) {
          case "search_start":
            callbacks.onSearchStart?.(parsed.query, parsed.total);
            break;
          case "result":
            callbacks.onResult?.(parsed);
            break;
          case "search_end":
            callbacks.onSearchEnd?.(parsed.query, parsed.total);
            break;
          case "error":
            callbacks.onError?.(new Error(parsed.message));
            break;
        }
      } catch { /* ignore non-JSON */ }
    },
    () => {
      // stream closed — if search_end wasn't sent, treat as done
    },
    callbacks.onError,
  );
}

// ── Agent Chat ──────────────────────────────────────────────

export function streamAgentChat(
  message: string,
  conversation: { role: string; content: string }[],
  onToken: (text: string) => void,
  onDone?: () => void,
  onError?: (err: Error) => void,
): AbortController {
  return streamSSE(
    "/agent/chat",
    { message, conversation },
    (event, data) => {
      if (event === "token") {
        try {
          const parsed = JSON.parse(data);
          if (parsed.text) onToken(parsed.text);
        } catch {
          // ignore non-JSON
        }
      }
      // "done" event is handled by streamSSE's onDone
    },
    onDone,
    onError,
  );
}

export interface KBChatCallbacks {
  onSources?: (sources: { s3_uri: string; content: string }[]) => void;
  onToken?: (text: string) => void;
  onDone?: (query: string) => void;
  onError?: (err: Error) => void;
}

export function kbChat(
  query: string,
  contextLimit = 5,
  callbacks: KBChatCallbacks,
): AbortController {
  return streamSSE(
    "/kb/chat",
    { query, context_limit: contextLimit },
    (event, data) => {
      try {
        const parsed = JSON.parse(data);
        switch (event) {
          case "sources":
            callbacks.onSources?.(parsed.sources ?? []);
            break;
          case "token":
            callbacks.onToken?.(parsed.text ?? "");
            break;
          case "done":
            callbacks.onDone?.(parsed.query ?? query);
            break;
          case "error":
            callbacks.onError?.(new Error(parsed.message));
            break;
        }
      } catch { /* ignore non-JSON */ }
    },
    () => {
      // stream closed
    },
    callbacks.onError,
  );
}

// ── S3 Source Download ───────────────────────────────────────

/**
 * Get a presigned download URL for an S3 source file.
 * Backend returns { url: "https://..." } with a short-lived presigned URL.
 */
export async function getSourceDownloadUrl(s3Uri: string): Promise<string> {
  const res = await authFetch(`${BASE}/kb/download`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ s3_uri: s3Uri }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Failed to get download URL (${res.status})`);
  }
  const data = await res.json();
  return data.url;
}

// ── Context Agent ──────────────────────────────────────────

export function streamContextChat(
  fileId: string | null,
  conversation: { role: string; content: string }[],
  onToken: (text: string) => void,
  onDone?: () => void,
  onError?: (err: Error) => void,
): AbortController {
  const body: Record<string, unknown> = { conversation };
  if (fileId) body.file_id = fileId;
  return streamSSE(
    "/context/chat",
    body,
    (_event, data) => {
      try {
        const parsed = JSON.parse(data);
        if (parsed.text) onToken(parsed.text);
      } catch {
        // ignore non-JSON lines
      }
    },
    onDone,
    onError,
  );
}

// ── Uniqueness Review ───────────────────────────────────────

import type {
  UniquenessReviewSession,
  PairwiseComparison,
  SimilarActionResponse,
} from "./types";

export async function startUniquenessReview(
  fileId: string,
  limit = 5,
): Promise<UniquenessReviewSession> {
  const res = await authFetch(`${BASE}/files/${fileId}/uniqueness-review?limit=${limit}`, {
    method: "POST",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Uniqueness review failed (${res.status})`);
  }
  return res.json();
}

export async function getPairwiseComparison(
  fileId: string,
  similarFileId: string,
): Promise<PairwiseComparison> {
  const res = await authFetch(`${BASE}/files/${fileId}/similar/${similarFileId}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Pairwise comparison failed (${res.status})`);
  }
  return res.json();
}

export async function takeSimilarAction(
  fileId: string,
  similarFileId: string,
  action: "dismiss" | "delete" | "reject" | "keep_both",
  reviewedBy: string,
  notes?: string,
): Promise<SimilarActionResponse> {
  const body: Record<string, string> = { action, reviewed_by: reviewedBy };
  if (notes) body.notes = notes;
  const res = await authFetch(`${BASE}/files/${fileId}/similar/${similarFileId}/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.detail || `Action failed (${res.status})`);
  }
  return res.json();
}
