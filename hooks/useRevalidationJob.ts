import useSWR from "swr";
import { getRevalidationJob } from "@/lib/api";
import type { RevalidationJob } from "@/lib/types";
import { useState, useEffect } from "react";

export function useRevalidationJob(jobId: string | null) {
  const [polling, setPolling] = useState(false);

  const { data, error, isLoading, mutate } = useSWR<RevalidationJob>(
    jobId ? `revalidation-job:${jobId}` : null,
    () => {
      if (!jobId) throw new Error("No job ID");
      return getRevalidationJob(jobId);
    },
    { refreshInterval: polling ? 3000 : 0 },
  );

  useEffect(() => {
    setPolling(!!jobId && data?.status === "in_progress");
  }, [jobId, data]);

  return { data, error, isLoading, mutate, isPolling: polling };
}
