"use client";

import useSWR from "swr";
import { getActiveSourceJobs } from "@/lib/api";
import type { ActiveJobsMap } from "@/lib/types";

/**
 * Polls GET /sources/active-jobs every 5s to know which sources
 * have in-progress ingestion jobs.
 */
export function useActiveJobs() {
  const { data, error, isLoading, mutate } = useSWR<ActiveJobsMap>(
    "active-jobs",
    getActiveSourceJobs,
    { refreshInterval: 5_000 },
  );

  return {
    activeJobs: data ?? {},
    error,
    isLoading,
    mutate,
  };
}
