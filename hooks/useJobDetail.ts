import useSWR from "swr";
import { getIngestionJob } from "@/lib/api";
import type { IngestionJob } from "@/lib/types";
import { useState, useEffect } from "react";

export function useJobDetail(id: string | null) {
  const key = id ? `job-detail:${id}` : null;
  const [polling, setPolling] = useState(false);

  const { data, error, isLoading, mutate } = useSWR<IngestionJob>(
    key,
    () => {
      if (!id) throw new Error("No job ID");
      return getIngestionJob(id);
    },
    { refreshInterval: polling ? 3000 : 0 },
  );

  useEffect(() => {
    setPolling(data?.status === "in_progress");
  }, [data]);

  return { data, error, isLoading, mutate };
}
