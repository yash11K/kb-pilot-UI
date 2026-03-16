import useSWR from "swr";
import { getStats } from "@/lib/api";
import type { StatsResponse } from "@/lib/types";

export function useStats() {
  const { data, error, isLoading, mutate } = useSWR<StatsResponse>(
    "stats",
    () => getStats(),
    { refreshInterval: 30000 },
  );

  return { data, error, isLoading, mutate };
}
