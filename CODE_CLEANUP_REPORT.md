# Code Cleanup & Maintenance Report

**Project:** KB Manager (pilot-kb-ui)
**Date:** 2026-03-31
**Framework:** Next.js 14 (App Router) · React 18 · TypeScript · Tailwind CSS · SWR
**Codebase:** 62 source files (28 components, 15 hooks, 9 routes, 2 lib files)

---

## Table of Contents

1. [Critical Bugs — Navigation](#1-critical-bugs--navigation)
2. [Dead / Unused Components](#2-dead--unused-components)
3. [Dead / Unused Hooks](#3-dead--unused-hooks)
4. [Duplicate Utility Functions](#4-duplicate-utility-functions)
5. [Missing Error Boundaries & 404 Handling](#5-missing-error-boundaries--404-handling)
6. [Navigation Flow & CTA Audit](#6-navigation-flow--cta-audit)
7. [Component Size & Complexity](#7-component-size--complexity)
8. [Code Quality & Maintainability](#8-code-quality--maintainability)
9. [Recommended Cleanup Checklist](#9-recommended-cleanup-checklist)

---

## 1. Critical Bugs — Navigation

### BUG: StatsStrip links to non-existent `/queue` route

| Severity | File | Line |
|----------|------|------|
| **HIGH** | `components/StatsStrip.tsx` | 22 |

**Current code:**
```tsx
{ label: "Pending Review", key: "pending_review", icon: <Clock size={18} />, accent: "#d97706", href: "/queue" }
```

**Problem:** There is no `/queue` page in the app. The `/queue` route does not exist. Clicking "Pending Review" on the stats strip navigates to a dead route, showing Next.js default 404.

**Fix:** Change `href: "/queue"` → `href: "/files?tab=pending"`

---

## 2. Dead / Unused Components

These components are **never imported** anywhere in the codebase. They are orphaned files from earlier iterations.

| Component | File | Size | Evidence |
|-----------|------|------|----------|
| **SourceCard** | `components/SourceCard.tsx` | 12.6 KB | Zero imports found. `SourcesTable.tsx` is used instead for source listing. |
| **ContextPanel** | `components/ContextPanel.tsx` | 6.3 KB | Zero imports found. Was a context-aware chat panel — superseded by `AgentChatPanel` + `FileDetailsCollapsible`. |
| **AssistantFooter** | `components/AssistantFooter.tsx` | 6.4 KB | Zero imports found. Standalone assistant chat footer — superseded by `ShellLayout`'s `AgentChatPanel`. |

**Recommendation:** Delete all three files. Combined savings: **~25 KB** of dead code.

---

## 3. Dead / Unused Hooks

| Hook | File | Used By |
|------|------|---------|
| `useContextAgent` | `hooks/useContextAgent.ts` | Only imported by **ContextPanel.tsx** (dead) and **AssistantFooter.tsx** (dead). Also used by `FileDetailsCollapsible.tsx` via direct `streamContextChat` API call — so the hook itself may be orphaned if ContextPanel is removed. |

**Action:** Verify if `useContextAgent` is used after removing ContextPanel and AssistantFooter. If only those two dead components import it, delete it too.

---

## 4. Duplicate Utility Functions

### `fmtDate` — Defined **7 times** across the codebase

| File | Line | Signature |
|------|------|-----------|
| `components/FileModal.tsx` | 22 | `fmtDate(d: string \| null)` |
| `components/SpeedCard.tsx` | 24 | `fmtDate(d: string \| null)` |
| `components/SwipeRow.tsx` | 24 | `fmtDate(d: string \| null)` |
| `components/SourceCard.tsx` | 10 | `fmtDate(d: string): string` (dead file) |
| `components/SourcesTable.tsx` | 34 | `fmtDate(d: string \| null): string` |
| `app/sources/[sourceId]/page.tsx` | 21 | `fmtDate(d: string): string` |
| `app/sources/[sourceId]/files/[fileId]/page.tsx` | 43 | `fmtDate(d: string \| null)` |

**Impact:** 7 copies of nearly identical date formatting logic. Different nullability signatures hint at inconsistent handling.

**Fix:** Create `lib/utils.ts` with a single `fmtDate` and import everywhere.

---

### `clamp` — Defined **2 times**

| File | Line |
|------|------|
| `components/SpeedCard.tsx` | 20 |
| `components/SwipeRow.tsx` | 20 |

**Fix:** Move to `lib/utils.ts`.

---

### Time formatting helpers (`fmtTime`, `fmtElapsed`)

Found in `components/LogViewer.tsx` (lines 30-42). Similar time logic may exist elsewhere.

**Fix:** Consolidate into `lib/utils.ts` if reused.

---

## 5. Missing Error Boundaries & 404 Handling

| Missing File | Impact |
|-------------|--------|
| `app/not-found.tsx` | No custom 404 page. Users hitting invalid routes see raw Next.js error. |
| `app/error.tsx` | No global error boundary. Unhandled runtime errors crash the page with no recovery UI. |
| `app/loading.tsx` | No global loading state. Route transitions have no visual feedback. |
| `app/sources/[sourceId]/not-found.tsx` | Invalid source IDs show broken page instead of "Source not found". |
| `app/sources/[sourceId]/files/[fileId]/not-found.tsx` | Invalid file IDs show broken page instead of "File not found". |

**Risk:** Dynamic routes `/sources/[sourceId]` and `/sources/[sourceId]/files/[fileId]` do not validate that resources exist. If the API returns 404, the page renders with empty/broken state rather than graceful fallback.

**Recommendation:**
- Add `app/not-found.tsx` with a branded 404 page
- Add `app/error.tsx` with error recovery UI
- Add resource-not-found checks in dynamic route pages (call `notFound()` from `next/navigation` when API returns 404)

---

## 6. Navigation Flow & CTA Audit

### Complete Route Map

```
/                                          → redirect → /dashboard
/dashboard                                 → Stats, Quick Actions, Active Jobs
/files                                     → File list (tabs: pending | all)
/files?tab=pending&mode=speed              → Speed Review card stack
/sources                                   → Sources table
/sources/[sourceId]                        → Source detail (tabs: overview | jobs | deep-links)
/sources/[sourceId]/files/[fileId]         → File detail page
/discovery                                 → Deep links discovery
/discovery?mode=speed                      → Speed Discovery card stack
/kb                                        → Knowledge base search/chat
```

### CTA Button → Destination Matrix

| CTA Button | Location | Navigates To | Status |
|------------|----------|-------------|--------|
| Speed Review | Dashboard | `/files?tab=pending&mode=speed` | OK |
| Speed Discovery | Dashboard | `/discovery?mode=speed` | OK |
| Pending Review (card) | Dashboard | `/files?tab=pending` | OK |
| All Files (card) | Dashboard | `/files` | OK |
| Pending Review (stat) | StatsStrip | `/queue` | **BROKEN** — route doesn't exist |
| Total Files (stat) | StatsStrip | `/files` | OK |
| Approved (stat) | StatsStrip | `/files?status=in_s3` | OK |
| Rejected (stat) | StatsStrip | `/files?status=rejected` | OK |
| Active Ingestion | Dashboard | `/sources/${id}?tab=jobs` | OK |
| Recent Activity | Dashboard | `/sources/${id}` | OK |
| New Ingestion | Sidebar / Sources | Opens IngestWizard modal | OK |
| Post-Ingestion | IngestWizard | `/sources/${id}?tab=jobs` | OK (but could nav to `/sources/undefined` if API fails) |
| File row click | Files page | `/sources/${sourceId}/files/${fileId}` | OK |
| Back button | File detail | `/sources/${sourceId}` | OK |
| Breadcrumb: Sources | File detail | `/sources` | OK |

### Potential Navigation Issues

1. **IngestWizard fallback:** If ingestion API fails to return a `sourceId`, the redirect `router.push(\`/sources/${firstSourceId}?tab=jobs\`)` could navigate to `/sources/undefined?tab=jobs`.

2. **No auth guards:** No authentication or authorization checks on any route. If auth is planned, every page needs protection.

3. **Sidebar active detection:** Uses `pathname.startsWith(path)` which means `/sources` would also highlight when on `/sources/[sourceId]/files/[fileId]` — this is likely intentional but worth verifying.

4. **No back-navigation from Speed Review/Discovery:** Once in card-stack mode, the only exit is a mode toggle or browser back button. Consider adding explicit "Exit" CTA.

---

## 7. Component Size & Complexity

Large components are harder to maintain, test, and debug. These exceed reasonable size:

| Component | Size | Lines (est.) | Concern |
|-----------|------|-------------|---------|
| **IngestWizard.tsx** | 38.4 KB | ~900+ | Multi-step wizard with inline state, API calls, SSE streaming, validation — candidate for splitting |
| **AgenticTaskView.tsx** | 27.4 KB | ~650+ | Complex visualization with SSE log parsing — extract sub-components |
| **LogViewer.tsx** | 23.7 KB | ~550+ | Heavy SSE event rendering — extract event renderers |
| **FileDetailsCollapsible.tsx** | 22.4 KB | ~500+ | Large expandable detail panel — extract sections |
| **FileModal.tsx** | 16.8 KB | ~400+ | Modal with editing, preview, actions — extract tabs |
| **NavTreeBrowser.tsx** | 13.7 KB | ~350+ | Recursive tree — consider memoization |

**Recommendation:** Break components over ~15 KB into smaller sub-components. Start with IngestWizard (highest impact).

---

## 8. Code Quality & Maintainability

### 8.1 No shared utility file
There is no `lib/utils.ts`. Every component re-implements helpers locally (fmtDate, clamp, etc.).

### 8.2 Inline style objects
Many components use inline `style={{...}}` objects instead of Tailwind classes. This creates:
- Style inconsistency (mix of Tailwind and inline)
- Harder theming/dark mode support
- Unnecessary re-renders (new object references each render)

### 8.3 No test coverage for components
`vitest` is configured but no component test files were found. Only the setup file exists.

### 8.4 Empty Next.js config
`next.config.mjs` is empty — no image optimization, no redirects, no headers. Consider adding:
- Security headers
- Image domains configuration
- Redirect from `/queue` → `/files?tab=pending` as a safety net

### 8.5 Environment variable validation
`.env.local` values are used without runtime validation. If `NEXT_PUBLIC_API_URL` is missing, API calls fail silently.

### 8.6 No TypeScript strict null checks on API responses
Hooks return data from SWR but pages often use it without null guards beyond basic `if (!data)` checks.

---

## 9. Recommended Cleanup Checklist

### Phase 1 — Quick Wins (1-2 hours)

- [ ] **Fix `/queue` bug** in `StatsStrip.tsx:22` → change to `/files?tab=pending`
- [ ] **Delete dead components:** `SourceCard.tsx`, `ContextPanel.tsx`, `AssistantFooter.tsx`
- [ ] **Verify and delete** `useContextAgent.ts` if orphaned after above deletions
- [ ] **Create `lib/utils.ts`** with shared `fmtDate`, `clamp`, and time-formatting helpers
- [ ] **Replace all local copies** of `fmtDate` (7 files) and `clamp` (2 files) with imports from utils

### Phase 2 — Error Handling & Robustness (2-4 hours)

- [ ] **Add `app/not-found.tsx`** — branded 404 page
- [ ] **Add `app/error.tsx`** — global error boundary with recovery
- [ ] **Add `app/loading.tsx`** — global loading skeleton
- [ ] **Add `notFound()` calls** in dynamic route pages when API returns 404
- [ ] **Guard IngestWizard redirect** against undefined `sourceId`
- [ ] **Add env validation** — fail fast if `NEXT_PUBLIC_API_URL` is missing

### Phase 3 — Component Refactoring (1-2 days)

- [ ] **Split `IngestWizard.tsx`** into step components (WizardStep1, WizardStep2, etc.)
- [ ] **Extract sub-components** from `AgenticTaskView.tsx`, `LogViewer.tsx`, `FileDetailsCollapsible.tsx`
- [ ] **Migrate inline styles** to Tailwind classes for consistency
- [ ] **Add memoization** (`React.memo`, `useMemo`, `useCallback`) to heavy render paths (NavTreeBrowser, DataTable)

### Phase 4 — Testing & Documentation (ongoing)

- [ ] **Add component tests** — start with critical paths: IngestWizard, SpeedReview, DataTable
- [ ] **Add integration tests** for navigation flows (route transitions, CTA destinations)
- [ ] **Configure `next.config.mjs`** with security headers and image optimization
- [ ] **Add redirect rule** in next.config: `/queue` → `/files?tab=pending` as a permanent safety net

---

## Files Referenced in This Report

| File | Issues |
|------|--------|
| `components/StatsStrip.tsx` | Broken `/queue` href |
| `components/SourceCard.tsx` | Dead component — never imported |
| `components/ContextPanel.tsx` | Dead component — never imported |
| `components/AssistantFooter.tsx` | Dead component — never imported |
| `hooks/useContextAgent.ts` | Potentially dead hook |
| `components/FileModal.tsx` | Duplicate `fmtDate` |
| `components/SpeedCard.tsx` | Duplicate `fmtDate`, `clamp` |
| `components/SwipeRow.tsx` | Duplicate `fmtDate`, `clamp` |
| `components/SourcesTable.tsx` | Duplicate `fmtDate` |
| `components/IngestWizard.tsx` | Oversized (38 KB), unsafe redirect |
| `components/AgenticTaskView.tsx` | Oversized (27 KB) |
| `components/LogViewer.tsx` | Oversized (24 KB), local time helpers |
| `components/FileDetailsCollapsible.tsx` | Oversized (22 KB) |
| `app/sources/[sourceId]/page.tsx` | Duplicate `fmtDate`, no 404 handling |
| `app/sources/[sourceId]/files/[fileId]/page.tsx` | Duplicate `fmtDate`, no 404 handling |
| `app/not-found.tsx` | **Missing** |
| `app/error.tsx` | **Missing** |
| `app/loading.tsx` | **Missing** |
| `lib/utils.ts` | **Missing** — needs creation |
