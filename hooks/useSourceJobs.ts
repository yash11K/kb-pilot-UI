import useSWR from "swr";
import { getSourceJobs } from "@/lib/api";
import type { PaginatedResponse, IngestionJob } from "@/lib/types";
import { useState, useEffect } from "react";

export function useSourceJobs(sourceId: string | null, page: number, size = 20) {
  const [polling, setPolling] = useState(false);

  const { data, error, isLoading, mutate } = useSWR<PaginatedResponse<IngestionJob>>(
    sourceId ? `source-jobs:${sourceId}:${page}:${size}` : null,
    () => {
      if (!sourceId) throw new Error("No source ID");
      return getSourceJobs(sourceId, page, size);
    },
    { refreshInterval: polling ? 10000 : 0 },
  );

  useEffect(() => {
    const hasInProgress = data?.items.some((j) => j.status === "in_progress") ?? false;
    setPolling(hasInProgress);
  }, [data]);

  return { data, error, isLoading, mutate };
}
