# KB Manager — Comprehensive Code Review

> **Date**: March 31, 2026  
> **Scope**: Full codebase audit — performance, architecture, navigation flows, state management, styling, dependencies, dead code, type safety, accessibility, security, and API layer.

---

## 1. Performance Issues

### 1.1 Unnecessary Re-renders

- **`StatsStrip.tsx`** accesses `window.location.search` directly in the render body (line ~`const searchParams = typeof window !== "undefined" ? window.location.search : ""`). This is not reactive — it reads once and never updates. It should use `useSearchParams()` from Next.js instead, which is already imported but unused for this purpose.

- **`DiscoveryPage`** calls `useResizableColumns` unconditionally even when `speedMode` is true (the hook runs before the early return). The hook attaches `mousemove`/`mouseup` listeners to `window` even when the table isn't rendered. Move the hook call below the speed mode guard or conditionally skip listener attachment.

- **`FilesPage`** instantiates both `useQueueFiles` and `useAllFiles` hooks simultaneously regardless of which tab is active. Both fire network requests on mount. Only the active tab's hook should fetch. Use a conditional SWR key (`null` to skip) for the inactive tab.

- **`DashboardPage`** calls `useSources({ page: 1, size: 5 })`, `useDiscoveryLinks("pending")`, and `useActiveJobs()` all on mount. The discovery links hook fetches up to 50 items just to get a count. Consider a dedicated lightweight count endpoint or pass `size: 1` to minimize payload.

- **`useJobStream` reducer** creates new arrays on every action via spread operators (`[...state.logs, entry]`, `[...state.urlTasks]`). For long-running ingestion jobs with hundreds of events, this causes O(n²) memory allocation. Consider using a mutable ref for logs and only triggering re-renders on batched intervals.

### 1.2 Missing Memoization

- **`DiscoveryPage`** — `groups` is memoized but `resolvedCollapsed` depends on `groups` and recalculates on every render when `collapsedGroups` is null (the default). This triggers re-renders of all group rows.

- **`SpeedReview`** — `initialTotal` is set via a side-effect in the render body (`if (files.length > 0 && initialTotal === null) { setInitialTotal(files.length); }`). This triggers an extra render. Use `useRef` instead.

- **`DataTable`** — `renderRow` is defined inline and recreated every render. For large tables, this means all rows re-render on any parent state change. Wrap in `useCallback` or extract to a memoized component.

### 1.3 Polling & Network

- **`useActiveJobs`** polls every 5 seconds unconditionally, even when no jobs are active. Add a condition: only poll when the previous response had active jobs.

- **`useDiscoveryLinks`** and **`useDeepLinks`** both poll every 30 seconds unconditionally. These should only poll when the user is on the relevant page.

- **`useStats`** polls every 30 seconds globally (it's used in `Sidebar`, `StatsStrip`, `DashboardPage`, `FilesPage`). Multiple components mounting this hook create multiple SWR subscriptions to the same key, which SWR deduplicates — this is fine. But the 30s interval runs even when the tab is backgrounded. Consider using `refreshWhenHidden: false`.

### 1.4 Bundle Size

- **`react-markdown` + `remark-gfm`** are heavy dependencies (~50KB+ gzipped). They're used in `MdPreview` which is rendered inside modals, chat panels, speed cards, and file detail pages. Consider lazy-loading `MdPreview` with `React.lazy()` + `Suspense` since it's never above the fold.

- **`IngestWizard.tsx`** is 988 lines — the largest component. It includes file upload logic, nav tree browsing, custom URL validation, and a 3-step wizard. This should be split into sub-components (`UrlStep`, `BrowseStep`, `ConfirmStep`, `FileUploadZone`).

---

## 2. Structural & Architectural Issues

### 2.1 Route Structure vs. Wireframe Spec

The wireframe spec defines these routes:
```
/dashboard, /queue, /files, /jobs
```

The actual implementation has:
```
/dashboard, /files (with tab=pending for queue), /sources, /sources/[sourceId],
/sources/[sourceId]/files/[fileId], /discovery, /kb
```

- **`/queue` was removed** — queue functionality was merged into `/files` with a `tab=pending` query param. This is a valid architectural decision but creates a mismatch with the wireframe. The `StatsStrip` still links to `/queue` which doesn't exist as a route.
- **`/jobs` was removed** — job viewing is now per-source at `/sources/[sourceId]?tab=jobs`. No global jobs list page exists.
- **`/sources`, `/discovery`, `/kb`** are new additions not in the original spec.

**Action**: Update `StatsStrip` card hrefs — "Pending Review" links to `/queue` which doesn't exist. Should be `/files?tab=pending`.

### 2.2 Component Responsibility Overlap

- **`AssistantFooter.tsx`** and **`AgentChatPanel.tsx`** both implement chat UIs that talk to the same backend. `AssistantFooter` uses `streamContextChat` directly while `AgentChatPanel` uses the `useAgentChat` hook (which calls `streamAgentChat`). These are different endpoints (`/context/chat` vs `/agent/chat`) but the UI patterns are nearly identical. Consider a shared `ChatUI` component.

- **`FileDetailsCollapsible.tsx`** contains its own `DeepLinksSection` and `ContextAgentSection` sub-components with their own state management. The file detail page at `/sources/[sourceId]/files/[fileId]/page.tsx` also has its own `DeepLinksPanel` that duplicates the deep links logic. This is code duplication.

- **`ContextPanel.tsx`** exists as a standalone component but is never imported anywhere. It appears to be a leftover from a previous iteration where the context agent was a separate panel rather than embedded in `FileDetailsCollapsible`.

### 2.3 Inconsistent Data Fetching Patterns

- Some components fetch data directly in `useEffect` (e.g., `DeepLinksSection` in `FileDetailsCollapsible`, `DeepLinksPanel` in the file detail page) while others use SWR hooks. This creates inconsistency in caching, error handling, and loading states.

- **`SourceCard.tsx`** creates a new `useJobStream` SSE connection for each expanded card's `InlinePreview`. If multiple source cards are expanded simultaneously, this opens multiple SSE connections. There's no cleanup coordination.

### 2.4 File Organization

- **`lib/types.ts`** is 350+ lines and contains data models, filter types, design system constants, SSE event types, agentic task types, and KB types all in one file. Split into `types/models.ts`, `types/events.ts`, `types/constants.ts`, etc.

- **`lib/api.ts`** is 280+ lines with 25+ functions. Group by domain: `api/ingestion.ts`, `api/files.ts`, `api/sources.ts`, `api/kb.ts`, etc.

---

## 3. Navigation Flow Audit

### 3.1 Sidebar Navigation

| Nav Item | Target | Works? | Notes |
|---|---|---|---|
| Dashboard | `/dashboard` | ✅ | |
| Sources | `/sources` | ✅ | |
| Discovery | `/discovery` | ✅ | |
| KB | `/kb` | ✅ | |
| Files | `/files` | ✅ | Pulsing badge shows `pending_review` count |

**Issue**: The pulsing badge is on the "Files" nav item but conceptually represents the review queue. Since queue was merged into files, this is technically correct but may confuse users expecting a separate queue entry.

### 3.2 Dashboard Quick Actions

| Button | Target | Works? | Notes |
|---|---|---|---|
| Speed Review | `/files?tab=pending&mode=speed` | ✅ | |
| Speed Discovery | `/discovery?mode=speed` | ✅ | |
| Pending Review | `/files?tab=pending` | ✅ | |
| New Ingestion | Opens `IngestWizard` | ✅ | |
| All Files | `/files` | ✅ | |

### 3.3 StatsStrip Card Navigation

| Card | Target | Works? | Issue |
|---|---|---|---|
| Total Files | `/files` | ✅ | |
| Pending Review | `/queue` | ❌ | **Route doesn't exist**. Should be `/files?tab=pending` |
| Approved / In S3 | `/files?status=in_s3` | ⚠️ | Links to files page but `status` is a `FileFilters` param, not a URL query param that `FilesPage` reads on mount. The `fileFilters` state initializes `status` from `searchParams.get("status")` so this works, but only for the "all" tab. |
| Rejected | `/files?status=rejected` | ⚠️ | Same issue as above |
| Avg Score | No action | ✅ | |

### 3.4 Back Button Flows

| Page | Back Button | Target | Works? |
|---|---|---|---|
| Source Detail | "Back to Sources" | `/sources` | ✅ |
| File Detail (full page) | Breadcrumb arrows | `/sources` → `/sources/[id]` | ✅ |
| Speed Review | "Back to Table" | Exits speed mode | ✅ |
| Speed Discovery | "Back to Discovery" | Exits speed mode | ✅ |
| File Modal | Close button / backdrop click | Closes modal | ✅ |
| IngestWizard | Back/Cancel buttons | Step navigation / close | ✅ |

### 3.5 Cross-Navigation Issues

- **File row click in `/files`**: If the file has a `source_id`, navigates to `/sources/${source_id}/files/${file.id}`. Otherwise opens `FileModal`. This dual behavior may confuse users — clicking a row sometimes navigates away and sometimes opens a modal.

- **FileModal "Open full view" button**: Navigates to `/sources/${source_id}/files/${file.id}` and closes the modal. This is good but only appears when `source_id` exists.

- **IngestWizard completion**: After successful ingestion, navigates to `/sources/${sourceId}?tab=jobs`. If no source ID is returned, falls back to `/sources`. This is correct.

- **Dashboard "Active Ingestions" links**: Navigate to `/sources/${sourceId}?tab=jobs`. Correct.

---

## 4. State Management Audit

### 4.1 State Lifting Issues

- **`FilesPage`** manages two separate filter states (`queueFilters` and `fileFilters`) plus `activeTab`, `speedMode`, `selectedFileId`, `selectedIds`, and `batchJobId`. This is a lot of state for one component. The tab switching logic duplicates filter handling. Consider a reducer or extracting tab-specific logic into sub-components.

- **`DiscoveryPage`** manages `statusFilter`, `searchQuery`, `selectedIds`, `confirming`, `dismissing`, `collapsedGroups`, `page`, `speedMode`, and `decisions` — 9+ state variables. This should be a reducer.

### 4.2 State Duplication

- **`SpeedReview`** tracks `initialTotal` in state and `done` count separately. The `initialTotal` is set via a render-time side effect. This could be a single `useRef`.

- **`useAgentChat`** maintains both `messages` state and `committedRef`. The ref tracks "committed" messages (excluding in-progress streaming) while state tracks the display. This is correct but complex — document the distinction.

### 4.3 localStorage Usage

- **Sidebar** stores `collapsed` state and `width` in localStorage with keys `"sidebar-collapsed"` and `"sidebar-width"`. No namespace prefix — could collide with other apps on the same domain.

---

## 5. Dead Code & Fallback Remnants

### 5.1 Unused Components

- **`ContextPanel.tsx`** — Not imported anywhere. Appears to be from an earlier iteration where context agent was a standalone panel. The functionality now lives inside `FileDetailsCollapsible.tsx`.

- **`AssistantFooter.tsx`** — Not imported in `ShellLayout` or any page. The shell layout uses `AgentChatPanel` instead. This is a leftover from when the assistant was a sticky footer rather than a slide-out panel.

- **`LogViewer.tsx`** — Not imported anywhere. The source detail page uses `AgenticTaskView` instead. This was the original log viewer before the agentic task visualization was built.

### 5.2 Unused Exports/Types

- **`KBSearchResult`**, **`KBChatMessage`** in `types.ts` — Not imported anywhere. These were likely planned for the KB page but the actual implementation uses inline types.

- **`BatchRevalidateRequest`** in `types.ts` — Never used. The `batchRevalidate` function in `api.ts` constructs the body inline.

- **`IngestRequest`** type in the wireframe spec differs from the actual `IngestRequest` in `types.ts`. The spec had `url`, `region`, `brand` fields; the implementation has `urls[]`, `nav_root_url`, `nav_metadata`. This reflects the evolution from single-URL to batch ingestion with nav tree support.

### 5.3 Commented-Out / Vestigial Code

- **`globals.css`** has a comment `/* Bottom tab navigation — removed */` indicating mobile bottom nav was planned but removed.

- **`AgenticTaskView.tsx`** has `// eslint-disable-next-line @typescript-eslint/no-unused-vars` for `currentStage` and `progress` props — these are passed in but not used in the component. They're used in `LogViewer` (which is dead code). Remove these props.

- **`useJobStream.ts`** has a `SET_SOURCE_URL` action type that returns state unchanged — it's a no-op. Remove it.

### 5.4 Wireframe Spec Drift

The wireframe spec (`FRONTEND_WIREFRAME.md`) describes features that were never built or were replaced:
- **Queue page** (`/queue`) — merged into `/files`
- **Jobs page** (`/jobs`) — replaced by per-source job views
- **IngestModal** — replaced by `IngestWizard` (multi-step with nav tree)
- **Bottom tab navigation for mobile** — removed
- **SWR or TanStack Query** — SWR was chosen

The wireframe should be updated to reflect the current architecture, or archived with a note.

---

## 6. Type Safety Issues

### 6.1 Missing Error Handling in API Layer

Most API functions in `lib/api.ts` don't check `res.ok` before calling `res.json()`. For example:

```typescript
export async function getStats(): Promise<StatsResponse> {
  const res = await fetch(`${BASE}/stats`);
  return res.json(); // No error check!
}
```

If the server returns a 4xx/5xx, this silently returns the error body as if it were valid data. Only `revalidateFile`, `batchRevalidate`, `getRevalidationJob`, `fetchNavTree`, `getAllDeepLinks`, `getDeepLinks`, `confirmDeepLinks`, `dismissDeepLinks`, and `lookupProcessedUrls` check `res.ok`. The rest don't.

**Fix**: Add `if (!res.ok) throw new Error(...)` to all API functions, or create a shared `fetchJSON` helper.

### 6.2 Type Assertions

- **`FilesPage`** uses `return undefined as unknown as typeof queueData` in optimistic update callbacks — this is a workaround for SWR's mutate typing. It works but is fragile.

- **`buildQueryString`** casts filters with `as Record<string, string | number | undefined>` — this loses type safety on the filter keys.

### 6.3 Loose Types

- **`FileModal`** has `invalidateCache` that types the mutate key as `(key: string)` but SWR keys can be arrays or other types. Should be `(key: unknown)`.

- **`StatsStrip`** uses `activeFilter` prop that's typed but immediately aliased to `_activeFilter` and ignored. Remove the prop.

---

## 7. API Layer Issues

### 7.1 No Request Deduplication for Mutations

Accept/reject operations in `FilesPage` and `SpeedReview` don't prevent double-clicks. If a user rapidly clicks accept, multiple POST requests fire. Add a loading state per file ID or disable the action during the request.

### 7.2 SSE Connection Management

- **`useJobStream`** uses `EventSource` (GET-based SSE) but the API spec shows `GET /ingest/{job_id}/stream`. This is correct.

- **`kbSearch`, `kbChat`, `streamAgentChat`, `streamContextChat`** use POST-based SSE via `fetch` with manual stream reading. This is a custom implementation since `EventSource` only supports GET. The implementation is solid but there's no reconnection logic — if the connection drops, the stream just ends.

### 7.3 Missing Abort Cleanup

- **`AgentChatPanel`** doesn't abort the stream on unmount. If the panel is closed while streaming, the fetch continues in the background.

- **`KBPage`** does abort on unmount via `useEffect(() => { return () => ctrlRef.current?.abort(); }, [])` — this is correct.

---

## 8. Accessibility Gaps

- **SwipeRow**: Swipe gestures have no keyboard alternative. Users who can't use a mouse/touch have no way to accept/reject from the table. Add keyboard shortcuts or action buttons that appear on focus.

- **SpeedCard**: Drag-to-swipe has no keyboard alternative. The "View Full Detail" button is the only keyboard-accessible action.

- **DataTable**: No `aria-sort` attributes on sortable columns. No `role="grid"` on the table.

- **Modals**: `FileModal` and `AgenticTaskView` don't trap focus. Pressing Tab can move focus behind the modal overlay. Add focus trapping.

- **Toast**: Uses `role="status"` which is correct for non-urgent notifications. However, error toasts should use `role="alert"` for screen reader announcement.

- **Color-only indicators**: Score pills and status badges rely on color alone to convey meaning. The text labels help, but the score dot (colored circle) before the percentage is purely decorative color.

---

## 9. Security Considerations

- **`NEXT_PUBLIC_REVIEWER_EMAIL`** is hardcoded as a fallback to `"reviewer@example.com"`. This is used in accept/reject API calls. In production, this should come from an auth system, not an env variable.

- **API calls don't include authentication headers**. The `fetch` calls in `lib/api.ts` have no `Authorization` header. This assumes the backend handles auth via cookies or is behind a proxy. Document this assumption.

- **`MdPreview`** renders user-provided markdown via `react-markdown`. While `react-markdown` is safe by default (no `dangerouslySetInnerHTML`), links in the markdown could be malicious. The `a` component renders `href` directly without sanitization. Consider adding `rel="noopener noreferrer"` and `target="_blank"` to external links.

---

## 10. CSS & Styling Audit

### 10.1 Inline Styles vs. Tailwind

The entire codebase uses inline `style={{}}` objects instead of Tailwind classes, despite Tailwind being configured and imported. This means:
- No utility class reuse
- No responsive utilities from Tailwind (all responsive behavior is in `globals.css` media queries)
- Larger component files
- No design token enforcement via Tailwind config

This appears to be a deliberate choice (matching the reference prototype's style), but it defeats the purpose of having Tailwind in the stack. Either commit to Tailwind or remove it to reduce bundle size.

### 10.2 Duplicate Animation Definitions

`@keyframes spin`, `@keyframes pulse`, and `@keyframes fadeIn` are defined in:
- `globals.css`
- `FileModal.tsx`
- `DataTable.tsx`
- `SourceCard.tsx`
- `SourcesTable.tsx`
- `FileDetailsCollapsible.tsx`
- `AgenticTaskView.tsx` (as `atv-spin`, `atv-pulse`)
- `LogViewer.tsx` (as `logSpin`)
- Multiple other components via inline `<style>` tags

Each component injects its own `<style>` tag with duplicate keyframes. Define these once in `globals.css` and reference them everywhere.

### 10.3 Tailwind Config

The Tailwind config extends with custom colors (`background`, `surface`, `border`, `foreground`) mapped to CSS variables, but these are barely used since everything is inline styles. The `pages/` content path is included but the project uses App Router (`app/`), so `pages/` is unnecessary.

### 10.4 Hardcoded Colors

Colors like `#7c3aed`, `#f3f0ff`, `#ede9fe`, `#16a34a`, etc. are hardcoded in dozens of places across components. These should be centralized — either as CSS variables (some exist in `globals.css` but aren't used), Tailwind theme tokens, or a shared constants file.

---

## 11. Dependency Health

### 11.1 Current Dependencies

| Package | Version | Status |
|---|---|---|
| next | 14.2.35 | ⚠️ Next.js 15 has been stable for a while. Consider upgrading. |
| react / react-dom | ^18 | ⚠️ React 19 is available. Next.js 15 supports it. |
| swr | ^2.4.1 | ✅ Current |
| lucide-react | ^0.577.0 | ✅ Current |
| react-markdown | ^10.1.0 | ✅ Current |
| remark-gfm | ^4.0.1 | ✅ Current |

### 11.2 Unused Dependencies

- **`tailwindcss`** — Configured but barely used (all styling is inline). Either adopt it or remove it.
- **`postcss`** — Only needed for Tailwind. Remove if Tailwind is removed.

### 11.3 Missing Dependencies

- No error boundary library. React error boundaries are class-component only. Consider `react-error-boundary` for functional component support.
- No form validation library. The IngestWizard does manual URL validation. Consider `zod` for schema validation.

---

## 12. Summary of Priority Actions

### Critical (Fix Now)
1. **StatsStrip links to `/queue`** which doesn't exist — change to `/files?tab=pending`
2. **API functions missing `res.ok` checks** — 10+ functions silently swallow server errors
3. **`FilesPage` fetches both queue and files data simultaneously** — skip inactive tab's fetch

### High Priority
4. Remove dead components: `ContextPanel.tsx`, `AssistantFooter.tsx`, `LogViewer.tsx`
5. Deduplicate `DeepLinksSection` / `DeepLinksPanel` code across `FileDetailsCollapsible` and file detail page
6. Add focus trapping to modals (`FileModal`, `AgenticTaskView`, `AgentChatPanel`)
7. Add keyboard alternatives for swipe gestures in `SwipeRow` and `SpeedCard`
8. Centralize animation keyframes in `globals.css` — remove 15+ inline `<style>` tags

### Medium Priority
9. Split `lib/types.ts` (~350 lines) and `lib/api.ts` (~280 lines) into domain-grouped files
10. Split `IngestWizard.tsx` (988 lines) into sub-components
11. Add `refreshWhenHidden: false` to all SWR polling hooks
12. Make `useActiveJobs` polling conditional on having active jobs
13. Decide on Tailwind vs. inline styles — commit to one approach
14. Update or archive `FRONTEND_WIREFRAME.md` to reflect current architecture
15. Remove unused types (`KBSearchResult`, `KBChatMessage`, `BatchRevalidateRequest`)
16. Remove no-op `SET_SOURCE_URL` action from `useJobStream` reducer
17. Remove unused `activeFilter` prop from `StatsStrip`

### Low Priority
18. Namespace localStorage keys (e.g., `kb-manager:sidebar-collapsed`)
19. Lazy-load `MdPreview` (react-markdown is heavy)
20. Add `rel="noopener noreferrer"` to markdown-rendered links
21. Consider upgrading to Next.js 15 + React 19
22. Add a shared `fetchJSON` helper with error handling for the API layer
