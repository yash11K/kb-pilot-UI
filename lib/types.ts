// ── Status Types ──────────────────────────────────────────────

export type FileStatus =
  | "pending_validation"
  | "approved"
  | "pending_review"
  | "auto_rejected"
  | "in_s3"
  | "rejected";

// ── Data Models ──────────────────────────────────────────────

export interface ValidationBreakdown {
  metadata_completeness: number;
  semantic_quality: number;
  uniqueness: number;
}

/** Full file model (returned by detail endpoints) */
export interface KBFile {
  id: string;
  filename: string;
  title: string;
  content_type: string;
  content_hash: string;
  source_url: string;
  component_type: string;
  source_id: string | null;
  aem_node_id: string;
  doc_type: string | null;
  md_content: string;
  modify_date: string | null;
  parent_context: string | null;
  region: string;
  brand: string;
  validation_score: number;
  validation_breakdown: ValidationBreakdown;
  validation_issues: string[];
  status: FileStatus;
  s3_bucket: string | null;
  s3_key: string | null;
  s3_uploaded_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
}

/** Light file model (returned by list endpoints, no md_content) */
export interface KBFileListItem {
  id: string;
  filename: string;
  title: string;
  content_type: string;
  component_type: string;
  region: string;
  brand: string;
  source_id: string;
  status: FileStatus;
  validation_score: number;
  created_at: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface IngestionJob {
  id: string;
  source_id: string | null;
  source_url: string;
  status: "in_progress" | "completed" | "failed";
  total_nodes_found: number;
  files_created: number;
  files_auto_approved: number;
  files_pending_review: number;
  files_auto_rejected: number;
  duplicates_skipped: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  max_depth: number;
  pages_crawled: number;
  current_depth: number;
}

/** Source list item (GET /sources) */
export interface SourceListItem {
  id: string;
  url: string;
  region: string;
  brand: string;
  nav_label: string | null;
  nav_section: string | null;
  last_ingested_at: string | null;
  created_at: string;
}

/** Source detail (GET /sources/{id}) */
export interface SourceDetail extends SourceListItem {
  updated_at: string;
  total_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  active_jobs: number;
  total_files: number;
  pending_review: number;
  approved: number;
  rejected: number;
}

export interface StartIngestionResponse {
  source_id: string;
  job_id: string;
  status: string;
}

export interface BatchIngestItem {
  source_id: string;
  job_id: string;
  url: string;
}

export interface BatchIngestResponse {
  jobs: BatchIngestItem[];
  status: string;
}

export type ActiveJobsMap = Record<string, string>; // source_id -> job_id

export interface RevalidationJob {
  id: string;
  status: "in_progress" | "completed" | "failed";
  total_files: number;
  completed: number;
  failed: number;
  not_found: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface BatchRevalidateRequest {
  file_ids: string[];
}

export interface BatchRevalidateResponse {
  job_id: string;
  status: "in_progress";
}

export interface StatsResponse {
  total_files: number;
  pending_review: number;
  approved: number;
  rejected: number;
  avg_score: number;
}

export interface IngestRequest {
  urls: string[];
  nav_root_url?: string;
  nav_metadata?: Record<string, { label?: string; section?: string; page_path?: string }>;
}

// ── Navigation Tree Types ────────────────────────────────────

export interface NavTreeNode {
  label: string;
  url: string | null;
  model_json_url: string | null;
  is_external: boolean;
  children: NavTreeNode[];
}

export interface NavTreeSection {
  section_name: string;
  nodes: NavTreeNode[];
}

export interface NavTree {
  brand: string;
  region: string;
  base_url: string;
  sections: NavTreeSection[];
}

// ── Deep Link Types ──────────────────────────────────────────

export type DeepLinkStatus = "pending" | "confirmed" | "dismissed" | "ingested";

export interface DeepLink {
  id: string;
  source_id?: string;
  url: string;
  model_json_url: string;
  anchor_text: string | null;
  found_in_node: string | null;
  found_in_page: string;
  status: DeepLinkStatus;
  created_at: string;
}

export const DEEP_LINK_STATUS_CONFIG: Record<DeepLinkStatus, { label: string; color: string; bg: string }> = {
  pending:   { label: "Pending",   color: "#d97706", bg: "#fffbeb" },
  confirmed: { label: "Confirmed", color: "#7c3aed", bg: "#f3f0ff" },
  ingested:  { label: "Ingested",  color: "#16a34a", bg: "#f0fdf4" },
  dismissed: { label: "Dismissed", color: "#6b7280", bg: "#f3f4f6" },
};

export interface SourceUrlStats {
  source_id: string;
  url: string;
  last_ingested_at: string | null;
  total_files: number;
  approved: number;
  pending_review: number;
  rejected: number;
}

export interface UrlLookupResponse {
  sources: Record<string, SourceUrlStats>;
}

export interface ActionResponse {
  success: boolean;
  message: string;
}

// ── Filter Types ─────────────────────────────────────────────

export interface QueueFilters {
  region?: string;
  brand?: string;
  content_type?: string;
  component_type?: string;
  sort_by?: string;
  sort_order?: "asc" | "desc";
  page?: number;
  size?: number;
  search?: string;
}

export interface FileFilters extends QueueFilters {
  status?: FileStatus;
  source_id?: string;
}


// ── Design System Constants ──────────────────────────────────

export const STATUS_CONFIG: Record<FileStatus, { label: string; color: string; bg: string }> = {
  pending_review:     { label: "Pending Review", color: "#7c3aed", bg: "#f3f0ff" },
  approved:           { label: "Approved",       color: "#16a34a", bg: "#f0fdf4" },
  in_s3:              { label: "In S3",          color: "#0891b2", bg: "#ecfeff" },
  auto_rejected:      { label: "Auto-Rejected",  color: "#dc2626", bg: "#fef2f2" },
  rejected:           { label: "Rejected",       color: "#9f1239", bg: "#fff1f2" },
  pending_validation: { label: "Validating",     color: "#6b7280", bg: "#f3f4f6" },
};

export function scoreColor(score: number): string {
  if (score >= 0.7) return "#16a34a";
  if (score >= 0.2) return "#d97706";
  return "#dc2626";
}

export function scoreBg(score: number): string {
  if (score >= 0.7) return "#f0fdf4";
  if (score >= 0.2) return "#fffbeb";
  return "#fef2f2";
}

export const JOB_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  completed:   { label: "Completed",   color: "#16a34a", bg: "#f0fdf4" },
  in_progress: { label: "In Progress", color: "#7c3aed", bg: "#f3f0ff" },
  failed:      { label: "Failed",      color: "#dc2626", bg: "#fef2f2" },
};

// ── SSE Event Types ──────────────────────────────────────────

export interface SSEProgressEvent {
  stage: string;
  message: string;
  timestamp: string;
  current?: number;
  total?: number;
  total_nodes?: number;
  filename?: string;
  status?: string;
  score?: number;
}

export interface SSEToolCallEvent {
  agent: "extractor" | "validator";
  tool: string;
  message: string;
  timestamp: string;
}

export interface SSEAgentLogEvent {
  agent: "extractor" | "validator";
  chunk?: string;
  message?: string;
  timestamp: string;
}

export interface SSECompleteEvent {
  message: string;
  files_created: number;
  files_auto_approved: number;
  files_pending_review: number;
  files_auto_rejected: number;
  duplicates_skipped: number;
  timestamp: string;
}

export interface SSEErrorEvent {
  message: string;
  timestamp: string;
}

// ── Crawl SSE Event Types ────────────────────────────────────

export interface CrawlPageStartEvent {
  url: string;
  depth: number;
  page_index: number;
  timestamp: string;
}

export interface CrawlPageCompleteEvent {
  url: string;
  depth: number;
  files_extracted: number;
  new_child_urls: number;
  timestamp: string;
}

export interface CrawlPageSkippedEvent {
  url: string;
  reason: string;
  timestamp: string;
}

export interface CrawlPageErrorEvent {
  url: string;
  error: string;
  timestamp: string;
}

export interface CrawlSummaryEvent {
  total_pages: number;
  total_files: number;
  max_depth_reached: number;
  skipped_count: number;
  failed_count: number;
  timestamp: string;
}

// ── Nav Preview Types ────────────────────────────────────────

export type SSEEventType = "progress" | "tool_call" | "agent_log" | "complete" | "error" | "queued" | "crawl_page_start" | "crawl_page_complete" | "crawl_page_skipped" | "crawl_page_error" | "crawl_summary";

export interface LogEntry {
  id: string;
  timestamp: Date;
  eventType: SSEEventType;
  agent?: "extractor" | "validator";
  message: string;
  raw: SSEProgressEvent | SSEToolCallEvent | SSEAgentLogEvent | SSECompleteEvent | SSEErrorEvent | CrawlPageStartEvent | CrawlPageCompleteEvent | CrawlPageSkippedEvent | CrawlPageErrorEvent | CrawlSummaryEvent;
}

export type JobStreamStatus = "connecting" | "queued" | "streaming" | "completed" | "error" | "disconnected";

export const SSE_EVENT_COLORS: Record<SSEEventType, { color: string; bg: string }> = {
  queued:               { color: "#9ca3af", bg: "#f3f4f6" },
  progress:             { color: "#2563eb", bg: "#eff6ff" },
  tool_call:            { color: "#7c3aed", bg: "#f3f0ff" },
  agent_log:            { color: "#6b7280", bg: "#f3f4f6" },
  complete:             { color: "#16a34a", bg: "#f0fdf4" },
  error:                { color: "#dc2626", bg: "#fef2f2" },
  crawl_page_start:     { color: "#0891b2", bg: "#ecfeff" },
  crawl_page_complete:  { color: "#059669", bg: "#ecfdf5" },
  crawl_page_skipped:   { color: "#9ca3af", bg: "#f3f4f6" },
  crawl_page_error:     { color: "#d97706", bg: "#fffbeb" },
  crawl_summary:        { color: "#7c3aed", bg: "#f3f0ff" },
};

export const AGENT_COLORS: Record<string, { color: string; bg: string }> = {
  extractor: { color: "#0891b2", bg: "#ecfeff" },
  validator: { color: "#d97706", bg: "#fffbeb" },
};

// ── Agentic Task View Types ─────────────────────────────────

export interface URLTask {
  url: string;
  depth: number;
  status: "crawling" | "completed" | "skipped" | "error";
  startedAt: Date;
  completedAt?: Date;
  filesExtracted?: number;
  newChildUrls?: number;
  skipReason?: string;
  errorMessage?: string;
  steps: AgentStep[];
}

export interface AgentStep {
  id: string;
  stage: string;
  agent?: "extractor" | "validator";
  label: string;
  status: "active" | "completed" | "error";
  startedAt: Date;
  completedAt?: Date;
  toolCalls: ToolCallEntry[];
  thinkingText: string;
  fileResults: FileResult[];
}

export interface ToolCallEntry {
  id: string;
  agent: string;
  tool: string;
  label: string;
  timestamp: Date;
}

export interface FileResult {
  filename: string;
  status: string;
  score?: number;
}

export const AGENT_IDENTITY: Record<string, { name: string; model: string; icon: string }> = {
  extractor: { name: "Extractor Agent", model: "Sonnet", icon: "E" },
  validator: { name: "Validator Agent", model: "Sonnet", icon: "V" },
};

export const SYSTEM_STEP_IDENTITY = { name: "Pipeline", model: "", icon: "P" };

// ── Knowledge Base Types ────────────────────────────────────

export interface KBSearchResult {
  title: string;
  excerpt: string;
  score: number;
  source_url?: string;
  file_id?: string;
}

/** A source chunk returned by /kb/chat `sources` event */
export interface KBChatSource {
  s3_uri: string;
  content: string;
}

/** A result chunk returned by /kb/search `result` event */
export interface KBSearchResultSSE {
  content: string;
  s3_uri: string;
  score: number;
  metadata: Record<string, unknown>;
}

export interface KBChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ── Context Agent Types ─────────────────────────────────────

export interface ContextMessage {
  role: "user" | "assistant";
  content: string;
}
