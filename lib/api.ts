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
} from "./types";

const BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// ── Helpers ──────────────────────────────────────────────────

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
  const res = await fetch(`${BASE}/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  return res.json();
}

export async function getIngestionJob(jobId: string): Promise<IngestionJob> {
  const res = await fetch(`${BASE}/ingest/${jobId}`);
  return res.json();
}

// ── Queue ────────────────────────────────────────────────────

export async function getQueueFiles(
  filters: QueueFilters,
): Promise<PaginatedResponse<KBFileListItem>> {
  const qs = buildQueryString(filters as Record<string, string | number | undefined>);
  const res = await fetch(`${BASE}/queue${qs}`);
  return res.json();
}

export async function getQueueFileDetail(fileId: string): Promise<KBFile> {
  const res = await fetch(`${BASE}/queue/${fileId}`);
  return res.json();
}

export async function acceptFile(
  fileId: string,
  reviewedBy: string,
  reviewNotes?: string,
): Promise<ActionResponse> {
  const body: Record<string, string> = { reviewed_by: reviewedBy };
  if (reviewNotes) body.review_notes = reviewNotes;
  const res = await fetch(`${BASE}/queue/${fileId}/accept`, {
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
  const res = await fetch(`${BASE}/queue/${fileId}/reject`, {
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
  const res = await fetch(`${BASE}/queue/${fileId}/update`, {
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
  const res = await fetch(`${BASE}/files${qs}`);
  return res.json();
}

export async function getFileDetail(fileId: string): Promise<KBFile> {
  const res = await fetch(`${BASE}/files/${fileId}`);
  return res.json();
}

// ── Stats ────────────────────────────────────────────────────

export async function getStats(): Promise<StatsResponse> {
  const res = await fetch(`${BASE}/stats`);
  return res.json();
}

// ── Revalidation ─────────────────────────────────────────────

export async function revalidateFile(fileId: string): Promise<KBFile> {
  const res = await fetch(`${BASE}/files/${fileId}/revalidate`, {
    method: "POST",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Revalidation failed (${res.status})`);
  }
  return res.json();
}

export async function batchRevalidate(
  fileIds: string[],
): Promise<BatchRevalidateResponse> {
  const res = await fetch(`${BASE}/revalidate`, {
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

export async function getRevalidationJob(
  jobId: string,
): Promise<RevalidationJob> {
  const res = await fetch(`${BASE}/revalidate/${jobId}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Failed to fetch job (${res.status})`);
  }
  return res.json();
}

// ── Sources ──────────────────────────────────────────────────

export async function getActiveSourceJobs(): Promise<ActiveJobsMap> {
  const res = await fetch(`${BASE}/sources/active-jobs`);
  return res.json();
}

export async function getSources(
  params: { region?: string; brand?: string; page?: number; size?: number },
): Promise<PaginatedResponse<SourceListItem>> {
  const qs = buildQueryString(params as Record<string, string | number | undefined>);
  const res = await fetch(`${BASE}/sources${qs}`);
  return res.json();
}

export async function getSourceDetail(sourceId: string): Promise<SourceDetail> {
  const res = await fetch(`${BASE}/sources/${sourceId}`);
  return res.json();
}

export async function getSourceJobs(
  sourceId: string,
  page: number,
  size: number,
): Promise<PaginatedResponse<IngestionJob>> {
  const qs = buildQueryString({ page, size });
  const res = await fetch(`${BASE}/sources/${sourceId}/jobs${qs}`);
  return res.json();
}

export async function reIngestSource(sourceId: string): Promise<StartIngestionResponse> {
  const res = await fetch(`${BASE}/sources/${sourceId}/ingest`, {
    method: "POST",
  });
  return res.json();
}

// ── Navigation Tree ─────────────────────────────────────────

export async function fetchNavTree(url: string, forceRefresh = false): Promise<NavTree> {
  const qs = buildQueryString({ url, force_refresh: forceRefresh ? "true" : undefined });
  const res = await fetch(`${BASE}/nav/tree${qs}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Failed to load navigation tree (${res.status})`);
  }
  return res.json();
}

// ── Deep Links ──────────────────────────────────────────────

export async function getAllDeepLinks(status?: DeepLinkStatus): Promise<PaginatedResponse<DeepLink>> {
  const qs = buildQueryString({ status });
  const res = await fetch(`${BASE}/deep-links${qs}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Failed to load deep links (${res.status})`);
  }
  return res.json();
}

export async function getDeepLinks(sourceId: string, status = "pending"): Promise<DeepLink[]> {
  const qs = buildQueryString({ status });
  const res = await fetch(`${BASE}/deep-links/${sourceId}${qs}`);
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
  const res = await fetch(`${BASE}/deep-links/${sourceId}/confirm`, {
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
  const res = await fetch(`${BASE}/deep-links/${sourceId}/dismiss`, {
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
      const res = await fetch(`${BASE}${url}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });

      if (!res.ok) {
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

export function kbSearch(
  query: string,
  limit = 10,
  onResult: (data: string) => void,
  onDone?: () => void,
  onError?: (err: Error) => void,
): AbortController {
  return streamSSE(
    "/kb/search",
    { query, limit },
    (_event, data) => onResult(data),
    onDone,
    onError,
  );
}

export function kbChat(
  query: string,
  contextLimit = 5,
  onToken: (data: string) => void,
  onDone?: () => void,
  onError?: (err: Error) => void,
): AbortController {
  return streamSSE(
    "/kb/chat",
    { query, context_limit: contextLimit },
    (_event, data) => onToken(data),
    onDone,
    onError,
  );
}
